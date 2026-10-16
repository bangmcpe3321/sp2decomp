// Enumerate sead::Heap / ExpHeap / HeapMgr vtables to define the interface surface the
// reconstructed heap must provide.
//
// The heap layer is reached through virtual dispatch (the decompile shows Heap::getFreeSize
// at vptr+0x80 and Heap::destroy at vptr+0x28), so the vtable IS the interface contract.
// Offsets are 0-based from the vptr the object holds.
//
// IMPORTANT: at rest these slots hold image-base-RELATIVE values (R_AARCH64_RELATIVE
// addends), so a slot containing 0xe77308 actually means 0x7100e77308. A first version of
// this script read them as absolute, produced small unnamed numbers, and appeared to find
// nothing -- the same relative-vs-absolute trap recorded earlier in this project.
import { readFileSync } from "node:fs";

const b = readFileSync("main.elf");
const FB = 0x100;
const IMG = 0x7100000000;
const foff = (va) => FB + (va - IMG);
const u64 = (va) => Number(b.readBigUInt64LE(foff(va)));
const isRelative = (v) => v !== 0 && v < 0x4000000;
const toVa = (v) => (isRelative(v) ? IMG + v : v);

const syms = new Map();
try {
  for (const ln of readFileSync("inventory.txt", "utf8").split("\n")) {
    const m = /^SYMBOL\t([0-9a-f]+)\t(\w+)\t(\S+)/.exec(ln);
    if (m && !syms.has("0x" + m[1])) syms.set("0x" + m[1], m[3]);
  }
} catch {
  console.log("(inventory.txt unavailable; entries unnamed)");
}
console.log("symbols loaded: " + syms.size);

function pretty(name) {
  if (!name) return "";
  const m = /^_ZN4sead(\d+)/.exec(name);
  if (!m) return name;
  const cl = Number(m[1]);
  const s = m[0].length;
  const cls = name.slice(s, s + cl);
  const rest = name.slice(s + cl);
  const mm = /^(\d+)([A-Za-z0-9_]+)/.exec(rest);
  return "sead::" + cls + "::" + (mm ? mm[2] : "?");
}

const VTABLES = [
  ["sead::Heap", 0x7102f0ff48],
  ["sead::ExpHeap", 0x7102f0fd10],
  ["sead::HeapMgr", 0x7102f10048],
];

for (const [label, va] of VTABLES) {
  console.log("\n=== " + label + " vtable at 0x" + va.toString(16) + " ===");
  for (let i = 0; i < 34; i++) {
    const slot = va + i * 8;
    if (foff(slot) + 8 > b.length) break;
    const raw = u64(slot);
    // NOTE: these vtables begin with TWO ZERO WORDS, not the GNU ABI's
    // offset-to-top/typeinfo. An earlier version broke out of the loop on the first zero
    // and reported an empty vtable. Skip zeros instead of stopping.
    if (raw === 0) {
      if (i < 2) continue; // leading zeros -- vtable still starts here
      break;              // a zero after real entries ends this vtable
    }
    const target = toVa(raw);
    if (i > 1 && (target < IMG || target > IMG + 0x4000000)) break;
    const name = syms.get("0x" + target.toString(16));
    const offset = (i - 2) * 8;
    const offLabel = i < 2 ? "(zeroword)" : "vptr+0x" + offset.toString(16).padStart(2, "0");
    const mark = (offset === 0x28 || offset === 0x80) ? "   <-- BOOT PATH" : "";
    console.log(
      "  [" + String(i).padStart(2) + "] " + offLabel.padEnd(12) +
      " 0x" + target.toString(16) + "  " + (pretty(name) || name || "(unnamed)") + mark
    );
  }
}

console.log("\n=== the two offsets the boot path reaches ===");
console.log("  vptr+0x80  Heap::getFreeSize   sizes each new system-manager heap");
console.log("  vptr+0x28  Heap::destroy       tears down per-manager heaps");
