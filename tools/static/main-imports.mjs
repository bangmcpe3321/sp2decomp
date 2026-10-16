// Resolve what main actually imports for its platform functions.
//
// Each platform function in main is a thunk: `(*(code *)PTR_X_7102f9a700)()`. The
// pointer lives in .rwdata and is filled at load time, so the static file must record
// the import as a relocation against a symbol name. This script finds those
// relocations and reads the symbol names, which is the authoritative import list.
import { readFileSync, writeFileSync } from "node:fs";

const elfPath = process.argv[2] ?? "main.converted.elf";
const outPath = process.argv[3] ?? "main-imports.txt";

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
const S = {};
for (let i = 0; i < shnum; i++) {
  const o = shoff + i * shentsize;
  S[nm(b.readUInt32LE(o))] = {
    type: b.readUInt32LE(o + 4),
    addr: Number(b.readBigUInt64LE(o + 16)),
    off: Number(b.readBigUInt64LE(o + 24)),
    size: Number(b.readBigUInt64LE(o + 32)),
    link: b.readUInt32LE(o + 40),
    entsize: Number(b.readBigUInt64LE(o + 56)),
  };
}
console.log("sections of interest:");
for (const k of Object.keys(S)) {
  if (/rela|dynsym|dynstr|got|plt/.test(k)) {
    const s = S[k];
    console.log(`  ${k.padEnd(16)} off=0x${s.off.toString(16)} size=0x${s.size.toString(16)} entsize=${s.entsize}`);
  }
}

// --- dynsym / dynstr -----------------------------------------------------
function readSymtab(symSec, strSec) {
  if (!symSec || !strSec) return [];
  const entsize = symSec.entsize || 24;
  const n = Math.floor(symSec.size / entsize);
  const readStr = (off) => {
    let e = strSec.off + off;
    const lim = Math.min(b.length, e + 4096);
    while (e < lim && b[e] !== 0) e++;
    return b.toString("latin1", strSec.off + off, e);
  };
  const out = [];
  for (let i = 0; i < n; i++) {
    const o = symSec.off + i * entsize;
    if (o + 24 > b.length) break;
    const stName = b.readUInt32LE(o);
    const stValue = Number(b.readBigUInt64LE(o + 8));
    out.push({ i, name: stName ? readStr(stName) : "", value: stValue });
  }
  return out;
}
const dynsym = readSymtab(S[".dynsym"], S[".dynstr"]);
console.log(`\n.dynsym entries: ${dynsym.length}`);
const named = dynsym.filter((s) => s.name);
console.log(`named: ${named.length}`);
const plat = named.filter((s) => /^_ZN2nn(2os|3mem|4init|2vi|2fs|4time|4diag|4util|4nifm|2oe)/.test(s.name));
console.log(`platform-namespace dynsym names: ${plat.length}`);
for (const s of plat.slice(0, 25)) console.log(`  [${s.i}] value=0x${s.value.toString(16)}  ${s.name}`);

// --- relocations: which symbol is each platform import? ------------------
const RELA = S[".rela.plt"] ?? S[".rela.dyn"];
if (RELA) {
  console.log(`\nscanning ${RELA === S[".rela.plt"] ? ".rela.plt" : ".rela.dyn"} (${Math.floor(RELA.size / 24)} entries)`);
  const entries = [];
  const n = Math.floor(RELA.size / 24);
  for (let i = 0; i < n; i++) {
    const o = RELA.off + i * 24;
    if (o + 24 > b.length) break;
    const rOffset = Number(b.readBigUInt64LE(o));
    const rInfo = Number(b.readBigUInt64LE(o + 8));
    const rAddend = Number(b.readBigUInt64LE(o + 16));
    const symIdx = Math.floor(rInfo / 0x100000000);
    const rType = rInfo % 0x100000000;
    const sym = dynsym[symIdx];
    if (sym && sym.name) entries.push({ rOffset, rType, rAddend, symIdx, name: sym.name });
  }
  console.log(`  relocations with a named symbol: ${entries.length}`);
  const platRel = entries.filter((e) => /^_ZN2nn/.test(e.name));
  console.log(`  platform (_ZN2nn*) relocations: ${platRel.length}`);
  for (const e of platRel.slice(0, 30)) {
    console.log(`    slot=0x${e.rOffset.toString(16)} type=${e.rType} addend=0x${e.rAddend.toString(16)} ${e.name}`);
  }
  writeFileSync(outPath, entries.map((e) => `0x${e.rOffset.toString(16)}\t${e.rType}\t0x${e.rAddend.toString(16)}\t${e.name}`).join("\n") + "\n");
  console.log(`\nwrote ${outPath} (${entries.length} named relocations)`);
} else {
  console.log("\nno .rela.plt / .rela.dyn");
  writeFileSync(outPath, plat.map((s) => `0x${s.value.toString(16)}\t${s.name}`).join("\n") + "\n");
}
