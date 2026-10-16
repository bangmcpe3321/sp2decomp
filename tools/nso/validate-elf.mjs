// Structural validation for the converted ELF: header fields, segment mapping
// rule, and section/segment overlap. Fails loudly instead of assuming.
import { readFileSync } from "node:fs";

const path = process.argv[2];
if (!path) {
  console.error("usage: node validate-elf.mjs <file.elf>");
  process.exit(2);
}
const b = readFileSync(path);
const U16 = (o) => b.readUInt16LE(o);
const U32 = (o) => b.readUInt32LE(o);
const U64 = (o) => b.readBigUInt64LE(o);
const hex = (v) => "0x" + v.toString(16);

const problems = [];
const check = (cond, msg) => {
  if (!cond) problems.push(msg);
  return cond;
};

console.log(`file        : ${path} (${b.length} bytes)`);
check(b.toString("latin1", 0, 4) === "\x7fELF", "bad ELF magic") || console.log("magic       : MISSING");
console.log(`magic       : ${JSON.stringify(b.toString("latin1", 0, 4))}`);
console.log(`class/data  : ${b[4]}/${b[5]} (expect 2/1 = 64-bit LE)`);
check(b[4] === 2 && b[5] === 1, "not 64-bit little-endian");

const eType = U16(16), eMachine = U16(18), eEntry = U64(24);
const phoff = Number(U64(32)), shoff = Number(U64(40));
const phentsize = U16(54), phnum = U16(56);
const shentsize = U16(58), shnum = U16(60), shstrndx = U16(62);
console.log(`e_type      : ${eType} (expect 2 = ET_EXEC)`);
console.log(`e_machine   : ${hex(eMachine)} (expect 0xb7 = AArch64)`);
console.log(`e_entry     : ${hex(eEntry)}`);
console.log(`phoff/num   : ${phoff}/${phnum} (entsize ${phentsize})`);
console.log(`shoff/num   : ${shoff}/${shnum} (entsize ${shentsize})`);
check(eMachine === 0xb7, "e_machine is not AArch64");
check(phentsize === 56, "unexpected e_phentsize");
check(shentsize === 64, "unexpected e_shentsize");
check(phoff + phnum * phentsize <= b.length, "program header table runs past EOF");
check(shoff + shnum * shentsize <= b.length, "section header table runs past EOF");

console.log("\nprogram headers:");
const loadable = [];
for (let i = 0; i < phnum; i++) {
  const o = phoff + i * phentsize;
  const type = U32(o), flags = U32(o + 4);
  const off = U64(o + 8), vaddr = U64(o + 16), paddr = U64(o + 24);
  const filesz = U64(o + 32), memsz = U64(o + 40), align = U64(o + 48);
  const kind = type === 1 ? "LOAD" : type === 6 ? "PHDR" : type === 0x6474e550 ? "GNU_STACK" : hex(BigInt(type));
  console.log(
    `  PH${i} ${kind.padEnd(10)} flags=${hex(BigInt(flags)).padEnd(4)} off=${hex(off).padEnd(10)} vaddr=${hex(vaddr).padEnd(10)} filesz=${hex(filesz).padEnd(10)} memsz=${hex(memsz).padEnd(10)} align=${hex(align)}`,
  );
  if (type === 1) {
    loadable.push({ i, off, vaddr, filesz, memsz });
    check(memsz >= filesz, `PH${i}: memsz < filesz`);
    check(align === 0n || vaddr % align === off % align, `PH${i}: p_vaddr !≡ p_offset (mod align)`);
    if (filesz > 0n) check(off + filesz <= BigInt(b.length), `PH${i}: file range exceeds EOF`);
  }
}

console.log("\nsegment mapping (p_vaddr - p_offset must be constant within a LOAD):");
for (const s of loadable) {
  if (s.filesz === 0n) continue;
  console.log(`  PH${s.i}: delta = ${hex(s.vaddr - s.off)}`);
}

// overlap check across LOAD memory ranges
console.log("\nLOAD memory ranges:");
const ranges = loadable
  .filter((s) => s.memsz > 0n)
  .map((s) => ({ i: s.i, start: s.vaddr, end: s.vaddr + s.memsz, filesz: s.filesz }))
  .sort((a, c) => (a.start < c.start ? -1 : 1));
for (const r of ranges) console.log(`  PH${r.i}: [${hex(r.start)}, ${hex(r.end)})`);
for (let i = 1; i < ranges.length; i++) {
  check(ranges[i].start >= ranges[i - 1].end, `LOAD memory overlap: PH${ranges[i - 1].i} and PH${ranges[i].i}`);
}

console.log("\nsections:");
const strBase = shoff + shstrndx * shentsize;
const strOff = Number(U64(strBase + 24));
const nameAt = (n) => {
  if (n === 0) return "";
  let end = strOff + n;
  while (end < b.length && b[end] !== 0) end++;
  return b.toString("latin1", strOff + n, end);
};
for (let i = 0; i < shnum; i++) {
  const o = shoff + i * shentsize;
  const type = U32(o + 4), flags = U64(o + 8);
  const addr = U64(o + 16), off = U64(o + 24), size = U64(o + 32);
  const nm = nameAt(U32(o));
  const kind = type === 1 ? "PROGBITS" : type === 8 ? "NOBITS" : type === 3 ? "STRTAB" : String(type);
  console.log(
    `  SH${i} ${JSON.stringify(nm).padEnd(12)} ${kind.padEnd(9)} flags=${hex(flags).padEnd(4)} addr=${hex(addr).padEnd(10)} off=${hex(off).padEnd(10)} size=${hex(size)}`,
  );
  if (type === 1 && size > 0n) check(off + size <= BigInt(b.length), `SH${i} (${nm}): file range exceeds EOF`);
  if (type === 1 && i > 0) check(nm.length > 0, `SH${i}: empty name in PROGBITS section`);
}

// .bss must not overlap the file-backed range of the data segment
const bss = (() => {
  for (let i = 0; i < shnum; i++) {
    const o = shoff + i * shentsize;
    if (nameAt(U32(o)) === ".bss") return { addr: U64(o + 16), size: U64(o + 32) };
  }
  return null;
})();
if (bss && bss.size > 0n) {
  console.log(`\n.bss check  : [${hex(bss.addr)}, ${hex(bss.addr + bss.size)})`);
  for (const r of ranges) {
    // A filesz==0 LOAD segment is the zero-fill (BSS) segment, so .bss living
    // inside it is expected rather than an overlap.
    if (r.filesz === 0n) continue;
    const overlaps = bss.addr < r.end && r.start < bss.addr + bss.size;
    check(!overlaps, `.bss overlaps LOAD PH${r.i}`);
  }
}

console.log(`\nRESULT      : ${problems.length === 0 ? "VALID — no structural problems found" : "PROBLEMS FOUND"}`);
for (const p of problems) console.log(`  - ${p}`);
process.exit(problems.length === 0 ? 0 : 1);
