// Map each platform import to the GOT slot its thunk dereferences.
//
// Every platform function in main is `(*(code *)PTR_<Name>_<slot>)()`. That PTR symbol
// names the slot, which is the reliable handle: the PORT_WORKLIST.md addresses are GOT
// slots Ghidra promoted to functions, and address lookup on them fails, but the PTR
// symbol is a real data reference. Callers of the import are then found by looking for
// references to that GOT slot (Ghidra renders them as `PTR_<Name>_<slot>` in pseudocode).
import { readFileSync, writeFileSync } from "node:fs";

const decompPath = process.argv[2] ?? "platform-decompiled.txt";
const outPath = process.argv[3] ?? "platform-ptr-slots.txt";

const text = readFileSync(decompPath, "utf8").replace(/^\uFEFF/, "");

// each block: "0x<va>  <name>" then meta then body containing PTR_<Name>_<slot>
const blocks = [];
{
  const parts = text.split(/^=+\s*$/m);
  for (const p of parts) {
    const hm = /^\s*0x([0-9a-f]+)\s+(\S.*)$/m.exec(p);
    if (!hm) continue;
    blocks.push({ va: "0x" + hm[1], name: hm[2].trim(), body: p });
  }
}

const rows = [];
for (const b of blocks) {
  const ptrs = [...b.body.matchAll(/PTR_([A-Za-z0-9_]+)_(710[0-9a-f]{7})/g)];
  // the thunk's own name may be mangled; prefer the PTR symbol's name
  const slots = new Map();
  for (const m of ptrs) slots.set(m[2], m[1]);
  for (const [slot, name] of slots) {
    rows.push({ thunkVa: b.va, thunkName: b.name, slot: "0x" + slot, ptrName: name });
  }
}

console.log(`thunks examined     : ${blocks.length}`);
console.log(`import -> slot rows : ${rows.length}`);

// dedupe by slot (a thunk may mention its slot once)
const bySlot = new Map();
for (const r of rows) if (!bySlot.has(r.slot)) bySlot.set(r.slot, r);
console.log(`distinct GOT slots  : ${bySlot.size}`);

// group by namespace using the ptrName where possible
const groups = new Map();
for (const r of [...bySlot.values()]) {
  const ns = /^nv/.test(r.ptrName) ? "nv/nvn" : r.ptrName.slice(0, 2);
  if (!groups.has(ns)) groups.set(ns, 0);
  groups.set(ns, groups.get(ns) + 1);
}

writeFileSync(
  outPath,
  [...bySlot.values()].map((r) => `${r.slot}\t${r.ptrName}\t${r.thunkVa}\t${r.thunkName}`).join("\n") + "\n",
);
console.log(`wrote ${outPath}`);

console.log("\nsample import -> slot map:");
for (const r of [...bySlot.values()].slice(0, 12)) {
  console.log(`  ${r.slot}  ${r.ptrName.padEnd(28)} (thunk ${r.thunkVa} ${r.thunkName})`);
}
