// NSO0 -> ELF64 AArch64 converter.
//
// The previous version read MOD0+0x18/+0x1C as string/symbol-table pointers and emitted a
// self-consistent but wrong .symtab. MOD0 has no export table (SwitchBrew "MOD"): the names
// live in .dynamic, reached from MOD0.DynamicOffset (relative to the MOD0 header, so +8 on
// this build). This version emits the real .dynsym/.dynstr recovered through DT_SYMTAB /
// DT_STRTAB, and does not invent an entry point.
//
// Layout rule that matters: every section's memory offset is page-aligned, but the sections
// are packed in the file. Emitting one flat image where file offset == memory offset + 0x1000
// keeps each segment's `p_vaddr - p_offset` constant and prevents the shift that would move
// .rodata/.rwdata to wrong addresses.
import { readFileSync, writeFileSync } from "node:fs";
import { findDynamic, findMod0, parseNso0, readDynsym } from "./nso0.mjs";

const [, , inPath, outPath] = process.argv;
if (!inPath || !outPath) {
  console.error("usage: node nso2elf.mjs <decompressed.nso> <output.elf>");
  process.exit(2);
}

const buf = readFileSync(inPath);
const header = parseNso0(buf, inPath);
if (!header.decompressed) {
  console.error("error: input is still LZ4-compressed. Run:");
  console.error(`  hactool -t nso ${inPath} --uncompressed=${inPath}.decompressed`);
  console.error("then pass the .decompressed file.");
  process.exit(1);
}

let mod0 = null;
let dynamic = null;
let dynsym = null;
try {
  mod0 = findMod0(buf, header, inPath);
  dynamic = findDynamic(buf, header, mod0);
  dynsym = readDynsym(buf, header, dynamic);
} catch (e) {
  console.error(`note: no recoverable .dynamic/.dynsym (${e.message})`);
}

for (const s of header.segments) {
  if (s.fileOff + s.size > buf.length) {
    console.error(`error: segment ${s.index} file range exceeds input size`);
    process.exit(1);
  }
}

const ALIGN = 0x1000;
const FILE_BASE = ALIGN; // output file offset = memory offset + 0x1000
const sections = header.segments
  .filter((s) => s.size > 0)
  .map((s) => ({
    name: s.index === 0 ? ".text" : s.index === 1 ? ".rodata" : ".rwdata",
    memory: s.memOff,
    offset: s.fileOff,
    size: s.size,
    fileBase: s.memOff + FILE_BASE,
    flags: s.index === 0 ? 0x6 : s.index === 1 ? 0x2 : 0x3,
    phFlags: s.index === 0 ? 0x5 : s.index === 1 ? 0x4 : 0x6,
  }));

const lastMemoryEnd = sections.length
  ? Math.max(...sections.map((s) => s.memory + s.size))
  : 0;
const bssMemory = Math.ceil(lastMemoryEnd / ALIGN) * ALIGN;
const bssSize = header.bssSize;
const fileEnd = Math.max(...sections.map((s) => s.fileBase + s.size), ALIGN);

const sectionHeaders = sections.map((s) => ({
  name: s.name,
  type: 1,
  flags: s.flags,
  addr: s.memory,
  offset: s.fileBase,
  size: s.size,
  link: 0,
  info: 0,
  addralign: s.name === ".text" ? 4 : 8,
  entsize: 0,
}));

sectionHeaders.push({
  name: ".bss",
  type: 8, // SHT_NOBITS
  flags: 0x3,
  addr: bssMemory,
  offset: bssMemory,
  size: bssSize,
  link: 0,
  info: 0,
  addralign: 8,
  entsize: 0,
});

if (dynsym) {
  const dynsymIndex = sectionHeaders.length;
  // +1 for the null section at index 0, +1 for .dynsym itself: .dynstr follows it.
  const dynstrIndex = dynsymIndex + 2;
  sectionHeaders.push({
    name: ".dynsym",
    type: 11, // SHT_DYNSYM
    flags: 0x2,
    addr: dynsym.symtab,
    offset: dynsym.symtab + FILE_BASE,
    size: dynsym.count * 24,
    link: dynstrIndex,
    info: 1,
    addralign: 8,
    entsize: 24,
  });
  sectionHeaders.push({
    name: ".dynstr",
    type: 3, // SHT_STRTAB
    flags: 0x2,
    addr: dynsym.strtab,
    offset: dynsym.strtab + FILE_BASE,
    size: dynsym.strSize,
    link: 0,
    info: 0,
    addralign: 1,
    entsize: 0,
  });
  // A standard .symtab/.strtab alias helps tools that do not read the dynamic table.
  sectionHeaders.push({
    name: ".symtab",
    type: 2, // SHT_SYMTAB
    flags: 0,
    addr: dynsym.symtab,
    offset: dynsym.symtab + FILE_BASE,
    size: dynsym.count * 24,
    link: dynstrIndex,
    info: 1,
    addralign: 8,
    entsize: 24,
  });
  sectionHeaders.push({
    name: ".strtab",
    type: 3,
    flags: 0,
    addr: dynsym.strtab,
    offset: dynsym.strtab + FILE_BASE,
    size: dynsym.strSize,
    link: 0,
    info: 0,
    addralign: 1,
    entsize: 0,
  });
}

const shStrParts = ["\0"];
const nameOff = {};
for (const sh of sectionHeaders) {
  nameOff[sh.name] = shStrParts.reduce((a, p) => a + p.length, 0);
  shStrParts.push(sh.name + "\0");
}
nameOff[".shstrtab"] = shStrParts.reduce((a, p) => a + p.length, 0);
shStrParts.push(".shstrtab\0");
const shstr = Buffer.from(shStrParts.join(""), "latin1");

