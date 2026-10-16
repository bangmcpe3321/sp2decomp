// NSO0 -> ELF64 AArch64 converter.
//
// Nintendo Switch NSO has no ELF header and no loader in Ghidra, so we rebuild
// a loadable ELF64. Each section keeps its exact NSO memory address, so every
// in-binary pointer, call target and jump table stays valid for analysis.
//
// Layout rule that matters: every section's memory offset is page-aligned
// (e.g. .text 0x0, .rodata 0x1416000, .rwdata 0x2d63000), but the sections are
// packed back-to-back in the file. Emitting one flat image where file offset
// equals memory offset -- padding the gaps -- keeps each segment's
// `p_vaddr - p_offset` constant and prevents the shift that would otherwise
// move .rodata/.rwdata to wrong addresses and collide with .bss.
import { readFileSync, writeFileSync } from "node:fs";

const [, , inPath, outPath] = process.argv;
if (!inPath || !outPath) {
  console.error("usage: node nso2elf.mjs <input.nso> <output.elf>");
  process.exit(2);
}

const buf = readFileSync(inPath);
if (buf.toString("latin1", 0, 4) !== "NSO0") {
  console.error(`error: not an NSO0 container (magic=${JSON.stringify(buf.toString("latin1", 0, 4))})`);
  process.exit(1);
}

const u32 = (off) => buf.readUInt32LE(off);
const version = u32(0x04);
const flags = u32(0x0c);
const text = { fileOff: u32(0x10), memOff: u32(0x14), size: u32(0x18), csize: u32(0x1c) };
const rodata = { fileOff: u32(0x20), memOff: u32(0x24), size: u32(0x28), csize: u32(0x2c) };
const data = { fileOff: u32(0x30), memOff: u32(0x34), size: u32(0x38), csize: u32(0x3c) };
void text.csize;
void rodata.csize;
void data.csize;
const bssSize = u32(0x3c);
const modOff = u32(0x64);

// ---- MOD0: real module entry point and exports ----------------------------
// NSO has no reliable ELF entry (e_entry 0 is the Switch's own vector base), so
// the module's entry and exported function names come from the MOD0 structure.
let mod0 = null;
if (modOff !== 0 && modOff + 0x1c <= buf.length) {
  const s32 = (o) => buf.readInt32LE(o);
  const entryTarget = s32(modOff + 0x10);
  const entryOffset = s32(modOff + 0x14);
  const strOff = s32(modOff + 0x18);
  const symOff = s32(modOff + 0x1c);
  if (strOff > 0 && symOff > 0 && strOff < buf.length && symOff + 8 <= buf.length) {
    const funcs = [];
    const MAX = 100000;
    for (let i = 0; i < MAX; i++) {
      const o = symOff + i * 8;
      if (o + 8 > buf.length) break;
      const a = buf.readUInt32LE(o);
      const n = buf.readUInt32LE(o + 4);
      if (a === 0 && n === 0) break;
      if (n <= 0 || strOff + n >= buf.length) continue;
      let end = strOff + n;
      while (end < buf.length && buf[end] !== 0) end++;
      funcs.push({ addr: text.memOff + a, name: buf.toString("latin1", strOff + n, end) });
    }
    mod0 = { entryTarget, entryOffset, functions: funcs };
  }
}

const sections = [
  { name: ".text", seg: text, index: 1 },
  { name: ".rodata", seg: rodata, index: 2 },
  { name: ".rwdata", seg: data, index: 3 },
].filter((s) => s.seg.size > 0);

for (const s of sections) {
  const end = s.seg.fileOff + s.seg.size;
  if (end > buf.length) {
    console.error(`error: ${s.name} file range [0x${s.seg.fileOff.toString(16)}, 0x${end.toString(16)}) exceeds input size 0x${buf.length.toString(16)}`);
    process.exit(1);
  }
}

const ALIGN = 0x1000;
// The ELF header and program headers occupy [0, ALIGN). Shifting every section
// by ALIGN keeps p_vaddr ≡ p_offset (mod ALIGN) and keeps .rodata/.rwdata at
// their true relative distances while leaving the header region intact.
const FILE_BASE = ALIGN;
const lastMemEnd = sections.length
  ? Math.max(...sections.map((s) => s.seg.memOff + s.seg.size))
  : 0;
