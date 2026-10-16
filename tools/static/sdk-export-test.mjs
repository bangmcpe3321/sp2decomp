// Do the exact symbols main imports exist as clean strings in sdk?
//
// This is the decisive test for whether sdk ::export::s the platform API rather than
// merely containing assertion text. If sdk's copy of a name sits in a dense string
// table next to hundreds of other _ZN2nn names, it is a symbol table; if it appears in
// the middle of a sentence, it is an assertion.
import { readFileSync, writeFileSync } from "node:fs";

const sdkPath = process.argv[2] ?? "sdk.decompressed";
const b = readFileSync(sdkPath);
const s = b.toString("latin1");
const FILE_BASE = 0x100;

// The 49 names main's thunks need, taken from PORT_WORKLIST.md.
const names = [
  "_ZN2nn2os13GetSystemTickEv",
  "_ZN2nn2os15QueryMemoryInfoEPNS0_10MemoryInfoE",
  "_ZN2nn2os19AllocateMemoryBlockE",
  "_ZN2nn2os12CreateThreadE",
  "_ZN2nn2os10LockMutexE",
  "_ZN2nn2os9MountRomE",
  "_ZN2nn3mem17StandardAllocator",
  "_ZN2nn2vi10InitializeEv",
];

console.log("=== is each imported symbol present as a clean string in sdk? ===\n");
for (const n of names) {
  const i = s.indexOf(n);
  if (i < 0) {
    console.log(`  ABSENT   ${n}`);
    continue;
  }
  // Show the surrounding bytes: a real symbol table has NUL on both sides.
  const pre = b[i - 1];
  const end = s.indexOf("\0", i);
  const post = b[end];
  let suffix = "";
  if (pre === 0 && post === 0) suffix = "  <-- NUL-delimited (symbol-table-like)";
  else if (pre === 0) suffix = `  <-- NUL before, continues: "${s.slice(i, Math.min(end, i + 60))}"`;
  else suffix = `  <-- mid-string, preceded by "${s.slice(Math.max(0, i - 12), i)}"`;
  console.log(`  PRESENT  ${n}\n           file=0x${i.toString(16)} mem=0x${(i - FILE_BASE).toString(16)}${suffix}`);
}

// How dense is the region around one of them? A symbol table is a run of
// NUL-separated _ZN2nn strings.
console.log("\n=== density test: run of NUL-separated _ZN2nn names ===\n");
for (const probe of ["_ZN2nn2os13GetSystemTickEv", "_ZN2nn3mem17StandardAllocator"]) {
  const i = s.indexOf(probe);
  if (i < 0) { console.log(`  ${probe}: absent`); continue; }
  // count NUL-separated tokens containing _ZN2nn within +/- 4 KB
  const lo = Math.max(0, i - 4096);
  const hi = Math.min(b.length, i + 4096);
  let count = 0;
  let p = lo;
  while (p < hi) {
    const z = s.indexOf("\0", p);
    if (z < 0 || z > hi) break;
    const tok = s.slice(p, z);
    if (tok.includes("_ZN2nn")) count++;
    p = z + 1;
  }
  console.log(`  ${probe}: ${count} NUL-separated _ZN2nn tokens within +/-4KB at 0x${i.toString(16)}`);
}

// Total count of well-formed complete mangled strings in the binary.
const m = s.match(/_ZN2nn[A-Za-z0-9_]{6,}/g) || [];
console.log(`\ntotal _ZN2nn occurrences: ${m.length}, distinct: ${new Set(m).size}`);

// Are they all complete (end cleanly) or truncated fragments?
let complete = 0;
for (const t of new Set(m)) {
  const i = s.indexOf(t);
  const nextIsNul = b[i + t.length] === 0;
  if (nextIsNul && /(Ev|E[0-9A-Za-z_]*E|E)$/.test(t)) complete++;
}
console.log(`of the distinct names, plausibly complete: ${complete}`);
