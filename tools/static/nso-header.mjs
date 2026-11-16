// Print an NSO0 header using the hactool layout, then locate MOD0 and .dynamic.
//
// The earlier version used the wrong offsets (0x10 = text file size, etc.) and hardcoded
// MOD0 at .text+0x378F68. The layout below is hactool's nso0_header_t; MOD0 is at .text+8
// and its offsets are relative to the MOD0 header (+8 for .dynamic on this build).
//
// Usage: node nso-header.mjs <decompressed.nso>
import { describeDynamic, findDynamic, findMod0, parseNso0, readDynsym } from "../nso/nso0.mjs";
import { readFileSync } from "node:fs";

const path = process.argv[2];
if (!path) {
  console.error("usage: node nso-header.mjs <decompressed.nso>");
  process.exit(2);
}
const buffer = readFileSync(path);
const header = parseNso0(buffer, path);

console.log(`file        : ${path} (${buffer.length} bytes)  magic=${header.magic}`);
console.log(`version     : ${header.version}  flags=0x${header.flags.toString(16)}  ${header.decompressed ? "decompressed" : "COMPRESSED"}`);
console.log(`build id    : ${header.buildId.toString("hex")}`);
console.log(`bss size    : 0x${header.bssSize.toString(16)}`);
console.log("\nsegments:");
for (const s of header.segments) {
  console.log(`  ${s.index}: file=0x${s.fileOff.toString(16)} mem=0x${s.memOff.toString(16)} size=0x${s.size.toString(16)} csize=0x${s.compressedSize.toString(16)} ${s.compressed ? "lz4" : "raw"}`);
}

try {
  const mod0 = findMod0(buffer, header, path);
  console.log(`\nMOD0        : file=0x${mod0.file.toString(16)} mem=0x${mod0.memory.toString(16)}`);
  console.log(`  DynamicOffset      = 0x${mod0.dynamicOffset.toString(16)} (absolute 0x${(mod0.dynamicOffset + 8).toString(16)})`);
  console.log(`  BssStartOffset     = 0x${mod0.bssStartOffset.toString(16)}`);
  console.log(`  BssEndOffset       = 0x${mod0.bssEndOffset.toString(16)} (the NSO header's bss size is authoritative: 0x${header.bssSize.toString(16)})`);
  console.log(`  ExceptionInfo      = [0x${mod0.exceptionInfoStart.toString(16)}, 0x${mod0.exceptionInfoEnd.toString(16)})`);
  console.log(`  ModuleOffset       = 0x${mod0.moduleOffset.toString(16)}`);

  const dynamic = findDynamic(buffer, header, mod0);
  console.log(`\n.dynamic    : mem=0x${dynamic.baseMemory.toString(16)} file=0x${dynamic.file.toString(16)} (${dynamic.entries.length} entries)`);
  console.log(`  ${describeDynamic(dynamic)}`);
  const dynsym = readDynsym(buffer, header, dynamic);
  if (dynsym) {
    console.log(`\n.dynsym     : mem=0x${dynsym.symtab.toString(16)} entries=${dynsym.count}`);
    console.log(`.dynstr     : mem=0x${dynsym.strtab.toString(16)} size=0x${dynsym.strSize.toString(16)}`);
  } else {
    console.log("\n.dynsym     : none (no DT_SYMTAB/DT_STRTAB; this module's exports are not ELF dynamic symbols)");
  }
} catch (e) {
  console.log(`\nMOD0/.dynamic: ${e.message}`);
}
