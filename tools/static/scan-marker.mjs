// Scan .rodata of the reconstructed NSO for library markers and game strings.
import { readFileSync } from "node:fs";

const path = process.argv[2] ?? "main.converted.elf";
const b = readFileSync(path);

// In the converted image .rodata memory offset == its address; file offset is
// shifted by the 0x1000 file base.
const RODATA_VA = 0x1416000;
const RODATA_FILE = 0x1417000;
const RODATA_SIZE = 0x194c4b3;
const slice = b.toString("latin1", RODATA_FILE, RODATA_FILE + RODATA_SIZE);

const count = (needle) => {
  let n = 0;
  let i = 0;
  for (;;) {
    i = slice.indexOf(needle, i);
    if (i === -1) break;
    n++;
    i += needle.length;
  }
  return n;
};

console.log("marker counts in .rodata:");
for (const m of ["sead", "_ZN4sead", "sead::", "al::", "agl", "nn::gfx", "Nw4f", "radiance", "unity", "Blitz", "Gambit", "splatoon"]) {
  console.log(`  ${m.padEnd(12)} ${count(m)}`);
}

const va = (fileOffsetInSlice) => 0x1416000 + fileOffsetInSlice;

console.log("\nmangled sead symbols (sample, up to 30):");
const re = /[\x20-\x7e]{8,}/g;
let m;
let shown = 0;
while ((m = re.exec(slice)) !== null) {
  const t = m[0];
  if (/^_ZN4sead/.test(t) || /sead::/.test(t)) {
    console.log(`  0x${va(m.index).toString(16)}  ${t.slice(0, 130)}`);
    if (++shown >= 30) break;
  }
}
if (shown === 0) console.log("  (none)");

console.log("\nreadable file-path style strings (up to 15):");
const rePath = /[\x20-\x7e]{10,}\.(?:cpp|h|hpp|json|byml|szs|bfres|txt)\b/g;
let p;
let shownP = 0;
while ((p = rePath.exec(slice)) !== null) {
  console.log(`  0x${va(p.index).toString(16)}  ${p[0].slice(0, 130)}`);
  if (++shownP >= 15) break;
}
if (shownP === 0) console.log("  (none)");
