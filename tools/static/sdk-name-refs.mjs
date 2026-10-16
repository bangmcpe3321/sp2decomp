// Are the sdk function-name strings referenced by code?
//
// If the dense _ZN2nn name table in .rodata is a real symbol/import table, little or
// no code will reference those strings -- they are data for a loader. If they are
// assertion text, many functions will load their addresses with ADRP+ADD.
//
// Distinguishing these decides whether chasing the table is worthwhile.
import { readFileSync } from "node:fs";

const path = process.argv[2] ?? "sdk.elf";
const b = readFileSync(path);

const TEXT_OFF = 0x1000;
const TEXT_SIZE = 0x2ce04c;
const text = b.subarray(TEXT_OFF, TEXT_OFF + TEXT_SIZE);

// .rodata in the converted ELF
const RODATA_OFF = 0x2d0000;
const RODATA_MEM = 0x2cf000;

// Pick a sample of the dense name strings and get their addresses.
const rd = b.toString("latin1", RODATA_OFF, RODATA_OFF + 0x3bb0e8);
const probes = [];
{
  const re = /_ZN2nn[0-9A-Za-z_]{8,}/g;
  let m;
  while ((m = re.exec(rd)) !== null && probes.length < 200) {
    probes.push({ mem: RODATA_MEM + m.index, name: m[0] });
    re.lastIndex = m.index + m[0].length;
  }
}
console.log(`sampled ${probes.length} name strings from .rodata`);
console.log(`first: 0x${probes[0].mem.toString(16)}  ${probes[0].name}`);

const wanted = new Set(probes.map((p) => p.mem));

// Decode ADRP+ADD pairs across .text and see how many target the sampled strings.
let adrpCount = 0;
let addCount = 0;
let hits = 0;
const hitDetail = [];

for (let i = 0; i + 8 <= text.length; i += 4) {
  const w1 = text.readUInt32LE(i);
  // ADRP: 1 immlo(2) 10000 immhi(19) Rd(5)
  if ((w1 & 0x9f000000) >>> 0 !== 0x90000000) continue;
  adrpCount++;
  const w2 = text.readUInt32LE(i + 4);
  // ADD (immediate, 64-bit): sf=1 op=0 S=0 100010 sh imm12 Rn Rd
  if ((w2 & 0xffc00000) >>> 0 !== 0x91000000) continue;
  addCount++;

  // page address from ADRP
  const immlo = (w1 >>> 29) & 0x3;
  const immhi = (w1 >>> 5) & 0x7ffff;
  let imm = (immhi << 2) | immlo;
  if (imm & (1 << 20)) imm -= 1 << 21;
  const rd1 = w1 & 0x1f;
  const page = (imm << 12) >>> 0;

  const rn = (w2 >>> 5) & 0x1f;
  if (rn !== rd1) continue; // ADD must consume the ADRP result
  const imm12 = (w2 >>> 10) & 0xfff;
  const sh = (w2 >>> 22) & 0x1;
  const target = (page + (sh ? imm12 << 12 : imm12)) >>> 0;

  if (wanted.has(target)) {
    hits++;
    if (hitDetail.length < 10) {
      const p = probes.find((x) => x.mem === target);
      hitDetail.push(`  0x${(i >>> 0).toString(16)} -> 0x${target.toString(16)}  ${p ? p.name.slice(0, 60) : ""}`);
    }
  }
}

console.log(`\nADRP instructions: ${adrpCount}`);
console.log(`ADRP+ADD pairs   : ${addCount}`);
console.log(`pairs targeting a sampled name string: ${hits}`);
if (hitDetail.length) {
  console.log("\nexamples:");
  for (const d of hitDetail) console.log(d);
}

console.log("");
if (hits === 0) {
  console.log("VERDICT: the name strings are NOT referenced by code. They behave like a");
  console.log("         loader-facing symbol table, not assertion text. Chasing the table's");
  console.log("         address mapping is worthwhile.");
} else {
  const pct = ((hits / probes.length) * 100).toFixed(1);
  console.log(`VERDICT: ${pct}% of sampled names are referenced by code, so at least some`);
  console.log("         are assertion/logging text. The table may be mixed.");
}