const PH = 1 + sections.length + 1; // PT_PHDR + LOADs + GNU_STACK
const EHDR = 64;
const PHOFF = EHDR;
const PHEND = PHOFF + PH * 56;
if (PHEND > ALIGN) {
  console.error(`error: program headers (${PH}) do not fit below the first section`);
  process.exit(1);
}

const shoff = Math.ceil(fileEnd / 8) * 8;
const SH = 1 + sectionHeaders.length + 1; // null + sections + .shstrtab
const SH_STRTAB_INDEX = SH - 1;
const shstrOff = shoff + SH * 64;
const total = shstrOff + shstr.length;
const out = Buffer.alloc(total);

// ---- ELF header ----
out.write("\x7fELF", 0, "latin1");
out[4] = 2; // 64-bit
out[5] = 1; // little-endian
out[6] = 1; // EV_CURRENT
out[7] = 0; // System V
out.writeUInt16LE(2, 16); // ET_EXEC
out.writeUInt16LE(0xb7, 18); // EM_AARCH64
out.writeUInt32LE(1, 20);
// MOD0 carries no entry point (SwitchBrew "MOD"): the module is entered through .dynamic.
out.writeBigUInt64LE(0n, 24);
out.writeBigUInt64LE(BigInt(PHOFF), 32);
out.writeBigUInt64LE(BigInt(shoff), 40);
out.writeUInt32LE(0, 48);
out.writeUInt16LE(EHDR, 52);
out.writeUInt16LE(56, 54);
out.writeUInt16LE(PH, 56);
out.writeUInt16LE(64, 58);
out.writeUInt16LE(SH, 60);
out.writeUInt16LE(SH_STRTAB_INDEX, 62);

const ph = (i, { type, flags, offset, vaddr, filesz, memsz, align }) => {
  const o = PHOFF + i * 56;
  out.writeUInt32LE(type, o + 0);
  out.writeUInt32LE(flags, o + 4);
  out.writeBigUInt64LE(BigInt(offset), o + 8);
  out.writeBigUInt64LE(BigInt(vaddr), o + 16);
  out.writeBigUInt64LE(BigInt(vaddr), o + 24);
  out.writeBigUInt64LE(BigInt(filesz), o + 32);
  out.writeBigUInt64LE(BigInt(memsz), o + 40);
  out.writeBigUInt64LE(BigInt(align), o + 48);
};

let pi = 0;
ph(pi++, { type: 6, flags: 0x5, offset: PHOFF, vaddr: 0, filesz: 0, memsz: 0, align: 8 });
for (const s of sections) {
  ph(pi++, {
    type: 1,
    flags: s.phFlags,
    offset: s.fileBase,
    vaddr: s.memory,
    filesz: s.size,
    memsz: s.size,
    align: ALIGN,
  });
}
ph(pi, { type: 0x6474e550, flags: 0x4, offset: PHOFF, vaddr: 0, filesz: 0, memsz: 0, align: 8 });

for (const s of sections) {
  buf.copy(out, s.fileBase, s.offset, s.offset + s.size);
}

// ---- section headers ----
const sh = (i, s) => {
  const o = shoff + i * 64;
  out.writeUInt32LE(nameOff[s.name], o + 0);
  out.writeUInt32LE(s.type, o + 4);
  out.writeBigUInt64LE(BigInt(s.flags), o + 8);
  out.writeBigUInt64LE(BigInt(s.addr), o + 16);
  out.writeBigUInt64LE(BigInt(s.offset), o + 24);
  out.writeBigUInt64LE(BigInt(s.size), o + 32);
  out.writeUInt32LE(s.link, o + 40);
  out.writeUInt32LE(s.info, o + 44);
  out.writeBigUInt64LE(BigInt(s.addralign), o + 48);
  out.writeBigUInt64LE(BigInt(s.entsize), o + 56);
};

sh(0, { name: "", type: 0, flags: 0, addr: 0, offset: 0, size: 0, link: 0, info: 0, addralign: 0, entsize: 0 });
for (let i = 0; i < sectionHeaders.length; i++) sh(i + 1, sectionHeaders[i]);
sh(SH_STRTAB_INDEX, {
  name: ".shstrtab", type: 3, flags: 0, addr: 0, offset: shstrOff,
  size: shstr.length, link: 0, info: 0, addralign: 1, entsize: 0,
});
if (shstrOff + shstr.length > out.length) {
  console.error("error: .shstrtab does not fit in the output buffer");
  process.exit(1);
}
shstr.copy(out, shstrOff);

writeFileSync(outPath, out);

console.log("NSO0 -> ELF64 AArch64 (flat memory image)");
console.log(`  nso version : ${header.version}`);
console.log(`  nso flags   : 0x${header.flags.toString(16)}`);
for (const s of sections) {
  console.log(`  ${s.name.padEnd(8)}: mem 0x${s.memory.toString(16)} size 0x${s.size.toString(16)} end 0x${(s.memory + s.size).toString(16)}`);
}
console.log(`  .bss    : mem 0x${bssMemory.toString(16)} size 0x${bssSize.toString(16)} end 0x${(bssMemory + bssSize).toString(16)}`);
if (dynsym) {
  console.log(`  .dynsym : mem 0x${dynsym.symtab.toString(16)} entries ${dynsym.count}`);
  console.log(`  .dynstr : mem 0x${dynsym.strtab.toString(16)} size 0x${dynsym.strSize.toString(16)}`);
  console.log(`  dynamic : mem 0x${dynamic.baseMemory.toString(16)} (${dynamic.entries.length} entries)`);
} else {
  console.log("  dynamic : none recovered (no .dynsym emitted)");
}
console.log(`  entry   : 0 (MOD0 has no entry point)`);
console.log(`  output  : ${outPath} (${out.length} bytes, ${PH} program headers, ${SH} section headers)`);
