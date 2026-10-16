// Emit the raw marker-site addresses (not enclosing-function guesses).
//
// The previous round scanned backwards for a prologue to find the enclosing
// function and got it wrong, because `stp x29,x30,[sp,#-N]!` also appears for
// secondary stack frames inside larger functions. Ghidra already knows the real
// function boundaries, so hand it the sites and let it answer.
import { readFileSync, writeFileSync } from "node:fs";

const path = process.argv[2] ?? "sdk.elf";
const outPath = process.argv[3] ?? "sdk-marker-sites.txt";

const b = readFileSync(path);
const TEXT_OFF = 0x1000;
const TEXT_SIZE = 0x2ce04c;
const text = b.subarray(TEXT_OFF, TEXT_OFF + TEXT_SIZE);

const MARKERS = [
  { name: "CNTPCT_EL0", value: 0xd53be020, mask: 0xffffffe0 },
  { name: "CNTVCT_EL0", value: 0xd53be040, mask: 0xffffffe0 },
  { name: "MPIDR_EL1", value: 0xd53bd040, mask: 0xffffffe0 },
  { name: "SVC", value: 0xd4000001, mask: 0xffe0001f },
];

const all = [];
console.log("marker sites (memory addresses, .text base 0):");
for (const mk of MARKERS) {
  const sites = [];
  for (let i = 0; i + 4 <= text.length; i += 4) {
    const w = text.readUInt32LE(i);
    if ((w & mk.mask) >>> 0 === mk.value) sites.push(i);
  }
  console.log(`  ${mk.name.padEnd(12)} ${sites.length} sites`);
  for (const s of sites) all.push({ site: s, marker: mk.name });
}

// Emit every site address; the Java script will map each to its containing function.
const addrs = all.map((a) => "0x" + a.site.toString(16));
writeFileSync(outPath, addrs.join(",") + "\n");
writeFileSync(
  outPath.replace(/\.txt$/, "-labeled.txt"),
  all.map((a) => `0x${a.site.toString(16)}\t${a.marker}`).join("\n") + "\n",
);
console.log(`\nwrote ${outPath} (${addrs.length} site addresses)`);
