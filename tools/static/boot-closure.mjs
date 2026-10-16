// BFS the boot dependency closure from the framework entry points.
//
// Builds a call graph by decoding ARM64 BL/B instructions, then walks outward
// from the boot roots to produce the dependency closure needed to reach the
// first frame.
//
// Function extents: from a symbol start to the earliest of
//   (a) the next symbol address, or
//   (b) the first top-level RET (0xd65f03c0)
// whichever comes first. Without (b), extents over-reach into adjacent code.
//
// Honest limits: BLR (register) targets are invisible, so virtual dispatch is
// missing from this graph; and (b) can truncate a function early if an interior
// word happens to encode RET.
import { readFileSync, writeFileSync } from "node:fs";

const nsoPath = process.argv[2] ?? "main.elf";
const invPath = process.argv[3] ?? "inventory.txt";
const outPath = process.argv[4] ?? "boot-closure.txt";
const MAX_DEPTH = Number(process.argv[5] ?? 4);
const MAX_NODES = Number(process.argv[6] ?? 4000);

const b = readFileSync(nsoPath);
const IMAGE_BASE = 0x7100000000;
const TEXT_FILE = 0x100;
const TEXT_VA = 0;
const TEXT_SIZE = 0x1415068;
const ACTUAL_TEXT_SIZE = 0x1415068;
const vaToFile = (va) => TEXT_FILE + va;
const inText = (va) => va >= TEXT_VA && va < TEXT_VA + ACTUAL_TEXT_SIZE;
const hexs = (va) => "0x" + (IMAGE_BASE + va).toString(16);

// ---- symbols ------------------------------------------------------------
const syms = [];
for (const ln of readFileSync(invPath, "utf8").split("\n")) {
  if (!ln.startsWith("FUNCTION\t")) continue;
  const p = ln.split("\t");
  const abs = parseInt(p[1], 16);
  if (Number.isNaN(abs)) continue;
  const va = abs - IMAGE_BASE;
  if (!inText(va)) continue;
  syms.push({ va, name: p[2] });
}
syms.sort((a, b) => a.va - b.va);
const symVas = syms.map((s) => s.va);
const nameMap = new Map(syms.map((s) => [s.va, s.name]));

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

// next symbol strictly greater than va
function nextSym(va) {
  let lo = 0, hi = symVas.length - 1, res = ACTUAL_TEXT_SIZE;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (symVas[mid] > va) { res = symVas[mid]; hi = mid - 1; } else lo = mid + 1;
  }
  return res;
}

const RET = 0xd65f03c0;
function bodyEnd(va) {
  const next = nextSym(va);
  const cap = Math.min(next, ACTUAL_TEXT_SIZE);
  // scan for the first top-level RET, up to the next symbol
  for (let p = va; p + 4 <= cap; p += 4) {
    const fo = vaToFile(p);
    if (fo + 4 > b.length) break;
    if (b.readUInt32LE(fo) === RET) return p + 4;
  }
  return cap;
}

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

// ---- callees of one function -------------------------------------------
const calleeCache = new Map();
function calleesOf(va) {
  if (calleeCache.has(va)) return calleeCache.get(va);
  const end = bodyEnd(va);
  const found = [];
  let indirect = 0;
  for (let p = va; p + 4 <= end; p += 4) {
    const fo = vaToFile(p);
    if (fo + 4 > b.length) break;
    const word = b.readUInt32LE(fo);
    const dec = decodeBranch(word, p);
    if (!dec) continue;
    if (dec.kind === "blr") { indirect++; continue; }
    if (!inText(dec.target)) continue;
    if (dec.target === va) continue; // self-recursion
    found.push(dec.target);
  }
  const res = { end, size: end - va, callees: found, indirect };
  calleeCache.set(va, res);
  return res;
}

// ---- BFS from the boot roots -------------------------------------------
const ROOTS = [
  0x11f5ab4, // SysInit::nninitStartup
  0x11f5b20, // SysInit::Init
  0x11fca28, // RootTask::parallelInitThreadFunc
  0x11fcadc, // RootTask::createParallelInitThread
  0x11fcb44, // RootTask::runParallelInitThread
  0x11fcba4, // RootTask::waitDoneParallelInitThread
];

