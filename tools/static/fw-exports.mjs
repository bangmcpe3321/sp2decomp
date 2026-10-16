// Parse a firmware NSO's MOD0 / dynamic export structures to recover real symbol names.
//
// The game's `sdk` had a corrupt .symtab in nso2elf's output and a non-standard .dynamic,
// so the structures are probed fresh here rather than assumed:
//   - NSO header, section sizes
//   - MOD0 magic at .text+0x8, and every 32-bit field after it
//   - whether DynamicOffset (MOD0+0x4) points at a plausible ELF .dynamic
import { readFileSync } from "node:fs";

const path = process.argv[2];
const b = readFileSync(path);
const u32 = (o) => b.readUInt32LE(o);
const i32 = (o) => b.readInt32LE(o);
const FILE_BASE = 0x100;

console.log(`file: ${path}  (${b.length} bytes)`);

// ---- NSO header ----
// Per the NSO format:
//   0x10/.text file size   0x14/.text memory size   0x18/.rodata file size
//   0x1C/.rodata memory size  0x20/.rwdata file size  0x24/.rwdata memory size
//   0x28/.bss size
//   0x2C/.text memory offset  0x30/.rodata memory offset  0x34/.rwdata memory offset
// (Two earlier attempts used wrong offsets; verified against the printed values, where
// .text memory offset is 0 and .text file size is 0x379000.)
console.log("\n=== NSO header ===");
console.log(`  magic = ${b.toString("latin1", 0, 4)}`);
const layout = [
  [".text",   0x10, 0x14, 0x2c],
  [".rodata", 0x18, 0x1c, 0x30],
  [".rwdata", 0x20, 0x24, 0x34],
];
for (const [name, fs, ms, mo] of layout) {
  console.log(
    `  ${name.padEnd(8)} fileSize=0x${u32(fs).toString(16).padStart(8)}  ` +
    `memSize=0x${u32(ms).toString(16).padStart(8)}  memOff=0x${u32(mo).toString(16)}`
  );
}
console.log(`  .bss     size=0x${u32(0x28).toString(16)}`);
const textSize = u32(0x10);

// ---- MOD0 ----
const MOD0 = 0x108;
console.log(`\n=== MOD0 at .text+0x8 (file 0x${MOD0.toString(16)}) ===`);
if (b.toString("latin1", MOD0, MOD0 + 4) !== "MOD0") {
  console.log("  magic NOT 'MOD0'");
} else {
  console.log("  magic = MOD0");
  // Dump every field. MOD0 has no fixed public layout across versions, so print all.
  for (let i = 1; i <= 8; i++) {
    const off = MOD0 + i * 4;
    const v = u32(off);
    console.log(`  +0x${(i * 4).toString(16).padStart(2, "0")}  u32=0x${v.toString(16).padStart(8, "0")}  (${i32(off)})`);
  }
  const dynamicOffset = u32(MOD0 + 0x4);
  console.log(`\n  DynamicOffset (MOD0+0x04) = 0x${dynamicOffset.toString(16)}`);
  console.log(`  -> file offset 0x${(FILE_BASE + dynamicOffset).toString(16)}`);

  // Probe it as a .dynamic array: 16-byte {tag, value} pairs.
  const dFile = FILE_BASE + dynamicOffset;
  if (dFile > 0 && dFile + 32 <= b.length) {
    console.log("\n  first 10 .dynamic entries (tag, value):");
    const DT = { 0: "DT_NULL", 4: "DT_HASH", 5: "DT_STRTAB", 6: "DT_SYMTAB", 7: "DT_RELA",
                 8: "DT_RELASZ", 9: "DT_RELAENT", 10: "DT_STRSZ", 11: "DT_SYMENT",
                 23: "DT_JMPREL", 25: "DT_INIT_ARRAY", 27: "DT_INIT_ARRAYSZ" };
    for (let i = 0; i < 10; i++) {
      const o = dFile + i * 16;
      if (o + 16 > b.length) break;
      const tag = Number(b.readBigInt64LE(o));
      const val = Number(b.readBigUInt64LE(o + 8));
      console.log(`    [${i}] tag=${String(tag).padStart(12)} 0x${val.toString(16).padStart(10)}  ${DT[tag] ?? ""}`);
      if (tag === 0) break;
    }
  }
}

// ---- Look for a dense mangled-name string table in .rodata ----
console.log("\n=== mangled-name string table search ===");
const rodataSize = u32(0x14);
const rodataMem = u32(0x18) - rodataSize; // rwdata mem - rodata size = rodata mem (packed)
const rodataFile = FILE_BASE + (u32(0x14 + 4) - 0); // fallback
// derive .rodata memory offset the way the converter does: text, then rodata
const textMem = u32(0x14);
const rodataMemOff = textMem;
console.log(`  .text size 0x${textSize.toString(16)}  (rodata begins at mem 0x${rodataMemOff.toString(16)})`);

const s = b.toString("latin1");
const all = s.match(/_ZN2nn[0-9A-Za-z_]{6,}/g) ?? [];
console.log(`  _ZN2nn* occurrences in file: ${all.length}  distinct: ${new Set(all).size}`);
if (all.length) {
  const sample = [...new Set(all)].slice(0, 12);
  for (const t of sample) console.log(`    ${t.slice(0, 90)}`);
}
const anyMangled = s.match(/_Z[0-9A-Za-z_]{10,}/g) ?? [];
console.log(`  any _Z* mangled strings: ${anyMangled.length}  distinct: ${new Set(anyMangled).size}`);
