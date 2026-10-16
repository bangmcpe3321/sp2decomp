// Confirm the .text section is AArch64 and census function prologues.
// Reads the decompressed NSO directly; .text content starts at file offset 0x100.
import { readFileSync } from "node:fs";

const b = readFileSync(process.argv[2] ?? "main.elf");
const TEXT_OFF = 0x100;
const TEXT_SIZE = 0x1415068;
const text = b.subarray(TEXT_OFF, TEXT_OFF + TEXT_SIZE);

let stp = 0;
let stpPair = 0;
let bti = 0;
let pac = 0;
const samples = [];
for (let i = 0; i + 4 <= text.length; i += 4) {
  const w = text.readUInt32LE(i);
  // STP x29, x30, [sp, #-imm]!  -> 1010 1001 10 imm7 11110 11101
  if ((w & 0xffc07fff) >>> 0 === 0xa9807bfd) {
    stp++;
    if (samples.length < 6) samples.push("0x" + i.toString(16) + ":" + w.toString(16));
  }
  // STP x29, x30, [sp, #imm]
  if ((w & 0xffc07fff) >>> 0 === 0xa9007bfd) stpPair++;
  if (w === 0xd503245f) bti++;
  if (w === 0xd503233f || w === 0xd50323bf) pac++;
}

const words = text.length / 4;
console.log(`words scanned          : ${words}`);
console.log(`STP x29,x30,[sp,#-N]!  : ${stp}`);
console.log(`STP x29,x30,[sp,#N]    : ${stpPair}`);
console.log(`BTI c                  : ${bti}`);
console.log(`PACIBSP/AUTIBSP        : ${pac}`);
console.log(`sample STP sites       : ${samples.join("  ")}`);

// A cheap sanity check: 0x14000000-based B (unconditional branch) density
let bcount = 0;
for (let i = 0; i + 4 <= text.length; i += 4) {
  if ((text.readUInt32LE(i) & 0xfc000000) === 0x14000000) bcount++;
}
console.log(`B (0x14......) count   : ${bcount}`);
console.log(`first 8 words hex      : ${[...text.subarray(0, 32)].map((x) => x.toString(16).padStart(2, "0")).join(" ")}`);
