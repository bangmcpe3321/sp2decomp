// Measure the REAL NVN API surface from nvnLoadCProcs's body.
//
// GRAPHICS_NVN.md §2 and my earlier port both described this as "one entry point returning a
// struct of function pointers". The decompiled body (0x7100ddd6e4, 12,712 bytes) shows
// something different and more informative: it is a GetProcAddress-style RESOLVER that looks up
// each nvn* function BY NAME and stores it in a named global. So the function-name strings in
// the body ARE the NVN API surface, and can be counted rather than guessed.
import { readFileSync } from "node:fs";

const body = readFileSync("loadc.txt", "utf8");

// Every resolved name appears as a string literal argument to the resolver callback.
// NOTE: the callback call is spelled `(*(code *)param_2)(param_1, "nvn...")`, so the literal
// is preceded by a comma and a space -- an earlier anchored regex missed all of them and
// reported zero names while the globals count was already correct at 453.
const names = [];
const seen = new Set();
for (const m of body.matchAll(/"(nvn[A-Za-z0-9_]+)"/g)) {
  if (!seen.has(m[1])) { seen.add(m[1]); names.push(m[1]); }
}

// Also collect the destination globals, to cross-check one-per-function.
const globals = new Set();
for (const m of body.matchAll(/PTR_(pfnc_nvn[A-Za-z0-9_]+)_7102[0-9a-f]{6}/g)) globals.add(m[1]);

console.log("=== nvnLoadCProcs (0x7100ddd6e4, 12712 bytes) ===");
console.log(`distinct nvn* names resolved : ${names.length}`);
console.log(`distinct destination globals : ${globals.size}`);

// Group by prefix to show the API's shape.
const byPrefix = new Map();
for (const n of names) {
  const m = /^nvn([A-Z][a-z0-9]*)/.exec(n);
  const key = m ? m[1] : "(other)";
  byPrefix.set(key, (byPrefix.get(key) ?? 0) + 1);
}
console.log("\n--- NVN API grouped by object prefix ---");
for (const [k, v] of [...byPrefix.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(22)} ${String(v).padStart(4)}`);
}

console.log("\n--- first 12 names (in resolution order) ---");
for (const n of names.slice(0, 12)) console.log("   " + n);
console.log("--- last 6 names ---");
for (const n of names.slice(-6)) console.log("   " + n);

// The resolver is the real interface: how many arguments, and where do results go?
const calls = (body.match(/\(\(code \*\)param_2\)\(param_1,/g) || []).length ||
              (body.match(/\(\*\(code \*\)param_2\)\(param_1,/g) || []).length;
console.log(`\nresolver call sites in the body: ${calls || "not counted"}`);
console.log("signature (from the decompiled header):");
console.log("   void nvnLoadCProcs(undefined8 param_1, undefined *param_2);");
console.log("   = (device, getProcAddress) -> stores each result in a named global");
