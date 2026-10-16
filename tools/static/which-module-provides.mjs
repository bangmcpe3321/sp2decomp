// Which ExeFS module provides main's platform imports?
//
// Round-4b finding: sdk's export table is nn::fs-dominated (233 FS exports) with only 8
// nn::os and ZERO nn::mem / nn::init / nn::vi / nn::time. So sdk does not provide the
// platform layer main imports. This checks the sibling modules.
import { readFileSync, existsSync } from "node:fs";

const EXEFS = "C:/Users/Hexa/Documents/nintendo/hactool-1.4.0-win/exefs";
const FILE_BASE = 0x100;

const MODULES = ["rtld", "main", "sdk", "subsdk0", "subsdk1", "subsdk2", "subsdk3"];
const PROBES = [
  ["nn::os::QueryMemoryInfo", "_ZN2nn2os15QueryMemoryInfo"],
  ["nn::os::AllocateMemoryBlock", "_ZN2nn2os19AllocateMemoryBlock"],
  ["nn::os::CreateThread", "_ZN2nn2os12CreateThread"],
  ["nn::os::GetSystemTick", "_ZN2nn2os13GetSystemTick"],
  ["nn::mem::StandardAllocator", "_ZN2nn3mem17StandardAllocator"],
  ["nn::init::InitializeAllocator", "_ZN2nn4init19InitializeAllocator"],
  ["nn::vi::Initialize", "_ZN2nn2vi10Initialize"],
];

console.log("=== platform symbols present as strings in each ExeFS module ===\n");
console.log("module".padEnd(10) + PROBES.map((p) => p[0].replace(/^nn::/, "").slice(0, 12).padStart(14)).join(""));

for (const m of MODULES) {
  const p = `${EXEFS}/${m}`;
  if (!existsSync(p)) {
    console.log(`${m.padEnd(10)} (absent)`);
    continue;
  }
  const b = readFileSync(p);
  // the NSO is lz4-compressed; strings may not be readable, so note that
  const magic = b.toString("latin1", 0, 4);
  const s = b.toString("latin1");
  const row = PROBES.map(([, sym]) => String(s.split(sym).length - 1).padStart(14));
  console.log(`${m.padEnd(10)}${row.join("")}   [${magic}, ${b.length} bytes]`);
}

// The decompressed sdk is available; check it properly for the full namespace picture.
console.log("\n=== decompressed sdk: which platform namespaces appear at all (as text)? ===");
if (existsSync("C:/Users/Hexa/Documents/nintendo/re-work/sdk.decompressed")) {
  const b = readFileSync("C:/Users/Hexa/Documents/nintendo/re-work/sdk.decompressed");
  const s = b.toString("latin1");
  for (const ns of ["2os", "3mem", "4init", "2vi", "2fs", "4time", "4diag", "4util", "4nifm", "2oe"]) {
    const re = new RegExp(`_ZN2nn${ns}`, "g");
    const c = (s.match(re) || []).length;
    console.log(`  _ZN2nn${ns.padEnd(6)} occurrences: ${String(c).padStart(6)}`);
  }
}

console.log("\n=== does main's own NSO declare the imports as undefined symbols? ===");
if (existsSync("C:/Users/Hexa/Documents/nintendo/re-work/main.elf")) {
  const b = readFileSync("C:/Users/Hexa/Documents/nintendo/re-work/main.elf");
  const s = b.toString("latin1");
  for (const [label, sym] of PROBES) {
    const c = s.split(sym).length - 1;
    console.log(`  ${label.padEnd(32)} occurrences in main: ${c}`);
  }
}
