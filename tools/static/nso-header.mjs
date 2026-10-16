// Parse an NSO header correctly, then locate and read its .dynsym / .dynstr.
//
// Layout is verified against nso2elf.mjs's own output rather than guessed (three earlier
// attempts at these offsets were wrong). nso2elf reported for 0100000000001001:
//   .text   mem 0x0       size 0x379000
//   .rodata mem 0x379000  size 0xf6f98
//   .rwdata mem 0x470000  size 0x6339c
//   .bss    mem 0x4d4000  size 0x7fc64
import { readFileSync } from "node:fs";

const path = process.argv[2];
const b = readFileSync(path);
const u32 = (o) => b.readUInt32LE(o);
const i32 = (o) => b.readInt32LE(o);

console.log(`file: ${path}  (${b.length} bytes)  magic=${b.toString("latin1", 0, 4)}`);
console.log("\n=== NSO header fields 0x00..0x40 ===");
for (let o = 0; o < 0x40; o += 4) {
  const v = u32(o);
  console.log(`  0x${o.toString(16).padStart(2, "0")}  ${v.toString(16).padStart(8, "0")}  (${i32(o)})`);
}

// Known switchbrew NSO layout:
//   0x10 text file size   0x14 text memory size   0x18 text memory offset (=0)
//   0x1C rodata file size 0x20 rodata memory size 0x24 rodata memory offset
//   0x28 rwdata file size 0x2C rwdata memory size 0x30 rwdata memory offset
//   0x34 bss size
console.log("\n=== interpreted ===");
const HDR = [
  ["text",   0x10, 0x14, 0x18],
  ["rodata", 0x1c, 0x20, 0x24],
  ["rwdata", 0x28, 0x2c, 0x30],
];
for (const [n, fs, ms, mo] of HDR) {
  console.log(`  ${n.padEnd(7)} fileSize=0x${u32(fs).toString(16).padStart(8)} memSize=0x${u32(ms).toString(16).padStart(8)} memOff=0x${u32(mo).toString(16)}`);
}
console.log(`  bss     size=0x${u32(0x34).toString(16)}`);

const textMemSize = u32(0x14);
const rodataFileSize = u32(0x1c);
const rodataMemOff = u32(0x24);

// The converter places section content at file 0x100 onward, packed: .text then .rodata
// then .rwdata. So .text file offset = 0x100, .rodata file offset = 0x100 + textMemSize.
const TEXT_FILE = 0x100;
const RODATA_FILE = TEXT_FILE + textMemSize;
const RWDATA_FILE = RODATA_FILE + rodataFileSize;
console.log(`\n  derived file offsets: .text=0x${TEXT_FILE.toString(16)}  .rodata=0x${RODATA_FILE.toString(16)}  .rwdata=0x${RWDATA_FILE.toString(16)}`);

// MOD0 lives at .text + 0x8 in the FILE (since .text file offset is 0x100).
const MOD0_FILE = TEXT_FILE + 8;
console.log(`\n=== MOD0 at file 0x${MOD0_FILE.toString(16)} ===`);
console.log(`  magic = ${JSON.stringify(b.toString("latin1", MOD0_FILE, MOD0_FILE + 4))}`);
if (b.toString("latin1", MOD0_FILE, MOD0_FILE + 4) !== "MOD0") {
  // try scanning a little, in case .text is preceded by something
  const scan = b.indexOf("MOD0", 0x100);
  console.log(`  first 'MOD0' anywhere after 0x100: ${scan >= 0 ? "0x" + scan.toString(16) : "not found"}`);
}
