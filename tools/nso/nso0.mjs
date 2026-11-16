// Shared NSO0 parsing for the analysis and conversion tools.
//
// The layout below is hactool's `nso0_header_t`, not the earlier guess in nso-header.mjs:
//
//   0x00 magic "NSO0"  0x04 version  0x08 reserved  0x0C flags
//   0x10/0x20/0x30  segment[i]: file_offset, memory_offset, decompressed_size, align_or_total
//   0x40 build id (0x20 bytes)
//   0x60 compressed_size[3]
//   0x90 dynstr_extents (u64)   0x98 dynsym_extents (u64)
//   0xA0 section_hashes[3][0x20]
//   0x100 section data
//
// Flags bit i means segment i is LZ4-compressed; bits 3..5 are per-segment hash-valid flags.
// `hactool -t nso --uncompressed` rewrites the header so that file_offset = memory_offset +
// 0x100 and clears the compression flags; both forms are accepted here, but the tools that
// need symbol contents require the decompressed form.
import { readFileSync } from "node:fs";

export const NSO_MAGIC = 0x304f534e;
const SEGMENT_OFFSETS = [0x10, 0x20, 0x30];
const COMPRESSED_SIZE_OFFSETS = [0x60, 0x64, 0x68];

function u32(b, o) {
  return b.readUInt32LE(o);
}

function u64(b, o) {
  return Number(b.readBigUInt64LE(o));
}

export function parseNso0(buffer, label = "<buffer>") {
  if (buffer.length < 0x100) throw new Error(`${label}: shorter than the 0x100-byte NSO0 header`);
  if (buffer.toString("latin1", 0, 4) !== "NSO0") {
    throw new Error(`${label}: not an NSO0 container (magic ${JSON.stringify(buffer.toString("latin1", 0, 4))})`);
  }

  const flags = u32(buffer, 0x0c);
  const segments = SEGMENT_OFFSETS.map((base, index) => ({
    index,
    fileOff: u32(buffer, base),
    memOff: u32(buffer, base + 4),
    size: u32(buffer, base + 8),
    alignOrTotal: u32(buffer, base + 0x0c),
    compressedSize: u32(buffer, COMPRESSED_SIZE_OFFSETS[index]),
    compressed: ((flags >> index) & 1) !== 0,
  }));

  const header = {
    magic: "NSO0",
    version: u32(buffer, 0x04),
    flags,
    segments,
    bssSize: u32(buffer, 0x3c),
    buildId: buffer.subarray(0x40, 0x60),
    dynstrExtents: u64(buffer, 0x90),
    dynsymExtents: u64(buffer, 0x98),
  };

  // hactool's uncompressed form: every segment's file offset is its memory offset + 0x100.
  header.hactoolFormat = segments.every((s) => s.fileOff === s.memOff + 0x100);
  header.decompressed = (flags & 0x07) === 0 || header.hactoolFormat;
  return header;
}

// Map a virtual address inside the module to its file offset. Works for a decompressed image
// (hactool form or an uncompressed NSO whose segments are packed in memory order).
export function fileOfMemory(header, memoryAddress, label = "address") {
  for (const segment of header.segments) {
    if (memoryAddress >= segment.memOff && memoryAddress < segment.memOff + segment.size) {
      const off = segment.fileOff + (memoryAddress - segment.memOff);
      return off;
    }
  }
  throw new Error(`${label} 0x${memoryAddress.toString(16)} is outside every NSO segment`);
}

// MOD0 lives at .text + 8. The MOD0 offset fields are relative to the MOD0 header itself: on
// this build, DynamicOffset 0x2f9a468 + 8 = 0x2f9a470, which is the .dynamic VA recorded in
// README.md, and the tags there are valid while the bytes at +0 are not.
export function findMod0(buffer, header, label = "<buffer>") {
  const text = header.segments[0];
  const mod0Memory = text.memOff + 8;
  let mod0File = fileOfMemory(header, mod0Memory, `${label} MOD0`);
  if (buffer.toString("latin1", mod0File, mod0File + 4) !== "MOD0") {
    // Some containers put the module header at a different offset inside .text. Scan .text
    // only; the literal "MOD0" also occurs in .rodata as ordinary string data.
    const textFile = text.fileOff;
    let found = -1;
    for (let off = 0; off + 0x1c <= text.size; off += 4) {
      if (buffer.toString("latin1", textFile + off, textFile + off + 4) === "MOD0") {
        found = off;
        break;
      }
    }
    if (found < 0) throw new Error(`${label}: no MOD0 signature in .text (expected at .text+8)`);
    mod0File = textFile + found;
  }

  const field = (off) => u32(buffer, mod0File + off);
  return {
    file: mod0File,
    memory: mod0Memory,
    dynamicOffset: field(0x04),
    bssStartOffset: field(0x08),
    bssEndOffset: field(0x0c),
    exceptionInfoStart: field(0x10),
    exceptionInfoEnd: field(0x14),
    moduleOffset: field(0x18),
  };
}