const depth = new Map();
const parent = new Map();
const queue = [];
for (const r of ROOTS) { depth.set(r, 0); queue.push(r); }

let qi = 0;
let truncated = false;
const perDepth = new Map();
while (qi < queue.length) {
  const cur = queue[qi++];
  const d = depth.get(cur);
  perDepth.set(d, (perDepth.get(d) || 0) + 1);
  if (d >= MAX_DEPTH) continue;
  const { callees } = calleesOf(cur);
  for (const c of callees) {
    if (depth.has(c)) continue;
    if (depth.size >= MAX_NODES) { truncated = true; break; }
    depth.set(c, d + 1);
    parent.set(c, cur);
    queue.push(c);
  }
  if (truncated) break;
}

// ---- resolve names ------------------------------------------------------
function resolve(va) {
  const exact = nameMap.get(va);
  if (exact) return demangle(exact);
  return "<no symbol>";
}

// ---- report -------------------------------------------------------------
const out = [];
out.push("Boot dependency closure (BFS over decoded ARM64 call graph)");
out.push(`roots: ${ROOTS.length}   max depth: ${MAX_DEPTH}   nodes: ${depth.size}${truncated ? " (TRUNCATED at cap)" : ""}`);
out.push("");
out.push("Reachability by depth from the boot roots:");
for (const d of [...perDepth.keys()].sort((a, b) => a - b)) {
  out.push(`  depth ${d}: ${perDepth.get(d)} functions`);
}
out.push("");

// namespace totals across the closure
const nsTotals = new Map();
for (const va of depth.keys()) {
  const nm = resolve(va);
  const seg = nm.split("::")[0];
  nsTotals.set(seg, (nsTotals.get(seg) || 0) + 1);
}
out.push("Closure composition by top-level namespace:");
for (const [k, c] of [...nsTotals.entries()].sort((a, b) => b[1] - a[1])) {
  out.push(`  ${String(c).padStart(5)}  ${k}`);
}
out.push("");

// list each depth layer with named entries
for (const d of [...perDepth.keys()].sort((a, b) => a - b)) {
  const nodes = [...depth.entries()].filter(([, dd]) => dd === d).map(([va]) => va);
  out.push("=".repeat(78));
  out.push(`DEPTH ${d}  (${nodes.length} functions)`);
  out.push("");
  const byNs = new Map();
  for (const va of nodes) {
    const nm = resolve(va);
    const key = nm.split("::").slice(0, 2).join("::");
    if (!byNs.has(key)) byNs.set(key, []);
    byNs.get(key).push({ va, nm });
  }
  for (const [key, items] of [...byNs.entries()].sort((a, b) => b[1].length - a[1].length)) {
    out.push(`  ${key}  (${items.length})`);
    for (const it of items.slice(0, 20)) {
      const info = calleeCache.get(it.va);
      const extra = info ? `  [${info.size}B, ${info.callees.length} calls${info.indirect ? ", " + info.indirect + " indirect" : ""}]` : "";
      out.push(`     ${hexs(it.va)}  ${it.nm}${extra}`);
    }
    if (items.length > 20) out.push(`     ... ${items.length - 20} more`);
  }
  out.push("");
}

// unresolved-but-called: callees that had no symbol
const unsymboled = new Map();
for (const va of depth.keys()) {
  const { callees } = calleesOf(va);
  for (const c of callees) {
    if (!nameMap.has(c)) unsymboled.set(c, (unsymboled.get(c) || 0) + 1);
  }
}
out.push("=".repeat(78));
out.push(`Callees with no symbol (local/static, ${unsymboled.size} distinct)`);
for (const [va, n] of [...unsymboled.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40)) {
  out.push(`  ${hexs(va)}  called ${n}x`);
}

writeFileSync(outPath, out.join("\n") + "\n");
console.log(`wrote ${outPath}`);
console.log(`depth layers: ${perDepth.size}  nodes: ${depth.size}${truncated ? " (truncated)" : ""}`);
console.log(`cached function bodies: ${calleeCache.size}`);