// .bss must not overlap the last initialised section.
const bssMemOff = Math.ceil(lastMemEnd / ALIGN) * ALIGN;

for (const s of sections) s.fileBase = s.seg.memOff + FILE_BASE;
const fileEnd = Math.max(...sections.map((s) => s.fileBase + s.seg.size), ALIGN) + FILE_BASE;

const exportedFns = mod0 ? mod0.functions : [];
const hasSymtab = exportedFns.length > 0;
const symCount = 1 + exportedFns.length;
const symtabSize = symCount * 24;
{
  let cur = 1; // byte 0 is the empty symbol name
  for (const f of exportedFns) {
    f.nameOff = cur;
    cur += Buffer.byteLength(f.name, "latin1") + 1;
  }
}
const strtabData = Buffer.from(
  hasSymtab ? "\0" + exportedFns.map((f) => f.name).join("\0") + "\0" : "",
  "latin1",
);

const PH = 1 + sections.length + 1; // PT_PHDR + LOADs + GNU_STACK
const EHDR = 64;
const PHOFF = EHDR;
const PHEND = PHOFF + PH * 56;
if (PHEND > ALIGN) {
  console.error(`error: program headers (${PH}) do not fit below the first section`);
  process.exit(1);
}
const symtabOff = Math.ceil(fileEnd / 8) * 8;
const strtabOff = symtabOff + (hasSymtab ? symtabSize : 0);
const shoff = Math.ceil((strtabOff + strtabData.length) / 8) * 8;
// Header order: null, sections..., .bss, [.symtab, .strtab], .shstrtab.
// Both the total count and e_shstrndx derive from the same expression so they
// cannot drift apart.
const SH_STRTAB_INDEX = 1 + sections.length + 1 + (hasSymtab ? 2 : 0);
const SH = SH_STRTAB_INDEX + 1;
const total = shoff + SH * 64 + 64; // header table + .shstrtab payload (padded)
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
// MOD0 gives the true module entry: entry_offset is relative to entry_target.
const entryAddr = mod0 ? mod0.entryTarget + mod0.entryOffset : text.memOff;
out.writeBigUInt64LE(BigInt(entryAddr), 24);
out.writeBigUInt64LE(BigInt(PHOFF), 32);
out.writeBigUInt64LE(BigInt(shoff), 40);
out.writeUInt32LE(0, 48);
out.writeUInt16LE(EHDR, 52);
out.writeUInt16LE(56, 54);
out.writeUInt16LE(PH, 56);
out.writeUInt16LE(64, 58);
out.writeUInt16LE(SH, 60);
out.writeUInt16LE(SH_STRTAB_INDEX, 62); // e_shstrndx

const ph = (i, { type, flags: f, offset, vaddr, filesz, memsz, align }) => {
  const o = PHOFF + i * 56;
  out.writeUInt32LE(type, o + 0);
  out.writeUInt32LE(f, o + 4);
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
    flags: s.name === ".text" ? 0x5 : s.name === ".rodata" ? 0x4 : 0x6,
    offset: s.fileBase,
    vaddr: s.seg.memOff,
    filesz: s.seg.size,
    memsz: s.seg.size,
    align: ALIGN,
  });
}
// .bss is emitted as a NOBITS section only. A separate zero-fill PT_LOAD would
// need p_vaddr ≡ p_offset (mod ALIGN) with an in-range offset, which a segment
// that starts at bssMemOff cannot satisfy without adding a spurious page.
ph(pi, { type: 0x6474e550, flags: 0x4, offset: PHOFF, vaddr: 0, filesz: 0, memsz: 0, align: 8 });

for (const s of sections) {
  buf.copy(out, s.fileBase, s.seg.fileOff, s.seg.fileOff + s.seg.size);
}

// ---- symbol table from MOD0 exports ----
if (hasSymtab) {
  out.writeUInt32LE(0, symtabOff); // st_name of the null symbol
  exportedFns.forEach((f, i) => {
    const o = symtabOff + (i + 1) * 24;
    out.writeUInt32LE(f.nameOff, o + 0);
    out[o + 4] = 0x12; // STB_GLOBAL | STT_FUNC
    out[o + 5] = 0; // STV_DEFAULT
    out.writeUInt16LE(1, o + 6); // st_shndx -> .text
    out.writeBigUInt64LE(BigInt(f.addr), o + 8);
    out.writeBigUInt64LE(0n, o + 16);
  });
  strtabData.copy(out, strtabOff);
}

