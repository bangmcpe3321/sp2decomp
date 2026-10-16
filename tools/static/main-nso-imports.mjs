// Resolve main's platform imports from the ORIGINAL decompressed NSO.
//
// main.converted.elf has no .dynsym/.rela sections -- the converter emits only
// .text/.rodata/.rwdata/.bss -- so the 113,150 names Ghidra reported must come from
// the NSO the loader reads. This parses that NSO format directly:
//
//   NSO header at 0x0 (content starts at file 0x100)
//   MOD0 at .text+0x8, DynamicOffset at MOD0+0x4
//   .dynamic at DynamicOffset holds DT_SYMTAB / DT_STRTAB / DT_JMPREL / DT_PLTRELSZ
//
// For each platform thunk, the GOT slot it dereferences is a PLT relocation whose
// symbol index names the exact imported SDK function.
import { readFileSync, writeFileSync } from "node:fs";

const nsoPath = process.argv[2] ?? "main.decompressed";
const outPath = process.argv[3] ?? "main-imports.txt";

const b = readFileSync(nsoPath);
const u32 = (o) => b.readUInt32LE(o);
const FILE_BASE = 0x100;
const MOD0 = 0x108;

console.log("=== NSO ===");
const textSize = u32(0x18);
console.log(`  .text size = 0x${textSize.toString(16)}`);
if (b.toString("latin1", MOD0, MOD0 + 4) !== "MOD0") {
  console.error("  no MOD0 at .text+0x8");
  process.exit(1);
}
const dynamicOffset = u32(MOD0 + 0x4);
console.log(`  MOD0 DynamicOffset = 0x${dynamicOffset.toString(16)}`);

// --- .dynamic ------------------------------------------------------------
const DT = {
  0: "DT_NULL", 4: "DT_HASH", 5: "DT_STRTAB", 6: "DT_SYMTAB", 7: "DT_RELA",
  8: "DT_RELASZ", 9: "DT_RELAENT", 10: "DT_STRSZ", 11: "DT_SYMENT",
  23: "DT_JMPREL", 2: "DT_PLTRELSZ", 3: "DT_PLTGOT", 0x6ffffff9: "DT_RELACOUNT",
};
const dyn = {};
// Values are 64-bit but stay well inside Number range for this image.
for (let i = 0; i < 64; i++) {
  const o = FILE_BASE + dynamicOffset + i * 16;
  if (o + 16 > b.length) break;
  const tag = Number(b.readBigInt64LE(o));
  const val = Number(b.readBigUInt64LE(o + 8));
  if (tag === 0) break;
  const name = DT[tag] ?? `DT_0x${tag.toString(16)}`;
  dyn[name] = val;
  if (["DT_SYMTAB", "DT_STRTAB", "DT_JMPREL", "DT_RELA", "DT_RELASZ", "DT_PLTRELSZ", "DT_STRSZ", "DT_HASH"].includes(name)) {
    console.log(`  ${name.padEnd(12)} = 0x${val.toString(16)}`);
  }
}

const toFile = (va) => FILE_BASE + va;

// --- string table --------------------------------------------------------
const strFile = toFile(dyn.DT_STRTAB);
const readStr = (off) => {
  let e = strFile + off;
  const lim = Math.min(b.length, e + 2048);
  while (e < lim && b[e] !== 0) e++;
  return b.toString("latin1", strFile + off, e);
};
console.log(`\n  sample strings from DT_STRTAB:`);
for (const off of [1, 9, 20, 40, 80]) {
  console.log(`    [+${off}] ${readStr(off).slice(0, 80)}`);
}

// --- symbol count --------------------------------------------------------
let symCount = 0;
if (dyn.DT_HASH) {
  const hf = toFile(dyn.DT_HASH);
  symCount = u32(hf + 4);
  console.log(`\n  DT_HASH nchain = ${symCount} symbols`);
} else {
  symCount = Math.floor((dyn.DT_STRTAB - dyn.DT_SYMTAB) / 24);
  console.log(`\n  derived symbol count = ${symCount}`);
}

// --- walk symbols --------------------------------------------------------
const symFile = toFile(dyn.DT_SYMTAB);
const syms = [];
for (let i = 0; i < Math.min(symCount, 300000); i++) {
  const o = symFile + i * 24;
  if (o + 24 > b.length) break;
  const stName = u32(o);
  const stValue = u32(o + 8);
  const name = stName ? readStr(stName) : "";
  syms.push({ i, name, value: stValue });
}
const namedSyms = syms.filter((s) => s.name);
console.log(`  symbols with names: ${namedSyms.length}`);
console.log(`  sample named symbols:`);
for (const s of namedSyms.slice(0, 6)) console.log(`    [${s.i}] value=0x${s.value.toString(16)} ${s.name.slice(0, 70)}`);

// --- relocations: map GOT slot -> symbol name ----------------------------
const pltRel = dyn.DT_JMPREL;
const pltSz = dyn.DT_PLTRELSZ ?? 0;
console.log(`\n=== relocation table for imports ===`);
console.log(`  DT_JMPREL = ${pltRel !== undefined ? "0x" + pltRel.toString(16) : "absent"}, DT_PLTRELSZ = 0x${pltSz.toString(16)}`);

const imports = [];
if (pltRel && pltSz) {
  const n = Math.floor(pltSz / 24);
  for (let i = 0; i < n; i++) {
    const o = toFile(pltRel) + i * 24;
    if (o + 24 > b.length) break;
    const rOffset = Number(b.readBigUInt64LE(o));
    const rInfo = Number(b.readBigUInt64LE(o + 8));
    const rAddend = Number(b.readBigInt64LE(o + 16));
    const symIdx = Math.floor(rInfo / 0x100000000);
    const rType = rInfo % 0x100000000;
    const sym = syms[symIdx];
    if (sym && sym.name) imports.push({ slot: rOffset, type: rType, addend: rAddend, name: sym.name });
  }
  console.log(`  parsed ${n} PLT relocations, ${imports.length} with names`);
}

const plat = imports.filter((e) => /^_ZN2nn/.test(e.name));
console.log(`  platform (_ZN2nn*) imports: ${plat.length}`);
for (const e of plat.slice(0, 40)) {
  console.log(`    slot=0x${e.slot.toString(16)}  ${e.name}`);
}
writeFileSync(outPath, imports.map((e) => `0x${e.slot.toString(16)}\t${e.type}\t${e.name}`).join("\n") + "\n");
console.log(`\nwrote ${outPath} (${imports.length} named imports)`);