const KNOWN_TAGS = new Map([
  [0, "DT_NULL"], [1, "DT_NEEDED"], [2, "DT_PLTRELSZ"], [3, "DT_PLTGOT"], [4, "DT_HASH"],
  [5, "DT_STRTAB"], [6, "DT_SYMTAB"], [7, "DT_RELA"], [8, "DT_RELASZ"], [9, "DT_RELAENT"],
  [10, "DT_STRSZ"], [11, "DT_SYMENT"], [12, "DT_INIT"], [13, "DT_FINI"], [14, "DT_SONAME"],
  [15, "DT_RPATH"], [16, "DT_SYMBOLIC"], [17, "DT_REL"], [18, "DT_RELSZ"], [19, "DT_RELENT"],
  [20, "DT_PLTREL"], [21, "DT_DEBUG"], [22, "DT_TEXTREL"], [23, "DT_JMPREL"], [24, "DT_BIND_NOW"],
  [25, "DT_INIT_ARRAY"], [26, "DT_FINI_ARRAY"], [27, "DT_INIT_ARRAYSZ"], [28, "DT_FINI_ARRAYSZ"],
  [29, "DT_RUNPATH"], [30, "DT_FLAGS"], [0x6ffffef5, "DT_GNU_HASH"], [0x6ffffff9, "DT_RELACOUNT"],
  [0x6ffffffb, "DT_FLAGS_1"],
]);

function knownTag(tag) {
  return KNOWN_TAGS.has(tag) || (tag >= 0x60000000 && tag <= 0x6fffffff);
}

function readDynamicAt(buffer, header, baseMemory) {
  let file;
  try {
    file = fileOfMemory(header, baseMemory, ".dynamic");
  } catch {
    return null;
  }
  const entries = [];
  const tags = new Map();
  let score = 0;
  for (let i = 0; i < 128; i++) {
    const off = file + i * 16;
    if (off + 16 > buffer.length) return null;
    const tag = u64(buffer, off);
    const value = u64(buffer, off + 8);
    if (tag === 0) {
      return { baseMemory, file, entries, tags, score, hasNull: true };
    }
    entries.push({ tag, value, name: KNOWN_TAGS.get(tag) ?? null });
    if (knownTag(tag)) score++;
    if (!tags.has(tag)) tags.set(tag, value);
  }
  return { baseMemory, file, entries, tags, score, hasNull: false };
}

// MOD0's DynamicOffset is 8 bytes before the actual .dynamic on this build. Rather than trust
// either candidate, parse both and keep the one whose tags actually look like an ELF dynamic
// section. This also lets sdk (a NON-dynsym module) be recognised as such instead of being
// misread.
export function findDynamic(buffer, header, mod0) {
  const candidates = [mod0.dynamicOffset + 8, mod0.dynamicOffset]
    .filter((v, i, all) => all.indexOf(v) === i);
  let best = null;
  for (const base of candidates) {
    const parsed = readDynamicAt(buffer, header, base);
    if (!parsed) continue;
    if (!best || parsed.score > best.score || (parsed.score === best.score && parsed.hasNull && !best.hasNull)) {
      best = parsed;
    }
  }
  if (!best || best.score === 0) {
    throw new Error("no plausible .dynamic section at MOD0.DynamicOffset (+0 or +8)");
  }
  return best;
}

export function symbolCountFromHash(buffer, header, tags) {
  const hash = tags.get(4);
  if (!hash) return 0;
  const off = fileOfMemory(header, hash, "DT_HASH");
  if (off + 8 > buffer.length) return 0;
  const nbucket = u32(buffer, off);
  const nchain = u32(buffer, off + 4);
  return nbucket > 0 && nchain > 0 ? nchain : 0;
}

// Parse .dynsym/.dynstr. Returns null for modules whose exports are not in .dynamic (sdk).
export function readDynsym(buffer, header, dynamic) {
  const symtab = dynamic.tags.get(6);
  const strtab = dynamic.tags.get(5);
  if (!symtab || !strtab) return null;
  const strSize = dynamic.tags.get(10) ?? 0;
  const syment = dynamic.tags.get(11) ?? 0x18;
  if (syment !== 0x18) throw new Error(`DT_SYMENT is ${syment}, expected 0x18 for ELF64`);

  let count = symbolCountFromHash(buffer, header, dynamic.tags);
  if (!count && strtab > symtab) count = Math.floor((strtab - symtab) / 0x18);
  const symFile = fileOfMemory(header, symtab, "DT_SYMTAB");
  const strFile = fileOfMemory(header, strtab, "DT_STRTAB");
  if (strSize && strFile + strSize > buffer.length) {
    throw new Error("DT_STRTAB/DT_STRSZ runs past the image");
  }

  const readName = (nameOff) => {
    if (nameOff === 0 || (strSize && nameOff >= strSize)) return "";
    const start = strFile + nameOff;
    const limit = strSize ? strFile + strSize : buffer.length;
    let end = start;
    while (end < limit && buffer[end] !== 0) end++;
    return buffer.toString("latin1", start, end);
  };

  const entries = [];
  const last = Math.min(count, Math.floor((buffer.length - symFile) / 0x18));
  for (let i = 0; i < last; i++) {
    const off = symFile + i * 0x18;
    const nameOff = u32(buffer, off);
    const info = buffer[off + 4];
    const shndx = buffer.readUInt16LE(off + 6);
    const value = u64(buffer, off + 8);
    const size = u64(buffer, off + 16);
    entries.push({ index: i, nameOff, name: readName(nameOff), info, shndx, value, size });
  }

  return { symtab, strtab, strSize, count: last, entries };
}

// Small convenience used by the command-line tools.
export function loadNso0(path) {
  const buffer = readFileSync(path);
  const header = parseNso0(buffer, path);
  const mod0 = findMod0(buffer, header, path);
  const dynamic = findDynamic(buffer, header, mod0);
  const dynsym = readDynsym(buffer, header, dynamic);
  return { buffer, header, mod0, dynamic, dynsym };
}

export function describeDynamic(dynamic) {
  return dynamic.entries
    .map((e) => `${e.name ?? `0x${e.tag.toString(16)}`}=0x${e.value.toString(16)}`)
    .join(", ");
}
