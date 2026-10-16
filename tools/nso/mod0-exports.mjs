// Parse the NSO/MOD0 module export table.
//
// MOD0 lives at .text+0x8. Its offsets are relative to the .text section, whose
// content starts at file offset 0x100 in the decompressed image (the 0x100-byte
// NSO header precedes it). This yields the module's exported function names --
// the same names the Switch loader installs into an analysis database.
import { readFileSync, writeFileSync } from "node:fs";

const inPath = process.argv[2] ?? "main.elf";
const outPath = process.argv[3] ?? "mod0-exports.tsv";
const b = readFileSync(inPath);

const u32 = (o) => b.readUInt32LE(o);
const s32 = (o) => b.readInt32LE(o);

const MOD0_FILE = 0x108; // .text + 0x8
const TEXT_FILE_BASE = 0x100;
const TEXT_SIZE = 0x1415068;
const TEXT_VA = 0x0;

if (b.toString("latin1", MOD0_FILE, MOD0_FILE + 4) !== "MOD0") {
  console.error("error: no MOD0 magic at .text+0x8");
  process.exit(1);
}

const entryTarget = s32(MOD0_FILE + 0x10);
const entryOffset = s32(MOD0_FILE + 0x14);
// Field order in this build: the name-table offset precedes the symbol-table
// offset. 0x2fda468 is the value that maps onto the observed name table; using
// the neighbouring value lands 0x1b70 bytes past its start.
const strOff = s32(MOD0_FILE + 0x0c);
const symOff = s32(MOD0_FILE + 0x04);

const toFile = (textRel) => {
  if (textRel >= 0 && textRel < TEXT_SIZE) return TEXT_FILE_BASE + textRel;
  // Offsets beyond .text land in the following sections, which in this image are
  // contiguous with their memory addresses, so add the same header allowance.
  return TEXT_FILE_BASE + textRel;
};

const strFile = toFile(strOff);
const symFile = toFile(symOff);

console.log(`MOD0 at VA 0x${(MOD0_FILE - TEXT_FILE_BASE).toString(16)} (file 0x${MOD0_FILE.toString(16)})`);
console.log(`  entryTarget = 0x${entryTarget.toString(16)}`);
console.log(`  entryOffset = 0x${entryOffset.toString(16)}`);
console.log(`  entry VA    = 0x${(entryTarget + entryOffset).toString(16)}`);
console.log(`  strOff      = 0x${strOff.toString(16)} -> file 0x${strFile.toString(16)}`);
console.log(`  symOff      = 0x${symOff.toString(16)} -> file 0x${symFile.toString(16)}`);

const readCStr = (fileOff, cap = 1024) => {
  let end = fileOff;
  const limit = Math.min(b.length, fileOff + cap);
  while (end < limit && b[end] !== 0) end++;
  return b.toString("latin1", fileOff, end);
};

const rows = [];
let truncated = false;
const MAX = 200000;
for (let i = 0; i < MAX; i++) {
  const o = symFile + i * 8;
  if (o + 8 > b.length) break;
  const addr = u32(o);
  const nameOff = u32(o + 4);
  if (addr === 0 && nameOff === 0) break;
  const nameFile = strFile + nameOff;
  if (nameFile >= b.length) {
    truncated = true;
    break;
  }
  const name = readCStr(nameFile);
  if (name.length === 0) continue;
  rows.push({ i, addr: TEXT_VA + addr, name });
}

console.log(`\nexported functions: ${rows.length}${truncated ? " (walk truncated)" : ""}`);
console.log("first 25:");
for (const r of rows.slice(0, 25)) console.log(`  0x${r.addr.toString(16)}\t${r.name.slice(0, 110)}`);

const lines = ["index\tva\tname"];
for (const r of rows) lines.push(`${r.i}\t0x${r.addr.toString(16)}\t${r.name}`);
writeFileSync(outPath, lines.join("\n") + "\n");
console.log(`\nwrote ${outPath}`);

// Namespace summary over the exports
const ns = new Map();
for (const r of rows) {
  const m = /^_ZN(\d+)/.exec(r.name);
  let key = r.name.startsWith("_Z") ? "<mangled>" : "<plain>";
  if (m) {
    const len = Number(m[1]);
    key = r.name.slice(m[0].length, m[0].length + len);
  }
  ns.set(key, (ns.get(key) || 0) + 1);
}
console.log("\ntop namespaces among exports:");
for (const [k, v] of [...ns.entries()].sort((a, c) => c[1] - a[1]).slice(0, 15)) {
  console.log(`  ${String(v).padStart(5)}  ${k}`);
}
