// Profile sead::GameFrameworkNx::initializeGraphicsSystem (0x7100e6738c, 2372 bytes).
//
// The boot runner currently stops here, so this is the entry to the graphics subsystem.
// The question: what does it actually require, and how much is platform (nn::vi / NVN)
// versus engine (sead::GraphicsNvn / agl)?
import { readFileSync } from "node:fs";

const body = readFileSync("igs.txt", "utf8");
const inv = readFileSync("inventory.txt", "utf8");

// --- distinct callees ---------------------------------------------------------------
const DIRECT = [];
const seen = new Set();
const SKIP = new Set(["if", "while", "for", "switch", "return", "sizeof", "code", "undefined",
  "long", "char", "int", "uint", "bool", "undefined1", "undefined4", "undefined8", "void",
  "ulong", "uchar", "ushort", "float", "double"]);

for (const ln of body.split("\n")) {
  for (const m of ln.matchAll(/(?:^|[\s=(*])([A-Za-z_][A-Za-z0-9_]*(?:::[A-Za-z_~][A-Za-z0-9_]*)*)\s*\(/g)) {
    const n = m[1];
    if (SKIP.has(n)) continue;
    if (/^(local_|uStack_|aCStack|aDStack|LAB_|param_|this)/.test(n)) continue;
    if (/^(undefined|char|long|int|uint|ulong|bool|code|void|float|double|ushort|uchar)\d*$/.test(n)) continue;
    if (n === "GameFrameworkNx" || n === "GraphicsNvn" || n === "DisplayBufferNvn" ||
        n === "DelegateThread" || n === "StandardAllocator") continue; // type names in decls
    if (!seen.has(n)) { seen.add(n); DIRECT.push(n); }
  }
}

// --- indirect dispatch sites --------------------------------------------------------
const indirect = (body.match(/\(\*\*\(code \*\*\)/g) || []).length;
const labRefs = [...new Set([...body.matchAll(/&LAB_([0-9a-f]+)/g)].map((m) => m[1]))];
const ptrRefs = [...new Set([...body.matchAll(/PTR_(\w+?)_([0-9a-f]{16})/g)].map((m) => `${m[1]}`))];

console.log("=== initializeGraphicsSystem (0x7100e6738c, 2372 bytes) ===");
console.log(`distinct named callees : ${DIRECT.length}`);
console.log(`indirect dispatch sites: ${indirect}`);
console.log(`local function addrs   : ${labRefs.length}`);
console.log(`named .data/.bss ptrs  : ${ptrRefs.length}`);

console.log("\n--- named callees ---");
for (const n of DIRECT) console.log("   " + n);

console.log("\n--- named globals referenced ---");
for (const p of ptrRefs) console.log("   PTR_" + p);

// --- how many of these are in the binary's symbol table, and where -------------------
const addr = new Map();
for (const ln of inv.split("\n")) {
  const m = /^FUNCTION\s+([0-9a-f]+)\s+(\S+)/.exec(ln);
  if (m) addr.set(m[2], m[1]);
}
function lookup(frag) {
  for (const [k, v] of addr) if (k.includes(frag)) return "0x" + v;
  return "(not found)";
}
console.log("\n--- addresses for the engine-side callees ---");
for (const frag of ["GraphicsNvn", "DisplayBufferNvn", "nv::SetGraphicsAllocator",
                    "DisplayBuffer", "GameFrameworkNx"]) {
  console.log(`   ${frag.padEnd(28)} ${lookup(frag)}`);
}
