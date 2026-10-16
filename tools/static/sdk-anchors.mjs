// Locate the sdk functions that implement specific nn::os behaviour, using
// symbol-free instruction markers.
//
// Anchors:
//   MRS CNTPCT_EL0  -> nn::os::GetSystemTick (and friends)
//   MRS MPIDR_EL1   -> core-id queries
//   SVC             -> any syscall wrapper (CreateThread, mutexes, ...)
//
// For each marker site this reports the containing function, found by scanning
// backwards for a prologue (stp x29,x30,[sp,#-N]!).
import { readFileSync, writeFileSync } from "node:fs";

const path = process.argv[2] ?? "sdk.elf";
const outPath = process.argv[3] ?? "sdk-anchors.txt";

const b = readFileSync(path);
const TEXT_OFF = 0x1000;
const TEXT_SIZE = 0x2ce04c;
const text = b.subarray(TEXT_OFF, TEXT_OFF + TEXT_SIZE);
const hex = (v) => "0x" + v.toString(16);

const u32 = (i) => (i >= 0 && i + 4 <= text.length ? text.readUInt32LE(i) : null);

// find the function containing a byte offset: scan back for the prologue
const isPrologue = (w) => (w & 0xffc07fff) >>> 0 === 0xa9807bfd; // stp x29,x30,[sp,#-N]!
function funcStart(off) {
  for (let p = off; p >= Math.max(0, off - 0x4000); p -= 4) {
    const w = u32(p);
    if (w === null) continue;
    if (isPrologue(w)) return p;
  }
  return null;
}
function funcEnd(start) {
  for (let p = start; p < Math.min(text.length, start + 0x20000); p += 4) {
    if (u32(p) === 0xd65f03c0) return p;
  }
  return start;
}

const MARKERS = [
  { name: "MRS CNTPCT_EL0", value: 0xd53be020, mask: 0xffffffe0, meaning: "physical counter -> GetSystemTick" },
  { name: "MRS CNTVCT_EL0", value: 0xd53be040, mask: 0xffffffe0, meaning: "virtual counter" },
  { name: "MRS MPIDR_EL1", value: 0xd53bd040, mask: 0xffffffe0, meaning: "core id -> GetCurrentCoreNumber" },
  { name: "SVC", value: 0xd4000001, mask: 0xffe0001f, meaning: "syscall wrapper" },
];

const out = [];
out.push(`symbol-free anchors in ${path}`);
out.push("");
const summary = {};

for (const mk of MARKERS) {
  const sites = [];
  for (let i = 0; i + 4 <= text.length; i += 4) {
    const w = text.readUInt32LE(i);
    if ((w & mk.mask) >>> 0 === mk.value) sites.push(i);
  }
  summary[mk.name] = sites.length;
  out.push(`## ${mk.name} (${sites.length} sites) — ${mk.meaning}`);
  out.push("");

  const byFunc = new Map();
  for (const s of sites) {
    const fs = funcStart(s);
    if (fs === null) continue;
    if (!byFunc.has(fs)) byFunc.set(fs, []);
    byFunc.get(fs).push(s);
  }
  // report the functions with the most sites first
  const ranked = [...byFunc.entries()].sort((a, c) => c[1].length - a[1].length);
  for (const [fs, ss] of ranked.slice(0, 12)) {
    const size = funcEnd(fs) - fs;
    out.push(`  func ${hex(fs)}  (${size} bytes)  ${ss.length} site(s) at ${ss.slice(0, 4).map(hex).join(", ")}`);
  }
  if (ranked.length === 0) out.push("  (no containing function resolved)");
  out.push("");
}

writeFileSync(outPath, out.join("\n") + "\n");
console.log(out.join("\n"));

// Emit the candidate GetSystemTick addresses for decompilation
const cntSites = [];
for (let i = 0; i + 4 <= text.length; i += 4) {
  const w = text.readUInt32LE(i);
  if ((w & 0xffffffe0) >>> 0 === 0xd53be020) cntSites.push(i);
}
const funcs = [...new Set(cntSites.map(funcStart).filter((x) => x !== null))];
console.log(`distinct functions reading CNTPCT_EL0: ${funcs.length}`);
writeFileSync(outPath.replace(/\.txt$/, "-addrs.txt"), funcs.map((f) => "0x" + f.toString(16)).join(",") + "\n");
console.log(`wrote ${outPath.replace(/\.txt$/, "-addrs.txt")}`);
