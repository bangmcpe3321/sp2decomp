// Second attempt at locating sdk's export symbol table, fixing the false positive.
//
// Round-4 mistake: the string-table walk demanded every token start with `_ZN2nn`, so
// it aborted on the first libc++ name (_ZNSt3__1...) and measured only 41 names over
// 2,110 bytes. The real table is far larger. Correct approach: extend the walk over any
// token that is plausibly a mangled C++ name, then require candidate symbol tables to
// use DISTINCT name offsets -- which alone kills the earlier 88-identical-entry false
// positive.
import { readFileSync, writeFileSync } from "node:fs";

const b = readFileSync("sdk.decompressed");
const FILE_BASE = 0x100;
const u32 = (o) => b.readUInt32LE(o);

const STR_MEM = 0x3cb086;
const STR_FILE = FILE_BASE + STR_MEM;

// --- measure the true extent of the string table -------------------------
// Accept any token that looks like a mangled name; stop at the first long run of
// non-name bytes.
const isPlausibleName = (t) =>
  t.length >= 4 && /^_Z[A-Za-z0-9_]+$/.test(t);

const names = new Map(); // offset -> name
{
  let p = STR_FILE + 1;
  let lastGood = p;
  let misses = 0;
  while (p < b.length && misses < 40) {
    const z = b.indexOf(0, p);
    if (z < 0) break;
    const tok = b.toString("latin1", p, z);
    if (isPlausibleName(tok)) {
      names.set(p - STR_FILE, tok);
      lastGood = z;
      misses = 0;
    } else {
      misses++;
    }
    p = z + 1;
  }
  var STR_END = lastGood;
}
const STR_SIZE = STR_END - STR_FILE + 1;
console.log(`string table: mem 0x${STR_MEM.toString(16)}  size 0x${STR_SIZE.toString(16)} (${STR_SIZE} bytes)`);
console.log(`plausible mangled names in table: ${names.size}`);
const sorted = [...names.keys()].sort((a, c) => a - c);
console.log(`offset range: 0x${sorted[0].toString(16)} .. 0x${sorted[sorted.length - 1].toString(16)}`);

const platCount = [...names.values()].filter((n) => /^_ZN2nn/.test(n)).length;
console.log(`of which _ZN2nn*: ${platCount}`);
console.log(`\nfirst 8 names:`);
for (const off of sorted.slice(0, 8)) console.log(`  +0x${off.toString(16)}  ${names.get(off)}`);

// --- search .rodata for the paired {address, nameOffset} array -----------
const RD_START = FILE_BASE + 0x2cf000;
const RD_END = FILE_BASE + 0x68a0e8;

let best = null;
const MIN_RUN = 50;
for (let off = RD_START; off + 8 <= RD_END; off += 4) {
  const seenOffsets = new Set();
  let i = 0;
  let good = 0;
  const sample = [];
  while (true) {
    const o = off + i * 8;
    if (o + 8 > RD_END) break;
    const a = u32(o);
    const n = u32(o + 4);
    if (a === 0 && n === 0) break;
    if (!names.has(n)) break;
    if (seenOffsets.has(n)) break; // REQUIRE distinct -> kills the false positive
    if (a >= 0x2ce04c) break;
    seenOffsets.add(n);
    good++;
    if (sample.length < 6) sample.push({ a, n });
    i++;
  }
  if (good >= MIN_RUN && (!best || good > best.good)) best = { off, good, sample };
}

if (!best) {
  console.log(`\nNo run of >= ${MIN_RUN} DISTINCT valid {addr, nameOffset} pairs in .rodata.`);
  process.exit(0);
}

const mem = best.off - FILE_BASE;
console.log(`\n*** FOUND: symbol table at mem 0x${mem.toString(16)} with ${best.good} distinct entries ***`);
for (const e of best.sample) {
  console.log(`  addr=0x${e.a.toString(16)}  nameOff=0x${e.n.toString(16)}  ${names.get(e.n)}`);
}

// emit the whole table
const out = [];
for (let i = 0; i < best.good; i++) {
  const o = best.off + i * 8;
  out.push(`0x${u32(o).toString(16)}\t${names.get(u32(o + 4))}`);
}
writeFileSync("sdk-exports-real.txt", out.join("\n") + "\n");
console.log(`\nwrote sdk-exports-real.txt (${out.length} exports)`);
const plat = out.filter((l) => /_ZN2nn(2os|3mem|4init|2vi|2fs|4time|4diag|4util|4nifm|2oe)/.test(l));
console.log(`platform-namespace exports: ${plat.length}`);
for (const p of plat.slice(0, 30)) console.log(`  ${p}`);
