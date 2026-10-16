// Identify sdk functions by the strings they reference.
//
// sdk's symbol table is stripped, but it is full of the SDK's own textual metadata:
// assertion messages, source file paths (os_Thread.cpp), and function names used by
// ABORT_IF / NN_ASSERT macros. Those strings live in .rodata, and a function that
// uses one loads its address with ADRP+ADD. Decoding ADRP+ADD pairs across .text
// therefore yields string -> function, which is a real identification route.
import { readFileSync, writeFileSync } from "node:fs";

const elfPath = process.argv[2] ?? "sdk.elf";
const outPath = process.argv[3] ?? "sdk-string-xref.txt";
const filter = process.argv[4] ?? "os_"; // which source-file family to report

const b = readFileSync(elfPath);
// The converted ELF is a flat image: file offset = 0x1000 + memory address for
// section content, with .text at memory 0.
const FILE_BASE = 0x1000;
const u32 = (memVa) => {
  const f = FILE_BASE + memVa;
  return f >= 0 && f + 4 <= b.length ? b.readUInt32LE(f) : null;
};

// --- section layout from the ELF program headers -------------------------
const sections = [];
const shoff = Number(b.readBigUInt64LE(40));
const shentsize = b.readUInt16LE(58);
const shnum = b.readUInt16LE(60);
const shstrndx = b.readUInt16LE(62);
const strOff = Number(b.readBigUInt64LE(shoff + shstrndx * shentsize + 24));
const nm = (n) => {
  let e = strOff + n;
  while (e < b.length && b[e] !== 0) e++;
  return b.toString("latin1", strOff + n, e);
};
for (let i = 0; i < shnum; i++) {
  const o = shoff + i * shentsize;
  const name = nm(b.readUInt32LE(o));
  const addr = Number(b.readBigUInt64LE(o + 16));
  const off = Number(b.readBigUInt64LE(o + 24));
  const size = Number(b.readBigUInt64LE(o + 32));
  if (size > 0) sections.push({ name, addr, off, size });
}
console.log("sections:");
for (const s of sections) console.log(`  ${s.name.padEnd(10)} addr=0x${s.addr.toString(16)} off=0x${s.off.toString(16)} size=0x${s.size.toString(16)}`);

const text = sections.find((s) => s.name === ".text");
const rodata = sections.find((s) => s.name === ".rodata" || s.name === ".rodata.1");
if (!text) { console.error("no .text"); process.exit(1); }
console.log(`\n.text: 0x${text.addr.toString(16)}..0x${(text.addr + text.size).toString(16)}`);
console.log(`.rodata: 0x${rodata.addr.toString(16)}..0x${(rodata.addr + rodata.size).toString(16)}`);

// --- collect candidate strings from .rodata ------------------------------
// Look for SDK source-file names, which are the strongest identifier because each
// platform subsystem has its own .cpp files.
const rdText = b.toString("latin1", rodata.off, rodata.off + rodata.size);
const strings = new Map(); // memVa -> text
{
  const re = /[\x20-\x7e]{6,120}\x00/g;
  let m;
  while ((m = re.exec(rdText)) !== null) {
    const s = m[0].slice(0, -1);
    if (!/\.(cpp|h|c|hpp)$/.test(s)) continue;
    const va = rodata.addr + m.index;
    strings.set(va, s);
  }
}
console.log(`\n.c/.cpp path strings found: ${strings.size}`);
const families = new Map();
for (const s of strings.values()) {
  const base = s.split("/").pop();
  const fam = base.replace(/[0-9]+/g, "").replace(/\..*$/, "");
  families.set(fam, (families.get(fam) || 0) + 1);
}
console.log("top source-file families:");
for (const [f, c] of [...families.entries()].sort((a, b2) => b2[1] - a[1]).slice(0, 20)) {
  console.log(`  ${String(c).padStart(4)}  ${f}`);
}

const osFiles = [...strings.entries()].filter(([, s]) => s.includes(filter));
console.log(`\npaths matching "${filter}": ${osFiles.length}`);
for (const [va, s] of osFiles.slice(0, 15)) console.log(`  0x${va.toString(16)}  ${s}`);

writeFileSync(outPath + ".strings", [...strings.entries()].map(([va, s]) => `0x${va.toString(16)}\t${s}`).join("\n") + "\n");
console.log(`\nwrote ${outPath}.strings`);
