// Scope the GameFramework::initialize subtree: what does the 456-byte body actually call,
// and which of those are already available?
//
// This is the "scope before porting" step that the registerCallback failure showed was
// necessary -- far cheaper than discovering the shape mid-port.
import { readFileSync, writeFileSync } from "node:fs";

const body = readFileSync("gf-init.txt", "utf8");

// Distinct callee names, in first-appearance order.
const ORDER = [];
const seen = new Set();
for (const ln of body.split("\n")) {
  // direct calls: Name(  or Name::Something(
  for (const m of ln.matchAll(/(?:^|[\s=(])([A-Za-z_][A-Za-z0-9_]*(?:::[A-Za-z_~][A-Za-z0-9_]*)*)\s*\(/g)) {
    const n = m[1];
    if (["if", "while", "for", "switch", "return", "sizeof", "undefined", "long", "char"].includes(n)) continue;
    if (/^(undefined|char|long|int|uint|ulong|bool|code|Heap|undefined8|undefined4|undefined1)$/.test(n)) continue;
    if (n.startsWith("local_") || n.startsWith("uStack_") || n.startsWith("aCStack") || n.startsWith("aDStack")) continue;
    if (!seen.has(n)) { seen.add(n); ORDER.push(n); }
  }
}

// Indirect (vtable) dispatch sites -- not statically resolvable.
const indirect = (body.match(/\(\*\*\(code \*\*\)/g) || []).length;
const heapVtable = (body.match(/\+ 0x80\)\)/g) || []).length;

// Which names are already ported in the repository?
const ported = new Set([
  "dumpDateTime", "dumpMemoryInfo",
  "registerCallback", "connect", "release", "insertFront_", "insertBack_", "erase_",
  "GetSystemTick", "QueryMemoryInfo", "SetMemoryHeapSize", "AllocateMemoryBlock",
  "InitializeAllocator", "setNow", "getCalendarTime",
]);
const inSeadRef = new Set([
  "Framework::initialize", "HeapMgr::setCurrentHeap_", "ExpHeap::create",
  "ResourceMgr::createInstance", "FileDeviceMgr::createInstance",
  "GameFrameworkNx::initialize", "PerformanceMgrNx::initialize",
]);

console.log("=== GameFramework::initialize (0x7100e69fe4, 456 bytes) ===");
console.log(`distinct callees: ${ORDER.length}`);
console.log(`vtable/indirect dispatch sites: ${indirect}`);
console.log(`heap-virtual calls (vptr+0x80): ${heapVtable}`);

console.log("\n--- callees in first-appearance order ---");
for (const n of ORDER) {
  const tag = ported.has(n) ? "PORTED " : inSeadRef.has(n) ? "REFERENCE" : "        ";
  console.log(`  ${tag}  ${n}`);
}

// Which of these exist in the decompiled inventory (i.e. have a body available)?
let inv = "";
try { inv = readFileSync("inventory.txt", "utf8"); } catch { /* optional */ }
const haveBody = new Set();
if (inv) {
  for (const ln of inv.split("\n")) {
    const m = /^FUNCTION\s+([0-9a-f]+)\s+(\S+)/.exec(ln);
    if (m) haveBody.add(m[2]);
  }
}
console.log("\n--- address availability for the sead-reference names ---");
const PROBE = [
  ["Framework::initialize", "_ZN4sead9Framework10initializeERKNS0_13InitializeArgE"],
  ["HeapMgr::setCurrentHeap_", "_ZN4sead7HeapMgr15setCurrentHeap_EPNS_4HeapE"],
  ["ExpHeap::create", "_ZN4sead7ExpHeap6createEjRKNS_4Heap7CreateArgEPS1_ib"],
  ["ResourceMgr::createInstance", "_ZN4sead11ResourceMgr14createInstanceEPNS_4HeapE"],
  ["FileDeviceMgr::createInstance", "_ZN4sead13FileDeviceMgr14createInstanceEPNS_4HeapE"],
];
const addr = new Map();
if (inv) {
  for (const ln of inv.split("\n")) {
    const m = /^FUNCTION\s+([0-9a-f]+)\s+(\S+)/.exec(ln);
    if (m) addr.set(m[2], m[1]);
  }
}
for (const [label, mangled] of PROBE) {
  // exact, else prefix match
  let hit = addr.get(mangled);
  if (!hit && inv) {
    for (const [k, v] of addr) {
      if (k.startsWith(mangled.slice(0, 40))) { hit = v; break; }
    }
  }
  console.log(`  ${hit ? "0x" + hit : "  (not found)"}  ${label}`);
}
