// Locate sdk's real MOD0 export symbol table.
//
// Established: the export STRING table is at memory 0x3cb086 (file 0x3cb186), a dense
// run of NUL-separated _ZN2nn names. nso2elf.mjs instead uses ModuleOffset (0x6bf5b8,
// a zeroed struct) as strOff and garbage as symOff, which is why its .symtab is
// corrupt.
//
// This searches .rodata for the paired symbol table: 8-byte {address, nameOffset}
// entries whose nameOffset lands on a string start inside that table.
import { readFileSync } from "node:fs";

const b = readFileSync("sdk.decompressed");
const FILE_BASE = 0x100;
const u32 = (o) => b.readUInt32LE(o);

const STR_MEM = 0x3cb086;
const STR_FILE = FILE_BASE + STR_MEM;
// The string table runs until the next non-_ZN2nn block; find its end.
let strEnd = STR_FILE;
while (strEnd < b.length && b[strEnd] !== 0) strEnd++;
{
  // walk NUL-separated tokens while they start with _ZN2nn
  let p = STR_FILE + 1;
  let last = p;
  while (p < b.length) {
    const z = b.indexOf(0, p);
    if (z < 0) break;
    const tok = b.toString("latin1", p, z);
    if (!/^_ZN2nn/.test(tok)) break;
    last = z;
    p = z + 1;
  }
  strEnd = last;
}
const STR_SIZE = strEnd - STR_FILE + 1;
console.log(`export string table: mem 0x${STR_MEM.toString(16)}  size ~0x${STR_SIZE.toString(16)} (${STR_SIZE} bytes)`);

// Build the set of valid string-start offsets within the table.
const stringOffsets = new Set();
{
  let p = STR_FILE + 1;
  while (p < strEnd) {
    const z = b.indexOf(0, p);
    if (z < 0) break;
    stringOffsets.add(p - STR_FILE);
    p = z + 1;
  }
}
console.log(`distinct names in table: ${stringOffsets.size}`);

// Sanity check: the name offset of _ZN2nn2os13GetSystemTickEv should be 1.
console.log(`offset of first name = ${[...stringOffsets].sort((a, c) => a - c)[0]}`);

// Search .rodata (mem 0x2cf000..0x68a0e8) for a run of {addr, nameOffset} pairs.
const RD_MEM_START = 0x2cf000;
const RD_MEM_END = 0x68a0e8;
const RD_START = FILE_BASE + RD_MEM_START;
const RD_END = FILE_BASE + RD_MEM_END;

let best = null;
const MIN_RUN = 20;
for (let off = RD_START; off + 8 <= RD_END; off += 4) {
  // does a run start here?
  let i = 0;
  let good = 0;
  const addrs = [];
  while (true) {
    const o = off + i * 8;
    if (o + 8 > RD_END) break;
    const a = u32(o);
    const n = u32(o + 4);
    if (n === 0 && a === 0) break;
    if (!stringOffsets.has(n)) break;
    if (a >= 0x2ce04c) break; // must point into .text
    good++;
    if (addrs.length < 5) addrs.push({ a, n });
    i++;
  }
  if (good >= MIN_RUN && (!best || good > best.good)) {
    best = { off, good, addrs };
  }
  if (best && best.good > 500) break;
}

if (!best) {
  console.log(`\nNo run of >= ${MIN_RUN} valid {addr, nameOffset} pairs found in .rodata.`);
} else {
  const mem = best.off - FILE_BASE;
  console.log(`\nBEST RUN: mem 0x${mem.toString(16)} with ${best.good} valid entries`);
  for (const e of best.addrs) {
    const name = (() => {
      let s = STR_FILE + e.n;
      let z = b.indexOf(0, s);
      return b.toString("latin1", s, z);
    })();
    console.log(`  addr=0x${e.a.toString(16)} nameOff=0x${e.n.toString(16)}  ${name}`);
  }
  // Emit the full table
  const out = [];
  for (let i = 0; i < best.good; i++) {
    const o = best.off + i * 8;
    const a = u32(o);
    const n = u32(o + 4);
    let s = STR_FILE + n;
    let z = b.indexOf(0, s);
    out.push(`0x${a.toString(16)}\t0x${(0x2ce04c > a ? a : a).toString(16)}\t${b.toString("latin1", s, z)}`);
  }
  const fs = await import("node:fs");
  fs.writeFileSync("sdk-exports-real.txt", out.join("\n") + "\n");
  console.log(`\nwrote sdk-exports-real.txt (${out.length} exports)`);

  const plat = out.filter((l) => /_ZN2nn(2os|3mem|4init|2vi|2fs|4time|4diag|4util|4nifm|2oe)/.test(l));
  console.log(`platform-namespace exports: ${plat.length}`);
  for (const p of plat.slice(0, 25)) console.log(`  ${p}`);
}
