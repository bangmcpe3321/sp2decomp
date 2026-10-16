// Targeted static analysis of the reconstructed Switch module.
//
// Works on the decompressed NSO (flat image: file offset == memory offset for
// every section), which avoids depending on any tool reaching the internet or
// completing a full auto-analysis.
import { readFileSync } from "node:fs";

const path = process.argv[2] ?? "main.elf";
const b = readFileSync(path);

const TEXT = { off: 0x100, va: 0x0, size: 0x1415068 };
const RODATA = { off: 0x1416100, va: 0x1416000, size: 0x194c4b3 };
const DATA = { off: 0x2d63100, va: 0x2d63000, size: 0x2781b0 };

console.log("=== section map (decompressed NSO, file offset == VA for content) ===");
for (const [n, s] of [["text", TEXT], ["rodata", RODATA], ["rwdata", DATA]]) {
  console.log(`  ${n.padEnd(7)} VA 0x${s.va.toString(16)} .. 0x${(s.va + s.size).toString(16)}  size 0x${s.size.toString(16)}`);
}

// ---- ARM64 function-prologue census -------------------------------------
// Switch AArch64 code compiled by Nintendo's clang overwhelmingly opens with
// STP x29, x30, [sp, #-N]!  (0xA9B?7BFD) or a SUB sp, sp, #imm variant.
const text = b.subarray(TEXT.off, TEXT.off + TEXT.size);
let stpFrames = 0;
let pacish = 0;
let first = [];
for (let i = 0; i + 4 <= text.length; i += 4) {
  const w = text.readUInt32LE(i);
  // STP x29, x30, [sp, #-imm]! : 0xA9B?7BFD
  if ((w & 0xffe07fff) === 0xa9807bfd || (w & 0xffc07fff) === 0xa9807bfd) {
    stpFrames++;
    if (first.length < 5) first.push({ va: TEXT.va + i, w: w.toString(16) });
  }
  // PACIASP / AUTIASP style: 0xD503233F / 0xD50323BF
  if (w === 0xd503233f || w === 0xd50323bf) pacish++;
}
console.log("\n=== AArch64 prologue census (.text) ===");
console.log(`  total words scanned      : ${text.length / 4}`);
console.log(`  STP x29,x30,[sp,#-N]! sites: ${stpFrames}`);
console.log(`  PACIBSP/AUTIBSP sites     : ${pacish}`);
if (first.length) console.log(`  sample prologue VAs       : ${first.map((f) => "0x" + f.va.toString(16)).join(", ")}`);

// ---- byml / resource string inventory -----------------------------------
const ro = b.toString("latin1", RODATA.off, RODATA.off + RODATA.size);
const byml = new Map();
{
  const re = /[\x20-\x7e]{4,}\.(?:byml|bfres|szs|bars|bgm|txt)\b/g;
  let m;
  while ((m = re.exec(ro)) !== null) {
    const v = m[0];
    if (!byml.has(v)) byml.set(v, RODATA.va + m.index);
  }
}
console.log(`\n=== resource names in .rodata: ${byml.size} distinct ===`);
const entries = [...byml.entries()];
for (const [k, va] of entries.slice(0, 60)) console.log(`  0x${va.toString(16)}  ${k}`);
if (entries.length > 60) console.log(`  ... ${entries.length - 60} more`);

// ---- name namespaces -----------------------------------------------------
const counts = {};
for (const m of ro.matchAll(/[\x20-\x7e]{6,}/g)) {
  const t = m[0];
  for (const ns of ["sead", "nn::", "Cmn::", "Cmn", "Lp::", "Game", "agl", "al::", "nw::", "eui::"]) {
    if (t.includes(ns)) counts[ns] = (counts[ns] || 0) + 1;
  }
}
console.log("\n=== namespace token hits in .rodata strings ===");
for (const [k, v] of Object.entries(counts).sort((a, c) => c[1] - a[1])) {
  console.log(`  ${k.padEnd(8)} ${v}`);
}
