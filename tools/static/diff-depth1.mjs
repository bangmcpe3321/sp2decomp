// Print the exact symmetric difference in depth-1 callees between the two
// implementations, restricted to BL/B decoded from the roots.
import { readFileSync } from "node:fs";

const b = readFileSync(process.argv[2] ?? "main.elf");
const IMAGE_BASE = 0x7100000000n;
const TEXT_FILE = 0x100n;
const TEXT_SIZE = 0x1415068n;

// Correct offset arithmetic: subtract in BigInt FIRST, then narrow.
const u32 = (abs) => {
  const f = Number(TEXT_FILE + (abs - IMAGE_BASE));
  return f >= 0 && f + 4 <= b.length ? b.readUInt32LE(f) : null;
};
const RET = 0xd65f03c0;
const inText = (t) => t >= IMAGE_BASE && t < IMAGE_BASE + TEXT_SIZE;
const hex = (v) => "0x" + v.toString(16);

const syms = [];
for (const ln of readFileSync(process.argv[3] ?? "inventory.txt", "utf8").split("\n")) {
  if (!ln.startsWith("FUNCTION\t")) continue;
  const p = ln.split("\t");
  const abs = BigInt(parseInt(p[1], 16));
  if (!Number.isNaN(Number(abs))) syms.push({ abs, name: p[2] });
}
syms.sort((a, c) => (a.abs < c.abs ? -1 : 1));
const nameAt = new Map(syms.map((s) => [s.abs, s.name]));
const nextSym = (abs) => {
  let lo = 0, hi = syms.length - 1, res = IMAGE_BASE + TEXT_SIZE;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (syms[mid].abs > abs) { res = syms[mid].abs; hi = mid - 1; } else lo = mid + 1;
  }
  return res;
};
const bodyEnd = (abs) => {
  const cap = nextSym(abs);
  for (let p = abs; p + 4n <= cap; p += 4n) if (u32(p) === RET) return p + 4n;
  return cap;
};

const ROOTS = [0x11f5ab4, 0x11f5b20, 0x11fca28, 0x11fcadc, 0x11fcb44, 0x11fcba4].map(
  (o) => IMAGE_BASE + BigInt(o),
);

const blOnly = new Set();
const blAndB = new Set();
for (const r of ROOTS) {
  const end = bodyEnd(r);
  for (let p = r; p + 4n <= end; p += 4n) {
    const w = u32(p);
    if (w === null) break;
    const op = (w & 0xfc000000) >>> 0;
    if (op === 0x94000000 || op === 0x14000000) {
      let imm = w & 0x03ffffff;
      if (imm & 0x02000000) imm -= 0x04000000;
      const t = p + BigInt(imm * 4);
      if (!inText(t)) continue;
      if (op === 0x94000000) blOnly.add(t);
      blAndB.add(t);
    }
  }
}

console.log(`depth-1 using BL only      : ${blOnly.size}`);
console.log(`depth-1 using BL + B       : ${blAndB.size}`);
console.log("");
console.log("targets contributed ONLY by B (the disputed ones):");
const extra = [...blAndB].filter((t) => !blOnly.has(t)).sort((a, c) => (a < c ? -1 : 1));
for (const t of extra) {
  console.log(`  ${hex(t)}  ${nameAt.get(t) ?? "<no symbol - intra-function branch target>"}`);
}
console.log("");
console.log("Do any of these equal a symbol start?");
for (const t of extra) {
  console.log(`  ${hex(t)}  ${syms.some((s) => s.abs === t) ? "IS a symbol start" : "NOT a symbol start"}`);
}
