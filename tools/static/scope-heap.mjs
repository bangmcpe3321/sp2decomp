// Quantify the heap layer: how much is there, and how much is actually INTERFACE?
//
// The question this answers: is HeapMgr/ExpHeap a shallow tree (tractable) or the first
// real wall (a full allocator to reimplement)?
import { readFileSync } from "node:fs";

const inv = readFileSync("inventory.txt", "utf8");
const rows = [];
for (const ln of inv.split("\n")) {
  const m = /^FUNCTION\s+([0-9a-f]+)\s+(\S+)/.exec(ln);
  if (m) rows.push({ va: m[1], name: m[2] });
}

// Demangle crudely: pull the class and method out of the mangled name.
// NOTE the namespace is `pead`, not `sead` -- the heap layer lives in pead::, which is
// why an earlier sead-only search returned nothing.
function classify(name) {
  const m = /^_ZN4pead(\d+)/.exec(name);
  if (!m) return null;
  const clsLen = Number(m[1]);
  const start = m[0].length;
  const cls = name.slice(start, start + clsLen);
  const rest = name.slice(start + clsLen);
  const mm = /^(\d+)([A-Za-z0-9_]+)/.exec(rest);
  const method = mm ? mm[2] : "?";
  return { cls, method };
}

const CLASSES = ["HeapMgr", "ExpHeap", "Heap", "Arena", "MemBlock"];
const byClass = new Map();
for (const r of rows) {
  const c = classify(r.name);
  if (!c || !CLASSES.includes(c.cls)) continue;
  if (!byClass.has(c.cls)) byClass.set(c.cls, []);
  byClass.get(c.cls).push({ ...r, method: c.method });
}

console.log("=== heap-layer function counts ===");
let total = 0;
for (const c of CLASSES) {
  const n = byClass.get(c)?.length ?? 0;
  total += n;
  console.log(`  ${c.padEnd(10)} ${String(n).padStart(4)}`);
}
console.log(`  ${"TOTAL".padEnd(10)} ${String(total).padStart(4)}`);

console.log("\n=== HeapMgr: the boot path ===");
for (const r of byClass.get("HeapMgr") ?? []) {
  console.log(`  0x${r.va}  ${r.method}`);
}

console.log("\n=== ExpHeap: split into the INTERFACE the engine calls vs the ALGORITHM ===");
const exp = byClass.get("ExpHeap") ?? [];
// Methods the engine reaches through the Heap virtual interface.
const INTERFACE = /^(create|tryCreate|destroy|doCreate|alloc|free|resize|getAllocatableSize|getFreeSize|getMaxAllocatableSize|adjust|freeAll|getManagementAreaSize|destroyAndGetAllocatableSize|freeAndGetAllocatableSize)$/i;
const isInterfaceLike = (m) =>
  /^(create|tryCreate|destroy|doCreate|alloc|free|resize|freeAll|adjust|getAllocatableSize|getMaxAllocatableSize|getManagementAreaSize|destroyAnd)/i.test(m) ||
  /_$/.test(m);
const iface = [];
const algorithm = [];
for (const r of exp) {
  // Methods ending in _ are internal helpers (allocFromHead_, pushToFreeList_, ...).
  if (/_$/.test(r.method)) algorithm.push(r);
  else if (/^(allocFromHead|allocFromTail|pushTo|findFirst|findLast|createMaxSize|initFree|initUse)/i.test(r.method)) algorithm.push(r);
  else iface.push(r);
}
console.log(`  interface-like: ${iface.length}`);
for (const r of iface) console.log(`    0x${r.va}  ${r.method}`);
console.log(`  internal/algorithm (_-suffixed or block management): ${algorithm.length}`);
for (const r of algorithm) console.log(`    0x${r.va}  ${r.method}`);

console.log("\n=== Heap base class: the vtable the engine actually dispatches through ===");
for (const r of byClass.get("Heap") ?? []) {
  console.log(`  0x${r.va}  ${r.method}`);
}
console.log("\n=== Arena ===");
for (const r of byClass.get("Arena") ?? []) console.log(`  0x${r.va}  ${r.method}`);
