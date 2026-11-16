// Recover .dynsym / .dynstr from a decompressed NSO0 through MOD0 -> .dynamic.
//
// This replaces the earlier version, which hardcoded MOD0 at .text+0x378F68 and read 32-bit
// st_value fields. The corrected facts, verified against the retail main and sdk:
//   * MOD0 is at .text + 8.
//   * MOD0 offsets are relative to the MOD0 header. DynamicOffset 0x2f9a468 + 8 = the
//     .dynamic VA 0x2f9a470 recorded in README.md; parsing +0 yields invalid tags.
//   * MOD0 has NO export table. The names live in .dynamic -> DT_SYMTAB / DT_STRTAB.
//   * sdk has a .dynamic but no DT_SYMTAB (its exports are a separate string table), so a
//     missing table is reported rather than misread.
//
// Usage: node nso-dynsym.mjs <decompressed.nso> [--tsv out.tsv] [--limit N]
import { writeFileSync } from "node:fs";
import {
  describeDynamic,
  loadNso0,
} from "../nso/nso0.mjs";

const args = process.argv.slice(2);
const path = args.find((a) => !a.startsWith("--"));
if (!path || args.includes("--help")) {
  console.error("usage: node nso-dynsym.mjs <decompressed.nso> [--tsv out.tsv] [--limit N]");
  process.exit(2);
}
let tsv = null;
let limit = 10;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--tsv") tsv = args[++i];
  if (args[i] === "--limit") limit = Number(args[++i]);
}

let loaded;
try {
  loaded = loadNso0(path);
} catch (e) {
  console.error(`error: ${e.message}`);
  process.exit(1);
}
const { header, mod0, dynamic, dynsym } = loaded;

console.log(`file: ${path}`);
console.log(`  NSO0 v${header.version}  flags=0x${header.flags.toString(16)}  bss=0x${header.bssSize.toString(16)}  ${header.decompressed ? "decompressed" : "COMPRESSED (decompress first)"}`);
for (const s of header.segments) {
  console.log(`  seg${s.index}: file=0x${s.fileOff.toString(16)} mem=0x${s.memOff.toString(16)} size=0x${s.size.toString(16)} csize=0x${s.compressedSize.toString(16)} ${s.compressed ? "lz4" : "raw"}`);
}

console.log(`\nMOD0: file=0x${mod0.file.toString(16)} mem=0x${mod0.memory.toString(16)}`);
console.log(`  DynamicOffset      = 0x${mod0.dynamicOffset.toString(16)} (absolute 0x${(mod0.dynamicOffset + 8).toString(16)})`);
console.log(`  BssStartOffset     = 0x${mod0.bssStartOffset.toString(16)}`);
console.log(`  BssEndOffset       = 0x${mod0.bssEndOffset.toString(16)}`);
console.log(`  ExceptionInfo      = [0x${mod0.exceptionInfoStart.toString(16)}, 0x${mod0.exceptionInfoEnd.toString(16)})`);
console.log(`  ModuleOffset       = 0x${mod0.moduleOffset.toString(16)}`);

console.log(`\n.dynamic: mem=0x${dynamic.baseMemory.toString(16)} file=0x${dynamic.file.toString(16)} (${dynamic.entries.length} entries)`);
console.log(`  ${describeDynamic(dynamic)}`);
console.log("  NOTE: MOD0 has no export table; these DT_* entries are the symbol source.");

if (!dynsym) {
  console.log("\nNo DT_SYMTAB / DT_STRTAB in .dynamic.");
  console.log("This module's exports are not an ELF dynsym (sdk is the documented example).");
  process.exit(0);
}

const named = dynsym.entries.filter((e) => e.name.length > 0);
const nn = named.filter((e) => e.name.startsWith("_ZN2nn"));

console.log(`\n.dynsym: mem=0x${dynsym.symtab.toString(16)}  .dynstr: mem=0x${dynsym.strtab.toString(16)}  strsz=0x${dynsym.strSize.toString(16)}`);
console.log(`  entries=${dynsym.count}  named=${named.length}  _ZN2nn=${nn.length}`);

console.log(`\nfirst ${Math.min(limit, named.length)} named symbols:`);
for (const e of named.slice(0, limit)) {
  console.log(`  [${String(e.index).padStart(6)}] value=0x${e.value.toString(16).padStart(8)} shndx=${String(e.shndx).padStart(2)} size=${String(e.size).padStart(6)}  ${e.name.slice(0, 100)}`);
}

if (tsv) {
  const lines = ["index\tvalue\tshndx\tsize\tname"];
  for (const e of named) {
    lines.push(`${e.index}\t0x${e.value.toString(16)}\t${e.shndx}\t${e.size}\t${e.name}`);
  }
  writeFileSync(tsv, lines.join("\n") + "\n");
  console.log(`\nwrote ${tsv} (${named.length} named symbols)`);
}
