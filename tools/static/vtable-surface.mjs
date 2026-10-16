// Quantify the virtual-dispatch surface, which the BL-based call graph cannot
// see.
//
// Method: AArch64 ELF dynamic relocations of type R_AARCH64_RELATIVE (1027)
// store a pointer at some address. When that pointer targets a function, the
// pointer's storage location is a vtable slot or function-pointer table entry.
// Counting distinct target functions bounds the set of code reachable only
// through indirect calls.
import { readFileSync, writeFileSync } from "node:fs";

const nsoPath = process.argv[2] ?? "main.elf";
const invPath = process.argv[3] ?? "inventory.txt";
const outPath = process.argv[4] ?? "vtable-surface.txt";

const b = readFileSync(nsoPath);
const IMAGE_BASE = 0x7100000000;
const TEXT_FILE = 0x100;
const TEXT_SIZE = 0x1415068;
const hexs = (abs) => "0x" + abs.toString(16);
const isCode = (abs) => abs >= IMAGE_BASE && abs < IMAGE_BASE + TEXT_SIZE;
const absToVa = (abs) => abs - IMAGE_BASE;
const vaToFile = (va) => TEXT_FILE + va;

// ---- symbols ------------------------------------------------------------
const syms = [];
for (const ln of readFileSync(invPath, "utf8").split("\n")) {
  if (!ln.startsWith("FUNCTION\t")) continue;
  const p = ln.split("\t");
  const abs = parseInt(p[1], 16);
  if (!Number.isNaN(abs)) syms.push({ abs, va: absToVa(abs), name: p[2] });
}
const codeSyms = syms.filter((s) => isCode(s.abs)).sort((a, b) => a.va - b.va);
const nameAtVa = new Map(codeSyms.map((s) => [s.va, s.name]));

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

// ---- walk .rela.dyn -----------------------------------------------------
// From the analysis load: .rela.dyn spans VA 0x1416048 .. 0x19ec6a7.
const RELA_START = 0x1416048;
const RELA_END = 0x19ec6a7;
const RELAENT = 24;
const R_AARCH64_RELATIVE = 1027;
const R_AARCH64_ABS64 = 257;
const R_AARCH64_GLOB_DAT = 1025;
const R_AARCH64_JUMP_SLOT = 1026;

function readRelaAt(va) {
  const fo = vaToFile(va);
  if (fo + RELAENT > b.length) return null;
  return {
    r_offset: b.readBigUInt64LE(fo),
    r_info: b.readBigUInt64LE(fo + 8),
    r_addend: b.readBigInt64LE(fo + 16),
  };
}

const stats = { total: 0, byType: new Map(), relative: 0, relativeToCode: 0 };
const targets = new Map(); // target VA -> {count, slots:Set}
const slots = new Map(); // slot ABS -> target ABS

for (let va = RELA_START; va + RELAENT <= RELA_END; va += RELAENT) {
  const r = readRelaAt(va);
  if (r === null) break;
  stats.total++;
  const type = Number(r.r_info & 0xffffffffn);
  stats.byType.set(type, (stats.byType.get(type) || 0) + 1);

  if (type !== R_AARCH64_RELATIVE) continue;
  stats.relative++;
  // For RELATIVE, the value stored is base + addend.
  const target = IMAGE_BASE + Number(r.r_addend);
  if (!isCode(target)) continue;
  stats.relativeToCode++;
  const slot = IMAGE_BASE + Number(r.r_offset);
  slots.set(slot, target);
  const tva = absToVa(target);
  if (!targets.has(tva)) targets.set(tva, { count: 0, slots: new Set() });
  const e = targets.get(tva);
  e.count++;
  e.slots.add(slot);
}

// ---- report -------------------------------------------------------------
const out = [];
out.push("Virtual-dispatch surface (indirect call targets)");
out.push(`source: ${nsoPath}`);
out.push("");

out.push("=== .rela.dyn relocation census ===");
out.push(`  total relocations : ${stats.total}`);
for (const [t, c] of [...stats.byType.entries()].sort((a, b) => b[1] - a[1])) {
  const name =
    t === 1027 ? "R_AARCH64_RELATIVE" :
    t === 1025 ? "R_AARCH64_GLOB_DAT" :
    t === 1026 ? "R_AARCH64_JUMP_SLOT" :
    t === 257 ? "R_AARCH64_ABS64" : `type_${t}`;
  out.push(`  ${String(c).padStart(8)}  ${name}`);
}
out.push("");
out.push(`  R_AARCH64_RELATIVE pointing into .text: ${stats.relativeToCode}`);
out.push(`  distinct function targets: ${targets.size}`);
out.push("");

// namespace breakdown of indirect targets
const nsTotals = new Map();
for (const tva of targets.keys()) {
  const nm = nameAtVa.get(tva);
  const key = nm ? demangle(nm).split("::").slice(0, 2).join("::") : "<no symbol>";
  nsTotals.set(key, (nsTotals.get(key) || 0) + 1);
}
out.push("=== indirect targets by namespace (top 40) ===");
for (const [k, c] of [...nsTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40)) {
  out.push(`  ${String(c).padStart(5)}  ${k}`);
}
out.push("");

// vtable-shaped clusters: many consecutive slots sharing one target prefix
out.push("=== largest indirect-target clusters (top 30 by slot count) ===");
const sorted = [...targets.entries()].sort((a, b) => b[1].count - a[1].count);
for (const [tva, e] of sorted.slice(0, 30)) {
  const nm = nameAtVa.get(tva);
  out.push(`  ${hexs(IMAGE_BASE + tva)}  x${String(e.count).padStart(3)}  ${nm ? demangle(nm) : "<no symbol>"}`);
}
out.push("");

// Estimated virtual-call surface: how many distinct functions are reachable
// only through indirect calls and therefore absent from the BL closure.
out.push("=== interpretation ===");
out.push(`  distinct indirect-callable functions: ${targets.size}`);
out.push(`  these are vtable slots / function-pointer table entries.`);
out.push(`  the BL-based closure (232) cannot see any of them, so the true`);
out.push(`  reachable set is at least 232 + (indirect targets also on the boot`);
out.push(`  path). Identifying which of these  are boot-reachable requires`);
out.push(`  vtable type recovery, which this analysis does not attempt.`);

writeFileSync(outPath, out.join("\n") + "\n");
console.log(`wrote ${outPath}`);
console.log(`relocations: ${stats.total}  RELATIVE->text: ${stats.relativeToCode}  distinct indirect targets: ${targets.size}`);
