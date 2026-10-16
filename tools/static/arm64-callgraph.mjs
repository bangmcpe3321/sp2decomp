// Decode ARM64 BL call targets inside a chosen set of functions, directly from
// the binary, and resolve them to symbols.
//
// Why: Ghidra's Listing stays empty for this binary unless whole-program
// auto-analysis runs (which stalls on 113k functions). But call targets are
// plain ARM64 BL instructions with a PC-relative immediate, so they can be
// recovered exactly without a disassembler -- only a decode is needed.
//
// Function extents are bounded by the next symbol address from the module's own
// symbol table, which is exact for this binary because it is not stripped.
import { readFileSync, writeFileSync } from "node:fs";

const nsoPath = process.argv[2] ?? "main.elf";
const invPath = process.argv[3] ?? "inventory.txt";
const outPath = process.argv[4] ?? "boot-callgraph.txt";

const b = readFileSync(nsoPath);
const IMAGE_BASE = 0x7100000000;
const TEXT_FILE = 0x100;
const TEXT_VA = 0x0; // .text is 0-relative inside the image
const TEXT_SIZE = 0x1415068;
// Symbol VAs from the analysis database are absolute (image base applied).
const absToVa = (abs) => abs - IMAGE_BASE;
const vaToFile = (va) => TEXT_FILE + (va - TEXT_VA);
const inText = (va) => va >= TEXT_VA && va < TEXT_VA + TEXT_SIZE;
const ABS_TEXT_START = IMAGE_BASE + TEXT_VA;
const ABS_TEXT_END = IMAGE_BASE + TEXT_VA + TEXT_SIZE;

// ---- symbol table -------------------------------------------------------
const syms = [];
for (const ln of readFileSync(invPath, "utf8").split("\n")) {
  if (!ln.startsWith("FUNCTION\t")) continue;
  const p = ln.split("\t");
  const abs = parseInt(p[1], 16);
  if (Number.isNaN(abs)) continue;
  if (abs < ABS_TEXT_START || abs >= ABS_TEXT_END) continue;
  syms.push({ va: absToVa(abs), abs, name: p[2] });
}
syms.sort((a, b) => a.va - b.va);
const sortedVa = syms.map((s) => s.va);

function demangle(m) {
  if (!m) return m;
  if (!m.startsWith("_Z")) return m;
  let s = m.slice(2);
  while (s[0] === "K" || s[0] === "V" || s[0] === "R") s = s.slice(1);
  if (!s.startsWith("N")) return m;
  s = s.slice(1);
  const parts = [];
  for (;;) {
    if (s.startsWith("E")) break;
    const mm = /^(\d+)/.exec(s);
    if (!mm) break;
    const L = Number(mm[1]);
    parts.push(s.slice(mm[0].length, mm[0].length + L));
    s = s.slice(mm[0].length + L);
  }
  if (!parts.length) return m;
  const last = parts[parts.length - 1];
  const ctor = ["C1", "C2", "C3"].includes(last);
  const dtor = ["D0", "D1", "D2"].includes(last);
  const base = parts.slice(0, ctor || dtor ? -2 : -1).join("::");
  if (ctor) return base + "::" + base.split("::").pop();
  if (dtor) return base + "::~" + base.split("::").pop();
  return parts.join("::");
}

const nameAt = (() => {
  const map = new Map(syms.map((s) => [s.va, s.name]));
  return (va) => map.get(va) ?? null;
})();

// next symbol boundary, for bounding a function body
function bodyEnd(va) {
  let lo = 0, hi = sortedVa.length - 1, idx = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (sortedVa[mid] <= va) { idx = mid; lo = mid + 1; } else hi = mid - 1;
  }
  if (idx < 0 || sortedVa[idx] !== va) return null;
  const next = idx + 1 < sortedVa.length ? sortedVa[idx + 1] : TEXT_VA + TEXT_SIZE;
  return Math.min(next, TEXT_VA + TEXT_SIZE);
}

