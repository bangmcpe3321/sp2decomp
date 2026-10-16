// Build a platform-function index for the sdk module from its Ghidra inventory.
//
// The inventory has KIND/ADDRESS/SIZE/NAME columns and mixes:
//   FUNCTION  name  FUN_xxxxxxxx (Ghidra-generated)
//   SYMBOL    name  s__ZN2nn2os... (Ghidra's ADRP+ADD constant labels -- real names!)
//   STRING    text  the module's own symbol strings
//
// The real mangled names are present, so collect them and pair each with the address
// Ghidra attached to it.
import { readFileSync, writeFileSync } from "node:fs";

const invPath = process.argv[2] ?? "sdk-inventory.txt";
const outPath = process.argv[3] ?? "sdk-symbols.txt";

const rows = [];
for (const ln of readFileSync(invPath, "utf8").split("\n")) {
  const p = ln.split("\t");
  if (p.length < 3) continue;
  const kind = p[0];
  if (kind === "FUNCTION") rows.push({ kind, va: p[1], size: Number(p[2]), name: p[3] ?? "" });
  else if (kind === "SYMBOL") rows.push({ kind, va: p[1], type: p[2], name: p[3] ?? "" });
  else if (kind === "STRING") rows.push({ kind, va: p[1], len: p[2], text: p[3] ?? "" });
}

const funcs = rows.filter((r) => r.kind === "FUNCTION");
const syms = rows.filter((r) => r.kind === "SYMBOL");
const strs = rows.filter((r) => r.kind === "STRING");

console.log(`functions: ${funcs.length}`);
console.log(`symbols  : ${syms.length}`);
console.log(`strings  : ${strs.length}`);

// Ghidra labels constants it resolves as "s_" + name or "s__Z..." / "s__ZN2nn2os..."
const resolved = [];
for (const s of syms) {
  let nm = s.name;
  if (nm && nm.startsWith("s_")) {
    nm = nm.slice(2);
    // strip a trailing "+0xNN" offset that Ghidra appends
    nm = nm.replace(/\+0x[0-9a-f]+$/i, "");
    if (/^_Z/.test(nm) || /^_ZN/.test(nm)) resolved.push({ va: s.va, name: nm, type: s.type });
  }
}
console.log(`\nresolved mangled symbols (s_ prefixed): ${resolved.length}`);

// Also treat FUNCTION rows whose name is not FUN_/LAB_ as real
const namedFuncs = funcs.filter((f) => f.name && !/^(FUN_|LAB_|SUB_|THUNK_)/.test(f.name));
console.log(`functions with a non-synthetic name: ${namedFuncs.length}`);
for (const f of namedFuncs.slice(0, 10)) console.log(`   ${f.va}  ${f.name}`);

// Platform-relevant strings (mangled names for the namespaces main imports)
const platStrs = strs
  .map((s) => s.text)
  .filter((t) => /^_ZN2nn(2os|3mem|4init|2vi|2fs|4time|4diag|4util|4nifm|2oe)/.test(t));
console.log(`\nplatform-namespace mangled STRINGS: ${platStrs.length}`);
for (const t of [...new Set(platStrs)].slice(0, 20)) console.log(`   ${t}`);
writeFileSync(
  outPath,
  [...new Set(platStrs)].map((t) => `STRING\t${t}`).join("\n") +
    "\n" +
    resolved.map((r) => `LABEL\t${r.va}\t${r.name}`).join("\n") +
    "\n",
);
console.log(`\nwrote ${outPath}`);

// How many of the resolved labels are platform functions?
const platLabels = resolved.filter((r) => /^_ZN2nn(2os|3mem|4init|2vi|2fs|4time|4diag|4util|4nifm|2oe)/.test(r.name));
console.log(`platform-namespace resolved labels: ${platLabels.length}`);
for (const r of platLabels.slice(0, 20)) console.log(`   0x${r.va}  ${r.name}`);
