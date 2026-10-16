// Locate the true start of a function that has no symbol entry, by scanning
// backwards for a prologue, then report stack-frame and stack-buffer usage.
//
// Why: 0x7100e6724c is the tail of a preceding function. Symbol boundaries in
// this binary can sit mid-region, so the prologue is the reliable anchor.
import { readFileSync } from "node:fs";

const b = readFileSync(process.argv[2] ?? "main.elf");
const start = parseInt(process.argv[3], 16);
const lookBack = parseInt(process.argv[4] ?? "0x400", 16);

const IMAGE_BASE = 0x7100000000n;
const fo = (va) => 0x100 + Number(BigInt(va) - IMAGE_BASE);
const u32 = (va) => {
  const f = fo(va);
  return f >= 0 && f + 4 <= b.length ? b.readUInt32LE(f) : null;
};

// scan backwards for a prologue: stp x29, x30, [sp, #-N]!  (pre-index)
const isPrologue = (w) => ((w & 0xffc07fff) >>> 0) === 0xa9807bfd;

let fnStart = null;
for (let p = start; p >= start - lookBack; p -= 4) {
  const w = u32(p);
  if (w === null) continue;
  if (isPrologue(w)) {
    fnStart = p;
    break;
  }
}
if (fnStart === null) {
  console.log(`no prologue found in 0x${lookBack.toString(16)} before 0x${start.toString(16)}`);
  process.exit(0);
}

let fnEnd = fnStart;
for (let p = fnStart; p < start + 0x800; p += 4) {
  if (u32(p) === 0xd65f03c0) {
    fnEnd = p + 4;
    break;
  }
}

console.log(`function start 0x${fnStart.toString(16)}  end 0x${fnEnd.toString(16)}  size ${fnEnd - fnStart}`);

const stackBuffers = [];
const subFrames = [];
const consts = [];
const calls = [];
for (let p = fnStart; p < fnEnd; p += 4) {
  const w = u32(p);
  if (w === null) break;
  // SUB sp, sp, #imm
  if ((w & 0xff800000) >>> 0 === 0xd1000000 && ((w >>> 5) & 0x1f) === 31 && (w & 0x1f) === 31) {
    const imm = ((w >>> 10) & 0xfff) * ((w >>> 22) & 1 ? 4096 : 1);
    subFrames.push({ at: p, imm });
  }
  // ADD Xd, sp, #imm  -> stack buffer
  if ((w & 0xff800000) >>> 0 === 0x91000000 && ((w >>> 5) & 0x1f) === 31) {
    const imm = ((w >>> 10) & 0xfff) * ((w >>> 22) & 1 ? 4096 : 1);
    if (imm > 0 && imm < 0x1000) stackBuffers.push({ at: p, rd: w & 0x1f, imm });
  }
  // MOVZ
  if ((w & 0xff800000) >>> 0 === 0xd2800000) {
    const v = BigInt((w >>> 5) & 0xffff) << BigInt(((w >>> 21) & 3) * 16);
    if (v > 0n && v < 0x100000n) consts.push({ at: p, rd: w & 0x1f, v });
  }
  if ((w & 0xfc000000) >>> 0 === 0x94000000) {
    let imm = w & 0x03ffffff;
    if (imm & 0x02000000) imm -= 0x04000000;
    calls.push({ at: p, to: BigInt(p) + BigInt(imm * 4) });
  }
}

console.log(`\nstack frames (sub sp, sp, #imm): ${subFrames.length}`);
for (const s of subFrames) console.log(`  0x${s.at.toString(16)}  #0x${s.imm.toString(16)}  (${s.imm})`);

console.log(`\nstack buffer addresses (add xN, sp, #imm): ${stackBuffers.length}`);
for (const s of stackBuffers.slice(0, 20)) console.log(`  0x${s.at.toString(16)}  x${s.rd} = sp + 0x${s.imm.toString(16)}  (${s.imm})`);

console.log(`\nsize-like constants (movz): ${consts.length}`);
for (const c of consts.slice(0, 20)) console.log(`  0x${c.at.toString(16)}  x${c.rd} = 0x${c.v.toString(16)}  (${c.v})`);

console.log(`\ncalls: ${calls.length}`);
for (const c of calls) console.log(`  0x${c.at.toString(16)}  -> 0x${c.to.toString(16)}`);
