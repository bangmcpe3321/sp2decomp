// Validate sdk.elf's .symtab against its own .strtab.
//
// Round-3 finding: sdk.elf has a 368-entry .symtab but the names are fragments. This
// checks whether the st_name offsets are even in range, and whether they look like
// string-table offsets at all -- which distinguishes "wrong string base" from "wrong
// symbol table entirely".
import { readFileSync } from "node:fs";

const b = readFileSync("sdk.elf");
const S = {};
const shoff = Number(b.readBigUInt64LE(40));
const se = b.readUInt16LE(58);
const sn = b.readUInt16LE(60);
const sx = b.readUInt16LE(62);
const so = Number(b.readBigUInt64LE(shoff + sx * se + 24));
const nm = (n) => {
  let e = so + n;
  while (e < b.length && b[e] !== 0) e++;
  return b.toString("latin1", so + n, e);
};
for (let i = 0; i < sn; i++) {
  const o = shoff + i * se;
  S[nm(b.readUInt32LE(o))] = {
    off: Number(b.readBigUInt64LE(o + 24)),
    size: Number(b.readBigUInt64LE(o + 32)),
  };
}
const sym = S[".symtab"];
const str = S[".strtab"];
console.log(`.symtab off=0x${sym.off.toString(16)} size=${sym.size} entries=${sym.size / 24}`);
console.log(`.strtab off=0x${str.off.toString(16)} size=${str.size}`);

const strPayload = b.toString("latin1", str.off, str.off + str.size);
console.log(`\n.strtab begins with: ${JSON.stringify(strPayload.slice(0, 80))}`);

let inRange = 0, outOfRange = 0, mangled = 0, fragments = 0;
const rows = [];
const n = sym.size / 24;
for (let i = 0; i < n; i++) {
  const o = sym.off + i * 24;
  const stName = b.readUInt32LE(o);
  const stValue = Number(b.readBigUInt64LE(o + 8));
  if (stName === 0) continue;
  if (stName >= str.size) { outOfRange++; continue; }
  inRange++;
  let e = str.off + stName;
  const lim = Math.min(b.length, e + 220);
  while (e < lim && b[e] !== 0) e++;
  const name = b.toString("latin1", str.off + stName, e);
  if (/^_Z/.test(name)) mangled++; else fragments++;
  if (rows.length < 12) rows.push({ i, stName, stValue, name });
}

console.log(`\nst_name in range: ${inRange}, out of range: ${outOfRange}`);
console.log(`names starting _Z: ${mangled}   other: ${fragments}`);
console.log(`\nfirst 12 entries:`);
for (const r of rows) {
  console.log(`  [${r.i}] stName=0x${r.stName.toString(16)} stValue=0x${r.stValue.toString(16)} "${r.name.slice(0, 70)}"`);
}

// Are st_name values monotonically increasing (a real string table walk)?
const offs = rows.map((r) => r.stName);
console.log(`\nst_name sequence: ${offs.map((o) => o.toString(16)).join(", ")}`);
let mono = true;
for (let i = 1; i < offs.length; i++) if (offs[i] < offs[i - 1]) mono = false;
console.log(`monotonic: ${mono}`);

// Are st_value values plausible code addresses?
const vals = rows.map((r) => r.stValue);
console.log(`st_value sequence: ${vals.map((v) => "0x" + v.toString(16)).join(", ")}`);
const plausible = vals.filter((v) => v < 0x2ce04c).length;
console.log(`st_value within .text (0..0x2ce04c): ${plausible}/${vals.length}`);