// ---- section headers ----
const names = [
  ...sections.map((s) => s.name),
  ".bss",
  ...(hasSymtab ? [".symtab", ".strtab"] : []),
  ".shstrtab",
];
const shstrParts = ["\0"];
const nameOff = {};
for (const n of names) {
  nameOff[n] = shstrParts.reduce((a, p) => a + p.length, 0);
  shstrParts.push(n + "\0");
}
const shstr = Buffer.from(shstrParts.join(""), "latin1");
const shstrOff = shoff + SH * 64;

const sh = (i, { name, type, flags: f, addr, offset, size, link, info, addralign, entsize }) => {
  const o = shoff + i * 64;
  out.writeUInt32LE(name, o + 0);
  out.writeUInt32LE(type, o + 4);
  out.writeBigUInt64LE(BigInt(f), o + 8);
  out.writeBigUInt64LE(BigInt(addr), o + 16);
  out.writeBigUInt64LE(BigInt(offset), o + 24);
  out.writeBigUInt64LE(BigInt(size), o + 32);
  out.writeUInt32LE(link ?? 0, o + 40);
  out.writeUInt32LE(info ?? 0, o + 44);
  out.writeBigUInt64LE(BigInt(addralign ?? 1), o + 48);
  out.writeBigUInt64LE(BigInt(entsize ?? 0), o + 56);
};

sh(0, { name: 0, type: 0, flags: 0, addr: 0, offset: 0, size: 0 });
let si = 1;
for (const s of sections) {
  sh(si++, {
    name: nameOff[s.name],
    type: 1,
    flags: s.name === ".text" ? 0x6 : s.name === ".rodata" ? 0x2 : 0x3,
    addr: s.seg.memOff,
    offset: s.fileBase,
    size: s.seg.size,
    addralign: s.name === ".text" ? 4 : 8,
  });
}
sh(si++, { name: nameOff[".bss"], type: 8, flags: 0x3, addr: bssMemOff, offset: bssMemOff, size: bssSize, addralign: 8 });
if (hasSymtab) {
  sh(si, { name: nameOff[".symtab"], type: 2, flags: 0, addr: 0, offset: symtabOff, size: symtabSize, link: si + 1, info: 1, addralign: 8, entsize: 24 });
  si++;
  sh(si++, { name: nameOff[".strtab"], type: 3, flags: 0, addr: 0, offset: strtabOff, size: strtabData.length, addralign: 1 });
}
sh(si++, { name: nameOff[".shstrtab"], type: 3, flags: 0, addr: 0, offset: shstrOff, size: shstr.length, addralign: 1 });
if (si - 1 !== SH_STRTAB_INDEX) {
  console.error(`error: .shstrtab landed at index ${si - 1}, but e_shstrndx declares ${SH_STRTAB_INDEX}`);
  process.exit(1);
}
if (shstrOff + shstr.length > out.length) {
  console.error(`error: .shstrtab payload (${shstr.length} bytes) does not fit in the output buffer`);
  process.exit(1);
}
shstr.copy(out, shstrOff);

writeFileSync(outPath, out);

console.log("NSO0 -> ELF64 AArch64 (flat memory image)");
console.log(`  nso version : ${version}`);
console.log(`  nso flags   : 0x${flags.toString(16)}`);
for (const s of sections) {
  console.log(
    `  ${s.name.padEnd(8)}: mem 0x${s.seg.memOff.toString(16)} size 0x${s.seg.size.toString(16)} end 0x${(s.seg.memOff + s.seg.size).toString(16)}`,
  );
}
console.log(`  .bss    : mem 0x${bssMemOff.toString(16)} size 0x${bssSize.toString(16)} end 0x${(bssMemOff + bssSize).toString(16)}`);
console.log(`  entry   : 0x${entryAddr.toString(16)}${mod0 ? ` (MOD0 entryTarget 0x${mod0.entryTarget.toString(16)} + entryOffset 0x${mod0.entryOffset.toString(16)})` : " (no MOD0)"}`);
console.log(`  exports : ${exportedFns.length} MOD0 function symbols`);
console.log(`  module  : file offset 0x${modOff.toString(16)}`);
console.log(`  output  : ${outPath} (${out.length} bytes, ${PH} program headers)`);
