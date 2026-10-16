// Build the address list for the 51 platform functions in PORT_WORKLIST.md, read
// straight from the worklist so the two never drift.
import { readFileSync, writeFileSync } from "node:fs";

const worklist = process.argv[2] ?? "PORT_WORKLIST.md";
const outPath = process.argv[3] ?? "platform-addrs.txt";

const text = readFileSync(worklist, "utf8");

// Worklist rows look like: | `0x7101413ec8` | `nn::os::AllocateMemoryBlock` | ... |
const rows = [];
for (const ln of text.split("\n")) {
  const m = /^\|\s*`(0x[0-9a-f]+)`\s*\|\s*`([^`]+)`\s*\|/.exec(ln);
  if (m) rows.push({ va: m[1], name: m[2] });
}

// de-duplicate by address (a function can appear under more than one label)
const seen = new Map();
for (const r of rows) if (!seen.has(r.va)) seen.set(r.va, r.name);

const list = [...seen.entries()].map(([va, name]) => ({ va, name }));

console.log(`worklist rows parsed: ${rows.length}`);
console.log(`distinct addresses    : ${list.length}`);

// group by namespace for readability
const groups = new Map();
for (const e of list) {
  const ns = /^nv[n:]?/.test(e.name) ? "nv/nvn" : e.name.split("::").slice(0, 2).join("::");
  if (!groups.has(ns)) groups.set(ns, []);
  groups.get(ns).push(e);
}
console.log("");
for (const [ns, items] of [...groups.entries()].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`  ${String(items.length).padStart(3)}  ${ns}`);
}

// CSV of addresses for the Ghidra script argument
const csv = list.map((e) => e.va).join(",");
writeFileSync(outPath, csv + "\n");
console.log(`\nwrote ${outPath} (${csv.length} chars)`);

// also emit a readable index next to it
writeFileSync(
  outPath.replace(/\.txt$/, "-index.txt"),
  list.map((e) => `${e.va}\t${e.name}`).join("\n") + "\n",
);
console.log(`wrote ${outPath.replace(/\.txt$/, "-index.txt")}`);
