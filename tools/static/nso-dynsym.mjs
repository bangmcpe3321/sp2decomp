// Parse MOD0 and its .dynamic to recover .dynsym / .dynstr, using offsets verified
// against the raw header dump:
//   0x18 .text file size      0x10 .text memory size      0x14 .text memory offset (0)
//   0x28 .rodata file size    0x1c .rodata memory size    0x24 .rodata memory offset
//   0x38 .rwdata file size    0x2c .rwdata memory size    0x30 .rwdata memory offset
//   0x3c .bss size
// and MOD0 at file 0x379168 (memory 0x379068), i.e. .text + 0x378F68.
//
// File offsets: content is packed from 0x100 in memory order, so
//   file = 0x100 + (memAddr - 0)
import { readFileSync } from "node:fs";

const path = process.argv[2];
const b = readFileSync(path);
const u32 = (o) => b.readUInt32LE(o);
const i32 = (o) => b.readInt32LE(o);
const FILE = (mem) => 0x100 + mem;

const textMemSize = u32(0x10);
const textMemOff = u32(0x14);
const modOffInText = 0x378F68; // MOD0 location within .text, from the scan
const MOD0 = FILE(textMemOff + modOffInText);

console.log(`MOD0 at file 0x${MOD0.toString(16)}  magic=${JSON.stringify(b.toString("latin1", MOD0, MOD0 + 4))}`);
console.log("\nMOD0 fields:");
const NAMES = ["magic", "dynamicOffset", "bssStartOffset", "bssEndOffset",
               "exceptionInfoStart", "exceptionInfoEnd", "moduleOffset", "unused"];
const mod = {};
for (let i = 0; i < 8; i++) {
  const o = MOD0 + i * 4;
  const v = u32(o);
  mod[NAMES[i]] = v;
  console.log(`  +0x${(i * 4).toString(16).padStart(2, "0")}  ${NAMES[i].padEnd(20)} = 0x${v.toString(16)}`);
}

// .dynamic sits at dynamicOffset (a memory address).
const dynFile = FILE(mod.dynamicOffset);
console.log(`\n=== .dynamic at mem 0x${mod.dynamicOffset.toString(16)} (file 0x${dynFile.toString(16)}) ===`);
const DT = { 0: "DT_NULL", 1: "DT_NEEDED", 2: "DT_PLTRELSZ", 3: "DT_PLTGOT", 4: "DT_HASH",
             5: "DT_STRTAB", 6: "DT_SYMTAB", 7: "DT_RELA", 8: "DT_RELASZ", 9: "DT_RELAENT",
             10: "DT_STRSZ", 11: "DT_SYMENT", 12: "DT_INIT", 13: "DT_FINI", 23: "DT_JMPREL",
             25: "DT_INIT_ARRAY", 27: "DT_INIT_ARRAYSZ", 0x6ffffff9: "DT_RELACOUNT",
             0x6ffffffb: "DT_FLAGS_1" };
const dyn = {};
for (let i = 0; i < 40; i++) {
  const o = dynFile + i * 16;
  if (o + 16 > b.length) break;
  const tag = Number(b.readBigInt64LE(o));
  const val = Number(b.readBigUInt64LE(o + 8));
  const known = DT[tag];
  console.log(`  [${i}] tag=${String(tag).padStart(12)}  0x${val.toString(16).padStart(12)}  ${known ?? ""}`);
  if (known) dyn[known] = val;
  if (tag === 0) break;
}

if (!dyn.DT_SYMTAB || !dyn.DT_STRTAB) {
  console.log("\nNo DT_SYMTAB / DT_STRTAB found in .dynamic.");
  process.exit(0);
}

// Walk the symbol table.
console.log(`\n=== symbols ===`);
console.log(`  DT_SYMTAB=0x${dyn.DT_SYMTAB.toString(16)}  DT_STRTAB=0x${dyn.DT_STRTAB.toString(16)}  DT_STRSZ=${dyn.DT_STRSZ ?? "?"}`);
const strBase = FILE(dyn.DT_STRTAB);
const symBase = FILE(dyn.DT_SYMTAB);
const strSz = dyn.DT_STRSZ ?? 0x20000;

const readStr = (off) => {
  let e = strBase + off;
  const lim = Math.min(b.length, e + 2048);
  while (e < lim && b[e] !== 0) e++;
  return b.toString("latin1", strBase + off, e);
};

const count = Math.floor((dyn.DT_STRTAB - dyn.DT_SYMTAB) / 24) || 0;
console.log(`  derived symbol count = ${count}`);
let named = 0;
const plat = [];
for (let i = 0; i < count; i++) {
  const o = symBase + i * 24;
  if (o + 24 > b.length) break;
  const stName = u32(o);
  const stValue = u32(o + 8);
  if (!stName) continue;
  const nm = readStr(stName);
  if (!nm) continue;
  named++;
  if (/^_ZN2nn/.test(nm)) plat.push({ value: stValue, name: nm });
  if (named <= 10) console.log(`    [${i}] value=0x${stValue.toString(16)}  ${nm.slice(0, 80)}`);
}
console.log(`\n  named symbols: ${named}`);
console.log(`  platform (_ZN2nn*) symbols: ${plat.length}`);
for (const p of plat.slice(0, 25)) console.log(`    0x${p.value.toString(16).padStart(8)}  ${p.name}`);
