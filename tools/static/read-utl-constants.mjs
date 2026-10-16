// Read the cDefault* constants that sead::CalendarTime's constructor uses, plus locate
// the string constants dumpDateTime/dumpMemoryInfo log with.
import { readFileSync } from "node:fs";

const b = readFileSync("main.elf");
const FB = 0x100;
const IMG = 0x7100000000;
const foff = (va) => FB + (va - IMG);
const u32 = (va) => b.readUInt32LE(foff(va));
const u64 = (va) => Number(b.readBigUInt64LE(foff(va)));
const cstr = (va, max = 96) => {
  let e = foff(va);
  const lim = Math.min(b.length, e + max);
  while (e < lim && b[e] !== 0) e++;
  return b.toString("latin1", foff(va), e);
};

console.log("=== cDefault* constants (these are PTR_ symbols; read what they point at) ===");
// The decompiled code passes PTR_cDefaultYear etc. as the ARGUMENTS, i.e. the pointers
// themselves are passed; Ghidra renders it as (int*)PTR_x, so the value is the pointee.
const ptrs = {
  cDefaultYear:   0x7102f9c4a0,
  cDefaultMonth:  0x7102f9c4a8,
  cDefaultDay:    0x7102f9c4b0,
  cDefaultHour:   0x7102f9c4b8,
  cDefaultMinute: 0x7102f9c4c0,
  cDefaultSecond: 0x7102f9c4c8,
};
for (const [name, va] of Object.entries(ptrs)) {
  const target = u64(va);
  let value = "(unresolved)";
  if (target >= IMG && target < IMG + 0x4000000) {
    value = String(u32(target));
  } else {
    value = `0x${target.toString(16)} (not an in-image VA)`;
  }
  console.log(`  ${name.padEnd(14)} @0x${va.toString(16)} -> 0x${target.toString(16)}  value=${value}`);
}

console.log("\n=== string constants used in the two log calls ===");
for (const [name, va] of [["DAT_71027f5c9b", 0x71027f5c9b], ["DAT_7102896165", 0x7102896165]]) {
  console.log(`  ${name} = ${JSON.stringify(cstr(va, 120))}`);
}
