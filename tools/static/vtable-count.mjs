// Count virtual functions via the vtable, using dynamic relocations.
//
// The binary has no _ZTV* symbols, but a vtable is a run of consecutive
// R_AARCH64_RELATIVE relocations in .data whose targets are all functions. This
// finds such runs and reports their lengths, which is a ground-truth virtual
// function count to compare against a header's virtual declarations.
import { readFileSync, writeFileSync } from "node:fs";

const nsoPath = process.argv[2] ?? "main.elf";
const invPath = process.argv[3] ?? "inventory.txt";
const outPath = process.argv[4] ?? "vtables.txt";

const b = readFileSync(nsoPath);
const IMAGE_BASE = 0x7100000000n;
const TEXT_FILE = 0x100;
const TEXT_SIZE = 0x1415068n;
const hex = (v) => "0x" + v.toString(16);
const isCode = (abs) => abs >= IMAGE_BASE && abs < IMAGE_BASE + TEXT_SIZE;

const fileOf = (abs) => {
  const vaRel = Number(abs - IMAGE_BASE);
  return TEXT_FILE + vaRel;
};

// symbol names by absolute VA
const nameAt = new Map();
for (const ln of readFileSync(invPath, "utf8").split("\n")) {
  if (!ln.startsWith("FUNCTION\t")) continue;
  const p = ln.split("\t");
  const abs = BigInt(parseInt(p[1], 16));
  if (!Number.isNaN(Number(abs))) nameAt.set(abs, p[2]);
}

function demangle(m) {
  if (!m || !m.startsWith("_Z")) return m;
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

// --- walk .rela.dyn and map slot -> target for R_AARCH64_RELATIVE ---------
const RELA_START = 0x1416048;
const RELA_END = 0x19ec6a7;
const RELAENT = 24;
const R_RELATIVE = 1027;

const slotToTarget = new Map();
for (let va = RELA_START; va + RELAENT <= RELA_END; va += RELAENT) {
  const f = fileOf(BigInt(IMAGE_BASE + BigInt(va)));
  if (f < 0 || f + RELAENT > b.length) break;
  const rOffset = b.readBigUInt64LE(f);
  const rInfo = b.readBigUInt64LE(f + 8);
  const rAddend = b.readBigInt64LE(f + 16);
  if (Number(rInfo & 0xffffffffn) !== R_RELATIVE) continue;
  const slot = IMAGE_BASE + rOffset;
  const target = IMAGE_BASE + rAddend;
  slotToTarget.set(slot, target);
}

console.log(`relative relocations mapped: ${slotToTarget.size}`);

// --- find runs of consecutive slots pointing at code ---------------------
// A vtable is >= 3 consecutive 8-byte-aligned slots, each targeting a function,
// with addresses increasing by 8.
const slots = [...slotToTarget.keys()].map(Number).sort((a, c) => a - c);
let i = 0;
const vtables = [];
while (i < slots.length) {
  let j = i;
  while (
    j + 1 < slots.length &&
    slots[j + 1] === slots[j] + 8 &&
    isCode(slotToTarget.get(BigInt(slots[j + 1])))
  ) {
    j++;
  }
  const len = j - i + 1;
  const allCode = (() => {
    for (let k = i; k <= j; k++) if (!isCode(slotToTarget.get(BigInt(slots[k])))) return false;
    return true;
  })();
  if (len >= 3 && allCode) vtables.push({ start: slots[i], len });
  i = j + 1;
}

vtables.sort((a, c) => c.len - a.len);
console.log(`vtable-shaped runs found (>=3 entries): ${vtables.length}`);

const out = [];
out.push("vtable-shaped relocation runs");
out.push(`total runs: ${vtables.length}`);
out.push("");
out.push("largest runs (slot address, entry count, first few targets):");
for (const v of vtables.slice(0, 25)) {
  const t0 = slotToTarget.get(BigInt(v.start));
  const t1 = slotToTarget.get(BigInt(v.start + 8));
  const n0 = nameAt.get(t0);
  const n1 = nameAt.get(t1);
  out.push(
    `  ${hex(v.start)}  x${String(v.len).padStart(3)}  ${n0 ? demangle(n0) : hex(t0)}  |  ${n1 ? demangle(n1) : hex(t1)}`,
  );
}

// specifically: find any run that contains a ui2d::Pane virtual (SetVertexColor etc.)
out.push("");
out.push("runs containing a Pane-related entry:");
let found = 0;
for (const v of vtables) {
  const names = [];
  for (let k = 0; k < v.len; k++) {
    const n = nameAt.get(slotToTarget.get(BigInt(v.start + k * 8)));
    if (n) names.push(demangle(n));
  }
  const paneish = names.filter((n) => /ui2d|Pane/.test(n));
  if (paneish.length >= 2) {
    found++;
    if (found <= 10) {
      out.push(`  ${hex(v.start)} x${v.len}`);
      for (const n of paneish.slice(0, 30)) out.push(`      ${n}`);
    }
  }
}
if (found === 0) out.push("  (none found — vtable entries may target unnamed local symbols)");

writeFileSync(outPath, out.join("\n") + "\n");
console.log(`wrote ${outPath}`);
