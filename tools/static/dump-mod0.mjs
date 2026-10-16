// Dump the MOD0 module struct for a decompressed NSO and validate the export table.
//
// nso2elf.mjs reads strOff at +0x18 and symOff at +0x1c, then 8-byte {addr,
// nameOffset} pairs. It yields 113,150 names for main but garbage for sdk, so compare
// the two structs directly and sanity-check each candidate field.
import { readFileSync } from "node:fs";

const path = process.argv[2] ?? "sdk.decompressed";
const b = readFileSync(path);
const u32 = (o) => b.readUInt32LE(o);
const i32 = (o) => b.readInt32LE(o);
const FILE_BASE = 0x100;
const MOD0 = 0x108;

console.log(`=== ${path} (${b.length} bytes) ===`);
if (b.toString("latin1", MOD0, MOD0 + 4) !== "MOD0") { console.error("no MOD0"); process.exit(1); }

const modOff = u32(MOD0 + 0x18);
console.log(`MOD0 ModuleOffset = 0x${modOff.toString(16)}  (file 0x${(FILE_BASE + modOff).toString(16)})`);

// The struct lives at moduleOffset + 0x8 (per SwitchBrew: the first 8 bytes are
// MOD0's own header, then the module struct follows).
const base = FILE_BASE + modOff;
console.log(`\nbytes at file 0x${base.toString(16)} (module struct candidate):`);
for (let i = 0; i < 14; i++) {
  const o = base + i * 4;
  if (o + 4 > b.length) break;
  console.log(`  +0x${(i * 4).toString(16).padStart(2, "0")}  0x${u32(o).toString(16).padStart(8, "0")}  (int ${i32(o)})`);
}

// Try the layout the converter uses, and also the SwitchBrew layout where the
// struct starts 8 bytes later.
for (const shift of [0, 8]) {
  const s = base + shift;
  const fields = {
    entryTarget: i32(s + 0x10),
    entryOffset: i32(s + 0x14),
    strOff: i32(s + 0x18),
    symOff: i32(s + 0x1c),
  };
  console.log(`\n--- layout shift +0x${shift.toString(16)} ---`);
  for (const [k, v] of Object.entries(fields)) {
    console.log(`  ${k.padEnd(12)} = 0x${(v >>> 0).toString(16)} (${v})`);
  }
  const { strOff, symOff } = fields;
  const strFile = FILE_BASE + strOff;
  const symFile = FILE_BASE + symOff;
  const inRange = strOff > 0 && strOff < b.length && symOff > 0 && symOff + 8 <= b.length;
  console.log(`  strOff in range: ${strOff > 0 && strOff < b.length}, symOff in range: ${symOff > 0 && symOff + 8 <= b.length}`);
  if (!inRange) continue;

  // does the string table start with a NUL and readable text?
  const firstBytes = b.subarray(strFile, strFile + 60);
  console.log(`  strtab[0..60] = ${JSON.stringify(firstBytes.toString("latin1"))}`);
  const printable = firstBytes[0] === 0 && firstBytes[1] >= 0x20 && firstBytes[1] < 0x7f;
  console.log(`  looks like a string table: ${printable}`);

  // first few symbol pairs
  console.log(`  first 6 sym pairs:`);
  for (let i = 0; i < 6; i++) {
    const o = symFile + i * 8;
    if (o + 8 > b.length) break;
    const a = u32(o);
    const n = u32(o + 4);
    let name = "";
    if (n && strFile + n < b.length) {
      let e = strFile + n;
      const lim = Math.min(b.length, e + 120);
      while (e < lim && b[e] !== 0) e++;
      name = b.toString("latin1", strFile + n, e);
    }
    console.log(`    [${i}] addr=0x${a.toString(16)} nameOff=0x${n.toString(16)} name="${name.slice(0, 70)}"`);
  }
}
