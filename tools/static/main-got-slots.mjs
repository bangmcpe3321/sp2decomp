// Read the GOT slots that main's platform thunks dereference.
//
// Every platform function in main is `(*(code *)PTR_X_7102f9a700)()`. If the static
// image already holds a resolved-looking address in that slot, the mapping to sdk is
// recoverable from the file. If the slots are zero, the loader fills them at runtime
// and the mapping is genuinely unavailable statically.
import { readFileSync } from "node:fs";

const mainPath = process.argv[2] ?? "main.elf";
const b = readFileSync(mainPath);
const FILE_BASE = 0x100;

// Section boundaries in memory (from the NSO header / converted ELF).
const SECTIONS = [
  { name: ".text", start: 0x0, end: 0x1415068 },
  { name: ".rodata", start: 0x1416000, end: 0x2d624b3 },
  { name: ".rwdata", start: 0x2d63000, end: 0x2fdb1b0 },
  { name: ".bss", start: 0x2fdc000, end: 0x3699e50 },
];
const sectionOf = (mem) => SECTIONS.find((s) => mem >= s.start && mem < s.end)?.name ?? "?";

// GOT slots named in PLATFORM_REFERENCE.md, extracted from the thunk bodies.
// Format: [slot VA, imported symbol]
const slots = [
  [0x2f9a700, "GetSystemTick"],
  [0x2f9b518, "AllocateMemoryBlock"],
  [0x2f9b6a8, "QueryMemoryInfo"],
  [0x2f9b6b0, "SetMemoryHeapSize"],
  [0x2f9a33a8, "sInstance"],
  [0x2f9c500, "zero"],
  [0x2f9b6a8, "QueryMemoryInfo(dup)"],
];

console.log("=== GOT slot contents in the static image ===\n");
for (const [va, label] of slots) {
  const off = FILE_BASE + va;
  const sec = sectionOf(va);
  if (off + 8 > b.length) {
    console.log(`  0x${va.toString(16)}  ${sec.padEnd(8)} ${label}  -> BEYOND EOF`);
    continue;
  }
  const v = Number(b.readBigUInt64LE(off));
  const v32 = b.readUInt32LE(off);
  let note = "";
  if (v === 0) note = "  <-- ZERO: loader fills at runtime";
  else if (v > 0x7100000000 && v < 0x7100000000 + 0x4000000) note = "  <-- looks like a VA in main's image";
  else if (v < 0x10000000) note = "  <-- small value (offset-like)";
  else note = "  <-- unexpected";
  console.log(`  0x${va.toString(16)}  ${sec.padEnd(8)} ${label.padEnd(24)} = 0x${v.toString(16).padStart(16, "0")}${note}`);
}

// How many slots in .rwdata are non-zero at all? If the whole region is populated,
// the image is pre-relocated; if sparse, imports are runtime-filled.
console.log("\n=== .rwdata population survey ===");
let nz = 0, z = 0;
const RW_START = 0x2d63000, RW_END = 0x2fdb1b0;
for (let va = RW_START; va + 8 <= RW_END; va += 8) {
  const off = FILE_BASE + va;
  if (off + 8 > b.length) break;
  if (b.readBigUInt64LE(off) === 0n) z++; else nz++;
}
console.log(`  .rwdata 8-byte slots: non-zero=${nz} zero=${z} (${((z / (nz + z)) * 100).toFixed(1)}% zero)`);
