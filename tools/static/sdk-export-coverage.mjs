// Does sdk's export name table cover the symbols main imports?
//
// This is the check that decides whether the export-table lead can succeed: if the
// 511 names include main's platform symbols, finding the address array is worthwhile;
// if they do not, this route cannot map the imports at all.
import { readFileSync } from "node:fs";

const b = readFileSync("sdk.decompressed");
const FILE_BASE = 0x100;
const STR = FILE_BASE + 0x3cb086;

// rebuild the export name list with the corrected walk
const names = [];
{
  let p = STR + 1;
  let misses = 0;
  while (p < b.length && misses < 40) {
    const z = b.indexOf(0, p);
    if (z < 0) break;
    const tok = b.toString("latin1", p, z);
    if (tok.length >= 4 && /^_Z[A-Za-z0-9_]+$/.test(tok)) {
      names.push(tok);
      misses = 0;
    } else {
      misses++;
    }
    p = z + 1;
  }
}
console.log(`export names in table: ${names.length}`);

const nsCounts = {};
for (const n of names) {
  const m = /^_ZN(\d+)([A-Za-z0-9_]+)/.exec(n);
  const key = m ? `_ZN${m[1]}${m[2]}` : "<other>";
  nsCounts[key] = (nsCounts[key] || 0) + 1;
}
console.log("\ntop namespaces in the export table:");
for (const [k, v] of Object.entries(nsCounts).sort((a, c) => c[1] - a[1]).slice(0, 14)) {
  console.log(`  ${String(v).padStart(4)}  ${k}`);
}

// main's platform imports, by the demangled names from PORT_WORKLIST.md
const WANT = [
  "nn::os::GetSystemTick",
  "nn::os::QueryMemoryInfo",
  "nn::os::AllocateMemoryBlock",
  "nn::os::CreateThread",
  "nn::os::LockMutex",
  "nn::os::UnlockMutex",
  "nn::os::SleepThread",
  "nn::mem::StandardAllocator",
  "nn::vi::Initialize",
  "nn::fs::MountRom",
  "nn::time::",
  "nn::init::InitializeAllocator",
];

// match by the demangled-ish mangled prefix: _ZN2nn{len}{ns}{len}{fn}
function mangledPrefix(ns, fn) {
  return `_ZN2nn${ns.length}${ns}${fn.length}${fn}`;
}
const NS = {
  "nn::os::GetSystemTick": ["2os", "13GetSystemTick"],
  "nn::os::QueryMemoryInfo": ["2os", "15QueryMemoryInfo"],
  "nn::os::AllocateMemoryBlock": ["2os", "19AllocateMemoryBlock"],
  "nn::os::CreateThread": ["2os", "12CreateThread"],
  "nn::os::LockMutex": ["2os", "9LockMutex"],
  "nn::os::UnlockMutex": ["2os", "11UnlockMutex"],
  "nn::os::SleepThread": ["2os", "11SleepThread"],
  "nn::mem::StandardAllocator": ["3mem", "17StandardAllocator"],
  "nn::vi::Initialize": ["2vi", "10Initialize"],
  "nn::fs::MountRom": ["2fs", "8MountRom"],
  "nn::time::": ["4time", ""],
  "nn::init::InitializeAllocator": ["4init", "19InitializeAllocator"],
};

console.log("\n=== does the export table cover main's imports? ===");
let found = 0;
for (const [label, [ns, fn]] of Object.entries(NS)) {
  const hits = names.filter((n) => n.startsWith(`_ZN2nn${ns}${fn}`));
  if (hits.length) found++;
  console.log(`  ${hits.length ? "FOUND  " : "MISSING"} ${label.padEnd(30)} (${hits.length} match${hits.length === 1 ? "" : "es"})`);
  for (const h of hits.slice(0, 2)) console.log(`            ${h}`);
}
console.log(`\n${found} of ${Object.keys(NS).length} probed imports present in the export table`);

// per-namespace counts
console.log("\n=== export counts per platform namespace ===");
for (const [ns, label] of [["2os", "nn::os"], ["3mem", "nn::mem"], ["4init", "nn::init"], ["2vi", "nn::vi"], ["2fs", "nn::fs"], ["4time", "nn::time"]]) {
  const c = names.filter((n) => n.startsWith(`_ZN2nn${ns}`)).length;
  console.log(`  ${label.padEnd(10)} ${c}`);
}
