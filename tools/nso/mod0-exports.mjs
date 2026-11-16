// MOD0 summary. The name is historical: MOD0 has NO export table.
//
// SwitchBrew's "MOD" page describes MOD0 as a replacement for PT_DYNAMIC:
//   +0x04 DynamicOffset, +0x08 BssStartOffset, +0x0C BssEndOffset,
//   +0x10/+0x14 ExceptionInfo, +0x18 ModuleOffset.
// There is no symbol/string-table field. The earlier tool read +0x18/+0x1C as
// strOff/symOff; on main those are ModuleOffset and the next word, so it walked garbage and
// reported 0 exports. The names are recovered from .dynamic -> DT_SYMTAB / DT_STRTAB by
// nso-dynsym.mjs and emitted into the ELF by nso2elf.mjs.
//
// Usage: node mod0-exports.mjs <decompressed.nso>
import { findDynamic, findMod0, loadNso0, readDynsym } from "./nso0.mjs";

const path = process.argv[2];
if (!path) {
  console.error("usage: node mod0-exports.mjs <decompressed.nso>");
  process.exit(2);
}

let loaded;
try {
  loaded = loadNso0(path);
} catch (e) {
  console.error(`error: ${e.message}`);
  process.exit(1);
}
const { mod0, dynamic, dynsym } = loaded;
console.log(`MOD0 at file 0x${mod0.file.toString(16)} (mem 0x${mod0.memory.toString(16)})`);
console.log(`  DynamicOffset      = 0x${mod0.dynamicOffset.toString(16)} -> .dynamic 0x${dynamic.baseMemory.toString(16)} (+8 relative to MOD0)`);
console.log(`  BssStartOffset     = 0x${mod0.bssStartOffset.toString(16)}`);
console.log(`  BssEndOffset       = 0x${mod0.bssEndOffset.toString(16)}`);
console.log(`  ExceptionInfo      = [0x${mod0.exceptionInfoStart.toString(16)}, 0x${mod0.exceptionInfoEnd.toString(16)})`);
console.log(`  ModuleOffset       = 0x${mod0.moduleOffset.toString(16)}`);
console.log("\nMOD0 has no export table (it is a PT_DYNAMIC replacement).");
if (dynsym) {
  const named = dynsym.entries.filter((e) => e.name);
  console.log(`.dynamic supplies .dynsym: ${dynsym.count} entries, ${named.length} named.`);
  console.log("Use nso-dynsym.mjs for the full table, or nso2elf.mjs to emit it into an ELF.");
  for (const e of named.slice(0, 10)) console.log(`  0x${e.value.toString(16).padStart(8)} ${e.name.slice(0, 100)}`);
} else {
  console.log("This module has no DT_SYMTAB/DT_STRTAB; its exports are not ELF dynamic symbols.");
}
