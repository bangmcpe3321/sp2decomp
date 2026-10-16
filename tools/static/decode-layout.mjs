// Decode the layout-relevant instructions of a function range and report the
// object offsets it touches. Used to read ground-truth structure layout out of
// compiled code when a header provides no static_assert.
import { readFileSync } from "node:fs";

const b = readFileSync(process.argv[2] ?? "main.elf");
const start = parseInt(process.argv[3], 16);
const end = parseInt(process.argv[4], 16);
const IMAGE_BASE = 0x7100000000n;
const fo = (va) => 0x100 + Number(BigInt(va) - IMAGE_BASE);
const u32 = (va) => {
  const f = fo(va);
  return f >= 0 && f + 4 <= b.length ? b.readUInt32LE(f) : null;
};

const rows = [];
const offsets = new Map();

for (let p = start; p < end; p += 4) {
  const w = u32(p);
  if (w === null) break;
  const hex = "0x" + p.toString(16);
  const hw = w.toString(16).padStart(8, "0");

  // STP (64-bit) signed-offset forms: 1010 1001 00 / 1010 1000 00 family
  if ((w & 0xffc00000) >>> 0 === 0xa9000000) {
    let i7 = (w >>> 15) & 0x7f;
    if (i7 & 0x40) i7 -= 0x80;
    const rt2 = (w >>> 10) & 0x1f;
    const rn = (w >>> 5) & 0x1f;
    const rt = w & 0x1f;
    const k = (w >>> 22) & 0x3; // 1 post, 2 offset, 3 pre
    const off = i7 * 8;
    rows.push(`${hex}  ${hw}  STP x${rt}, ${rt2 === 31 ? "xzr" : "x" + rt2}, [x${rn}, #${off}]${k === 1 ? "!" : k === 3 ? "!" : ""}   covers ${off}..${off + 16}`);
    if (rn === 0) { offsets.set(off, "ptr-lo"); offsets.set(off + 8, "ptr-hi"); }
    // note: a store of the zero register writes sizeof-size nulling
  }
  // LDP
  else if ((w & 0xffc00000) >>> 0 === 0xa9400000) {
    let i7 = (w >>> 15) & 0x7f;
    if (i7 & 0x40) i7 -= 0x80;
    const rt2 = (w >>> 10) & 0x1f, rn = (w >>> 5) & 0x1f, rt = w & 0x1f;
    rows.push(`${hex}  ${hw}  LDP x${rt}, x${rt2}, [x${rn}, #${i7 * 8}]`);
  }
  // STR 64-bit unsigned offset
  else if ((w & 0xffc00000) >>> 0 === 0xf9000000) {
    const off = ((w >>> 10) & 0xfff) * 8, rn = (w >>> 5) & 0x1f, rt = w & 0x1f;
    rows.push(`${hex}  ${hw}  STR x${rt}${rt === 31 ? " (zero)" : ""} -> [x${rn}, #${off}]`);
    if (rn === 0) offsets.set(off, "8");
  }
  // STR 32-bit
  else if ((w & 0xffc00000) >>> 0 === 0xb9000000) {
    const off = ((w >>> 10) & 0xfff) * 4, rn = (w >>> 5) & 0x1f, rt = w & 0x1f;
    rows.push(`${hex}  ${hw}  STR w${rt}${rt === 31 ? " (zero)" : ""} -> [x${rn}, #${off}]`);
    if (rn === 0) offsets.set(off, "4");
  }
  // STRB
  else if ((w & 0xffc00000) >>> 0 === 0x39000000) {
    const off = (w >>> 10) & 0xfff, rn = (w >>> 5) & 0x1f, rt = w & 0x1f;
    rows.push(`${hex}  ${hw}  STRB w${rt}${rt === 31 ? " (zero)" : ""} -> [x${rn}, #${off}]`);
    if (rn === 0) offsets.set(off, "1");
  }
  // ADD Xd, Xn, #imm
  else if ((w & 0xff800000) >>> 0 === 0x91000000 || (w & 0xff000000) >>> 0 === 0x91000000) {
    const imm = ((w >>> 10) & 0xfff) * ((w >>> 22) & 1 ? 4096 : 1);
    const rn = (w >>> 5) & 0x1f, rd = w & 0x1f;
    rows.push(`${hex}  ${hw}  ADD x${rd}, ${rn === 31 ? "sp" : "x" + rn}, #${imm}${imm ? " (=0x" + imm.toString(16) + ")" : ""}`);
  }
  // MOVZ
  else if ((w & 0xff800000) >>> 0 === 0xd2800000) {
    const v = BigInt((w >>> 5) & 0xffff) << BigInt(((w >>> 21) & 3) * 16);
    rows.push(`${hex}  ${hw}  MOVZ x${w & 0x1f}, #0x${v.toString(16)}`);
  }
  // CSET / CSINC alias producing 0/1
  else if ((w & 0x7fe0fc00) >>> 0 === 0x1a800400) {
    rows.push(`${hex}  ${hw}  CSET w${w & 0x1f}, <cond> (0 or 1)`);
  }
  else {
    rows.push(`${hex}  ${hw}  (undecoded)`);
  }
}

console.log(rows.join("\n"));
console.log("");
console.log("distinct object offsets touched (x0-relative), with access width:");
const sorted = [...offsets.entries()].sort((a, c) => a[0] - c[0]);
for (const [off, width] of sorted) console.log(`  +0x${off.toString(16).padStart(3, "0")}  (${width} byte)`);
if (sorted.length) {
  const max = sorted[sorted.length - 1][0];
  console.log(`\nhighest offset = 0x${max.toString(16)}  ->  at least ${max + 1} bytes live`);
}
