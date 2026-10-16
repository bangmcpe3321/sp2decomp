// Parse the .symtab/.strtab that nso2elf.mjs emits from the module's MOD0 exports.
//
// This is the name -> address map for the module's own exports, which is more
// useful than searching .rodata for mangled text.
import { readFileSync, writeFileSync } from "node:fs";

const elfPath = process.argv[2] ?? "sdk.elf";
const outPath = process.argv[3] ?? "sdk-symtab.txt";

const b = readFileSync(elfPath);

// --- section headers -----------------------------------------------------
const shoff = Number(b.readBigUInt64LE(40));
const shentsize = b.readUInt16LE(58);
const shnum = b.readUInt16LE(60);
const shstrndx = b.readUInt16LE(62);
const shstrOff = Number(b.readBigUInt64LE(shoff + shstrndx * shentsize + 24));
const nm = (n) => {
  let e = shstrOff + n;
  while (e < b.length && b[e] !== 0) e++;
  return b.toString("latin1", shstrOff + n, e);
};
const secs = {};
for (let i = 0; i < shnum; i++) {
  const o = shoff + i * shentsize;
  const name = nm(b.readUInt32LE(o));
  secs[name] = {
    type: b.readUInt32LE(o + 4),
    addr: Number(b.readBigUInt64LE(o + 16)),
    off: Number(b.readBigUInt64LE(o + 24)),
    size: Number(b.readBigUInt64LE(o + 32)),
    link: b.readUInt32LE(o + 40),
    entsize: Number(b.readBigUInt64LE(o + 56)),
  };
}

const sym = secs[".symtab"];
const str = secs[".strtab"];
if (!sym || !str) {
  console.error("no .symtab/.strtab present");
  process.exit(1);
}
console.log(`.symtab : off=0x${sym.off.toString(16)} size=${sym.size} entsize=${sym.entsize}`);
console.log(`.strtab : off=0x${str.off.toString(16)} size=${str.size}`);

const entsize = sym.entsize || 24;
const count = Math.floor(sym.size / entsize);
console.log(`symbol entries: ${count}`);

const readStr = (off) => {
  let e = str.off + off;
  const lim = Math.min(b.length, e + 2048);
  while (e < lim && b[e] !== 0) e++;
  return b.toString("latin1", str.off + off, e);
};

const syms = [];
for (let i = 0; i < count; i++) {
  const o = sym.off + i * entsize;
  if (o + 24 > b.length) break;
  const stName = b.readUInt32LE(o);
  const stInfo = b[o + 4];
  const stShndx = b.readUInt16LE(o + 6);
  const stValue = Number(b.readBigUInt64LE(o + 8));
  const stSize = Number(b.readBigUInt64LE(o + 16));
  const name = stName ? readStr(stName) : "";
  syms.push({ name, value: stValue, size: stSize, info: stInfo, shndx: stShndx });
}

const named = syms.filter((s) => s.name);
console.log(`named symbols: ${named.length}`);
console.log("\nfirst 12:");
for (const s of named.slice(0, 12)) console.log(`  0x${s.value.toString(16)}  size=${s.size}  ${s.name}`);

// Are MOD0 export names mangled C++ or plain?
const mangled = named.filter((s) => s.name.startsWith("_Z"));
console.log(`\nmangled (_Z...) : ${mangled.length}`);
console.log(`plain           : ${named.length - mangled.length}`);
console.log("\nsample plain names:");
for (const s of named.filter((s) => !s.name.startsWith("_Z")).slice(0, 15)) {
  console.log(`  0x${s.value.toString(16)}  ${s.name}`);
}

// platform namespace in the export set?
const plat = named.filter((s) => /^_ZN2nn(2os|3mem|4init|2vi|2fs|4time|4diag|4util|4nifm|2oe)/.test(s.name));
console.log(`\nplatform-namespace exports: ${plat.length}`);
for (const s of plat.slice(0, 25)) console.log(`  0x${s.value.toString(16)}  ${s.name}`);

writeFileSync(outPath, syms.filter((s) => s.name).map((s) => `0x${s.value.toString(16)}\t${s.size}\t${s.name}`).join("\n") + "\n");
console.log(`\nwrote ${outPath} (${named.length} symbols)`);