// ---- ARM64 BL / B decode ------------------------------------------------
// BL  : 1001 01 | imm26          -> 0x94000000
// B   : 0001 01 | imm26          -> 0x14000000
// BLR : 1101 0110 0011 1111 0000 00 | Rn  -> 0xD63F0000 (register, unresolved)
function decodeBranch(word, va) {
  const op = (word & 0xfc000000) >>> 0;
  if (op === 0x94000000) {
    let imm = word & 0x03ffffff;
    if (imm & 0x02000000) imm -= 0x04000000;
    return { kind: "bl", target: va + imm * 4 };
  }
  if (op === 0x14000000) {
    let imm = word & 0x03ffffff;
    if (imm & 0x02000000) imm -= 0x04000000;
    return { kind: "b", target: va + imm * 4 };
  }
  if ((word & 0xfffffc1f) >>> 0 === 0xd63f0000) return { kind: "blr", target: null };
  return null;
}

// ---- target boot functions (image-relative VAs) -------------------------
const hexs = (va) => "0x" + (IMAGE_BASE + va).toString(16);
const TARGETS = [
  [0x11f5b20, "Lp::Sys::SysInit::Init (framework entry)"],
  [0x11f5ab4, "Lp::Sys::SysInit::nninitStartup (SDK startup)"],
  [0x11fca28, "Lp::Sys::RootTask::parallelInitThreadFunc"],
  [0x11fcadc, "Lp::Sys::RootTask::createParallelInitThread"],
  [0x11fcb44, "Lp::Sys::RootTask::runParallelInitThread"],
  [0x11fcba4, "Lp::Sys::RootTask::waitDoneParallelInitThread"],
  [0x0053a8c, "Lp::Sys::Scene::sceneCalc"],
  [0x0096838, "Lp::Sys::CalcInGSysCalc"],
];

const out = [];
out.push("Static call graph for boot-critical functions (decoded from ARM64)");
out.push(`source: ${nsoPath}`);
out.push(`image base: 0x${IMAGE_BASE.toString(16)}   symbols in .text: ${syms.length}`);
out.push("");

const globalCallees = new Map();

for (const [va, label] of TARGETS) {
  const end = bodyEnd(va);
  if (end === null) {
    out.push(`0x${va.toString(16)}  ${label}  -- NO SYMBOL AT THIS ADDRESS`);
    out.push("");
    continue;
  }
  const size = end - va;
  out.push("=".repeat(78));
  out.push(`${hexs(va)}  ${label}`);
  out.push(`  body: ${hexs(va)} .. ${hexs(end)}  (${size} bytes)`);

  const calls = [];
  for (let off = 0; off + 4 <= size; off += 4) {
    const fo = vaToFile(va + off);
    if (fo + 4 > b.length) break;
    const word = b.readUInt32LE(fo);
    const dec = decodeBranch(word, va + off);
    if (dec === null) continue;
    if (dec.kind === "blr") {
      calls.push({ site: va + off, kind: "blr", target: null, named: "<indirect — unresolved>" });
      continue;
    }
    if (!inText(dec.target)) continue;
    const nm = nameAt(dec.target);
    calls.push({
      site: va + off,
      kind: dec.kind,
      target: dec.target,
      named: nm ? demangle(nm) : "<no symbol in .text>",
    });
    if (nm) {
      const k = dec.target;
      if (!globalCallees.has(k)) globalCallees.set(k, { va: k, name: demangle(nm), from: new Set() });
      globalCallees.get(k).from.add(label);
    }
  }

  out.push(`  ${calls.length} branch instructions decoded`);
  for (const c of calls) {
    out.push(`    ${c.kind.padEnd(4)} ${c.target !== null ? hexs(c.target) : "----------"}  ${c.named}`);
  }
  out.push("");
}

out.push("=".repeat(78));
out.push(`CONSOLIDATED CALLEES: ${globalCallees.size} distinct named targets`);
out.push("");
const byNs = new Map();
for (const v of globalCallees.values()) {
  const seg = v.name.split("::").slice(0, 2).join("::");
  if (!byNs.has(seg)) byNs.set(seg, []);
  byNs.get(seg).push(v);
}
out.push("by subsystem:");
for (const [seg, items] of [...byNs.entries()].sort((a, b) => b[1].length - a[1].length)) {
  out.push(`  ${seg}  (${items.length})`);
  for (const it of items.slice(0, 15)) out.push(`     ${hexs(it.va)}  ${it.name}`);
  if (items.length > 15) out.push(`     ... ${items.length - 15} more`);
}

writeFileSync(outPath, out.join("\n") + "\n");
console.log(`wrote ${outPath}`);
console.log(`symbols in .text: ${syms.length}`);
console.log(`distinct named callees found: ${globalCallees.size}`);
