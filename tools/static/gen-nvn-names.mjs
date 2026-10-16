// Generate the NVN name table from nvnLoadCProcs's decompiled body.
//
// The names ARE the interface (see nvn.hpp): nvnLoadCProcs resolves each NVN function by name
// via a GetProcAddress callback. Emitting the real 453 names from the binary means the port's
// resolution order and surface are MEASURED, not invented -- and a test can assert the count
// and a few known endpoints rather than trusting a hand-written list.
import { readFileSync, writeFileSync } from "node:fs";

const body = readFileSync("loadc.txt", "utf8");

// Resolution order = first appearance of each literal in the body.
const names = [];
const seen = new Set();
for (const m of body.matchAll(/"(nvn[A-Za-z0-9_]+)"/g)) {
  if (!seen.has(m[1])) { seen.add(m[1]); names.push(m[1]); }
}

if (names.length !== 453) {
  console.error(`EXPECTED 453 names, found ${names.length} -- refusing to generate a wrong table`);
  process.exit(1);
}

const lines = [];
lines.push("// GENERATED from nvnLoadCProcs's decompiled body (0x7100ddd6e4, 12,712 bytes).");
lines.push("//");
lines.push(`// ${names.length} NVN function names, in the order the binary resolves them.`);
lines.push("// Regenerate with tools/static/gen-nvn-names.mjs rather than editing by hand.");
lines.push("//");
lines.push("// The names ARE the interface: nvnLoadCProcs looks each one up via a GetProcAddress");
lines.push("// callback and stores the result. See port/include/nvn/nvn.hpp.");
lines.push("");
lines.push('#include "nvn/nvn.hpp"');
lines.push("");
lines.push("namespace nvn {");
lines.push("namespace {");
lines.push("");
lines.push(`const char *const kNames[kProcCount] = {`);
for (const n of names) lines.push(`    "${n}",`);
lines.push("};");
lines.push("");
lines.push("} // namespace");
lines.push("");
lines.push("const char *ProcName(int index) {");
lines.push("    if (index < 0 || index >= kProcCount) return nullptr;");
lines.push("    return kNames[index];");
lines.push("}");
lines.push("");
lines.push("} // namespace nvn");
lines.push("");

writeFileSync(
  "C:/Users/Hexa/Documents/nintendo/sp2decomp/port/src/nvn_names.cpp",
  lines.join("\n"),
  "utf8"
);

console.log(`wrote port/src/nvn_names.cpp with ${names.length} names`);
console.log("first 3: " + names.slice(0, 3).join(", "));
console.log("last 3 : " + names.slice(-3).join(", "));
