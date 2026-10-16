// Extract the .dynsym/.dynstr symbol table from a decompressed sdk NSO.
//
// The NSO's MOD0 header gives DynamicOffset; the ELF-compatibility .dynamic block
// at that offset carries DT_SYMTAB / DT_STRTAB / DT_HASH. From those, the symbol
// table yields address -> name, which lets a decompiler show
// `nn::os::QueryMemoryInfo` instead of `FUN_00001234`.
import { readFileSync, writeFileSync } from "node:fs";

const inPath = process.argv[2] ?? "sdk.decompressed";
const outPath = process.argv[3] ?? "sdk-symbols.txt";

const b = readFileSync(inPath);
const u32 = (o) => b.readUInt32LE(o);
const s32 = (o) => b.readInt32LE(o);

// NSO header: content starts at file offset 0x100, and section memory offsets map
// to the flat image as file = 0x100 + memOff.
const FILE_BASE = 0x100;
const toFile = (va) => FILE_BASE + va;

console.log("=== NSO header ===");
const TEXT_SIZE = u32(0x18);
const MOD0 = 0x108; // .text + 0x8
console.log(`  moduleOffset(0x64) = 0x${u32(0x64).toString(16)}`);
console.log(`  .text size         = 0x${TEXT_SIZE.toString(16)}`);
if (b.toString("latin1", MOD0, MOD0 + 4) !== "MOD0") {
  console.error("  MOD0 magic not at .text+0x8 — aborting");
  process.exit(1);
}
const dynamicOffset = u32(MOD0 + 0x4);
console.log(`  MOD0 DynamicOffset = 0x${dynamicOffset.toString(16)}`);

// --- read .dynamic -------------------------------------------------------
const DT = {
  4: "DT_HASH", 5: "DT_STRTAB", 6: "DT_SYMTAB", 10: "DT_STRSZ", 11: "DT_SYMENT",
};
const dyn = {};
for (let i = 0; i < 128; i++) {
  const o = toFile(dynamicOffset) + i * 16;
  if (o + 16 > b.length) break;
  const tag = Number(b.readBigInt64LE(o));
  const val = Number(b.readBigUInt64LE(o + 8));
  if (tag === 0) break;
  const name = DT[tag];
  if (name) {
    dyn[name] = val;
    console.log(`  ${name.padEnd(12)} = 0x${val.toString(16)}`);
  }
}

if (!dyn.DT_SYMTAB || !dyn.DT_STRTAB) {
  console.error("  DT_SYMTAB / DT_STRTAB not found — aborting");
  process.exit(1);
}

// --- symbol count via DT_HASH -------------------------------------------
let symCount = null;
if (dyn.DT_HASH) {
  const hf = toFile(dyn.DT_HASH);
  if (hf + 8 <= b.length) {
    const nchain = u32(hf + 4);
    symCount = nchain;
    console.log(`  DT_HASH nchain   = ${nchain} (symbol count)`);
  }
}
if (!symCount) {
  // fall back: derive from the distance to the string table
  symCount = Math.floor((dyn.DT_STRTAB - dyn.DT_SYMTAB) / 24);
  console.log(`  derived symbol count = ${symCount}`);
}

// --- walk symbols --------------------------------------------------------
const strBase = toFile(dyn.DT_STRTAB);
const readStr = (off) => {
  let e = strBase + off;
  const lim = Math.min(b.length, e + 512);
  while (e < lim && b[e] !== 0) e++;
  return b.toString("latin1", strBase + off, e);
};

const syms = [];
const symBase = toFile(dyn.DT_SYMTAB);
for (let i = 0; i < Math.min(symCount, 500000); i++) {
  const o = symBase + i * 24;
  if (o + 24 > b.length) break;
  const stName = u32(o);
  const stValue = u32(o + 8);
  const stSize = u32(o + 12);
  const stInfo = b[o + 4];
  if (stName === 0 || stValue === 0) continue;
  const nm = readStr(stName);
  if (!nm) continue;
  syms.push({ value: stValue, size: stSize, info: stInfo, name: nm });
}

console.log(`\nsymbols with a name and address: ${syms.length}`);

// group by namespace for a quick picture
const byNs = new Map();
for (const s of syms) {
  const m = /^_ZN(\d+)/.exec(s.name);
  let ns = "<plain>";
  if (m) ns = s.name.slice(m[0].length, m[0].length + Number(m[1]));
  byNs.set(ns, (byNs.get(ns) || 0) + 1);
}
console.log("\ntop namespaces:");
for (const [ns, c] of [...byNs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 18)) {
  console.log(`  ${String(c).padStart(5)}  ${ns}`);
}

writeFileSync(outPath, syms.map((s) => `0x${s.value.toString(16)}\t0x${s.size.toString(16)}\t${s.name}`).join("\n") + "\n");
console.log(`\nwrote ${outPath} (${syms.length} symbols)`);

// a focused list for the platform functions main imports
const wanted = syms.filter((s) => /^_ZN2nn(2os|3mem|4init|2vi|2fs|4time|4diag|4util|4nifm|2oe)/.test(s.name));
console.log(`\nplatform-relevant plt symbols: ${wanted.length}`);
for (const w of wanted.slice(0, 12)) console.log(`  0x${w.value.toString(16)}  ${w.name.slice(0, 90)}`);
writeFileSync(
  outPath.replace(/\.txt$/, "-platform.txt"),
  wanted.map((s) => `0x${s.value.toString(16)}\t${s.name}`).join("\n") + "\n",
);
