// Census of mangled C++ symbols in .rodata, grouped by top-level namespace.
import { readFileSync } from "node:fs";

const b = readFileSync(process.argv[2] ?? "main.elf");
const RODATA_OFF = 0x1416100;
const RODATA_VA = 0x1416000;
const RODATA_SIZE = 0x194c4b3;
const ro = b.toString("latin1", RODATA_OFF, RODATA_OFF + RODATA_SIZE);

const itanium = /_Z(?:N|TV|TI|TS|TT)[A-Za-z0-9_]{6,}/g;
const byNs = new Map();
let total = 0;
const all = new Set();
for (const m of ro.matchAll(itanium)) {
  const s = m[0];
  if (all.has(s)) continue;
  all.add(s);
  total++;
  // _ZN<len><ns>...  -> take the first namespace component
  let ns = "?";
  const mm = /^_ZN(\d+)/.exec(s);
  if (mm) {
    const len = Number(mm[1]);
    const start = mm[0].length;
    ns = s.slice(start, start + len);
  } else if (/^_ZTV|^_ZTI|^_ZTS|^_ZTT/.test(s)) {
    ns = "<vtable/typeinfo>";
  }
  byNs.set(ns, (byNs.get(ns) || 0) + 1);
}

console.log(`distinct mangled C++ symbols in .rodata: ${total}`);
console.log("\ntop namespaces:");
for (const [ns, c] of [...byNs.entries()].sort((a, c) => c[1] - a[1]).slice(0, 25)) {
  console.log(`  ${String(c).padStart(6)}  ${ns}`);
}

const nn = [...all].filter((s) => s.includes("2nn"));
const sead = [...all].filter((s) => s.includes("4sead"));
console.log(`\nsymbols containing '2nn'  : ${nn.length}`);
console.log(`symbols containing '4sead': ${sead.length}`);

console.log("\nsample nn:: symbols:");
for (const s of nn.slice(0, 12)) console.log("  " + s.slice(0, 120));

const nonLib = [...all].filter((s) => !s.includes("4sead") && !s.includes("2nn") && !s.includes("3agl"));
console.log(`\nnon-(sead|nn|agl)-prefixed symbols: ${nonLib.length}`);
console.log("sample (likely game code):");
for (const s of nonLib.slice(0, 25)) console.log("  " + s.slice(0, 120));
