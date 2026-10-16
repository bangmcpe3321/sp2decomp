// Extract the sdk MOD0 export table: real name -> address pairs.
//
// MOD0 at .text+0x8 gives ModuleOffset, whose struct carries a string-table offset
// and a symbol-table offset. That table is the module's own export map, so it gives
// genuine names for at least some functions -- unlike the mangled strings scattered
// through .rodata, which are just text.
//
// The field layout of the sdk's ModuleOffset struct must be probed: on `main` the
// name-table offset was at +0x0c and the symbol-table offset at +0x04.
import { readFileSync, writeFileSync } from "node:fs";

const inPath = process.argv[2] ?? "sdk.decompressed";
const outPath = process.argv[3] ?? "sdk-exports.txt";

const b = readFileSync(inPath);
const u32 = (o) => b.readUInt32LE(o);

const FILE_BASE = 0x100;
const MOD0 = 0x108;
if (b.toString("latin1", MOD0, MOD0 + 4) !== "MOD0") {
  console.error("no MOD0 magic at .text+0x8");
  process.exit(1);
}

const moduleOffset = u32(MOD0 + 0x18);
console.log(`MOD0 ModuleOffset = 0x${moduleOffset.toString(16)}`);

// Dump the candidate struct so the field layout is visible rather than assumed.
const modFile = FILE_BASE + moduleOffset;
console.log(`\nbytes at module struct (file 0x${modFile.toString(16)}):`);
for (let i = 0; i < 8; i++) {
  const o = modFile + i * 4;
  if (o + 4 > b.length) break;
  console.log(`  +0x${(i * 4).toString(16).padStart(2, "0")}  0x${u32(o).toString(16)}`);
}

// Probe both plausible layouts: (strOff, symOff) = (+0x0c, +0x04) and (+0x04, +0x08).
const layouts = [
  { name: "str@0x0c sym@0x04", str: 0x0c, sym: 0x04 },
  { name: "str@0x08 sym@0x04", str: 0x08, sym: 0x04 },
  { name: "str@0x04 sym@0x08", str: 0x04, sym: 0x08 },
  { name: "str@0x10 sym@0x0c", str: 0x10, sym: 0x0c },
];

function tryLayout(L) {
  const strOff = u32(modFile + L.str);
  const symOff = u32(modFile + L.sym);
  if (strOff === 0 || symOff === 0) return null;
  const strFile = FILE_BASE + strOff;
  const symFile = FILE_BASE + symOff;
  if (strFile >= b.length || symFile + 8 > b.length) return null;
  // a valid string table starts with a NUL and contains printable text
  const first = b[strFile];
  const printable = b[strFile + 1] >= 0x20 && b[strFile + 1] < 0x7f;
  if (first !== 0 || !printable) return null;
  const entries = [];
  for (let i = 0; i < 4000; i++) {
    const o = symFile + i * 8;
    if (o + 8 > b.length) break;
    const value = u32(o);
    const nameOff = u32(o + 4);
    if (value === 0 && nameOff === 0) break;
    const no = strFile + nameOff;
    if (no >= b.length || nameOff === 0) continue;
    let e = no;
    const lim = Math.min(b.length, no + 300);
    while (e < lim && b[e] !== 0) e++;
    const nm = b.toString("latin1", no, e);
    if (!nm) continue;
    entries.push({ value, name: nm });
  }
  return { strOff, symOff, entries };
}

let best = null;
for (const L of layouts) {
  const r = tryLayout(L);
  console.log(`\nlayout ${L.name}: ${r ? `${r.entries.length} entries` : "invalid"}`);
  if (r && r.entries.length > 0) {
    for (const e of r.entries.slice(0, 5)) console.log(`   0x${e.value.toString(16)}  ${e.name.slice(0, 80)}`);
    if (!best || r.entries.length > best.entries.length) best = { ...L, ...r };
  }
}

if (!best || best.entries.length === 0) {
  console.log("\nNo layout produced exports.");
  process.exit(0);
}

console.log(`\n=== best layout: ${best.name} with ${best.entries.length} exports ===`);
const plat = best.entries.filter((e) => /^_ZN2nn(2os|3mem|4init|2vi|2fs|4time|4diag|4util|4nifm|2oe)/.test(e.name));
console.log(`platform-namespace exports: ${plat.length}`);
for (const e of plat.slice(0, 30)) console.log(`   0x${e.value.toString(16)}  ${e.name}`);

writeFileSync(outPath, best.entries.map((e) => `0x${e.value.toString(16)}\t${e.name}`).join("\n") + "\n");
console.log(`\nwrote ${outPath} (${best.entries.length} exports)`);
