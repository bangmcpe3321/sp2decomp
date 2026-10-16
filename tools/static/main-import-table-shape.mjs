// Characterise main's import table.
//
// main.elf (the decompressed NSO) contains each platform symbol only 1-2 times. An
// import table lists each unresolved symbol once, so this is consistent with the 51
// platform functions being *undefined imports* rather than locally declared ones.
// This measures the table's shape.
import { readFileSync } from "node:fs";

const b = readFileSync("C:/Users/Hexa/Documents/nintendo/re-work/main.elf");
const s = b.toString("latin1");

const probes = [
  "_ZN2nn2os15QueryMemoryInfo",
  "_ZN2nn2os19AllocateMemoryBlock",
  "_ZN2nn2os12CreateThread",
  "_ZN2nn2os13GetSystemTick",
  "_ZN2nn2os10LockMutex",
  "_ZN2nn2os11UnlockMutex",
  "_ZN2nn2os11SleepThread",
  "_ZN2nn3mem17StandardAllocator",
  "_ZN2nn4init19InitializeAllocator",
  "_ZN2nn2vi10Initialize",
  "_ZN2nn2fs8MountRom",
  "_ZN2nn4time",
];

console.log("=== occurrences of each platform symbol as text in main.elf ===\n");
for (const p of probes) {
  const c = s.split(p).length - 1;
  console.log(`  ${String(c).padStart(4)}  ${p}`);
}

// If this is an import table, the names should cluster in one region. Find where.
console.log("\n=== where do these names live in main? ===");
const locs = [];
for (const p of probes) {
  const i = s.indexOf(p);
  if (i >= 0) locs.push({ p, file: i, mem: i - 0x100 });
}
locs.sort((a, c) => a.file - c.file);
for (const l of locs) {
  console.log(`  file 0x${l.file.toString(16)}  mem 0x${l.mem.toString(16)}  ${l.p}`);
}
if (locs.length > 1) {
  const span = locs[locs.length - 1].file - locs[0].file;
  console.log(`\n  span: 0x${span.toString(16)} (${span} bytes) across ${locs.length} names`);
  console.log(`  clustered: ${span < 0x20000 ? "YES - consistent with one table" : "NO - scattered"}`);
}

// Compare with a symbol we know is heavily referenced inside main.
console.log("\n=== control: how often does main reference its own code symbols? ===");
for (const p of ["_ZN3sead9HeapMgr", "_ZN2Lp3Sys7SysInit", "_ZN4sead10GameFramework"]) {
  console.log(`  ${String(s.split(p).length - 1).padStart(5)}  ${p}`);
}
