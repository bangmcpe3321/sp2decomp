// Resolve platform imports to the module that actually defines them.
//
// Usage:
//   node module-map.mjs <dir-with-decompressed-modules> [--worklist PORT_WORKLIST.md]
//                        [--tsv out.tsv] [--symbol <mangled-or-demangled>] [--all]
//
// <dir> must contain decompressed NSO0 files named main, sdk, subsdk0..subsdk3 (missing ones
// are skipped). Decompress with `hactool -t nso <file> --uncompressed=<file>.decompressed`.
//
// Method:
//   * main's undefined dynsym entries are the imports the game resolves.
//   * Every module's defined dynsym entries are the providers.
//   * Match by symbol name; demangle with c++filt when available for the human-readable table.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadNso0 } from "./nso0.mjs";

const args = process.argv.slice(2);
const dir = args.find((a) => !a.startsWith("--"));
if (!dir) {
  console.error("usage: node module-map.mjs <dir> [--worklist PORT_WORKLIST.md] [--tsv out.tsv] [--symbol name] [--all]");
  process.exit(2);
}
let worklist = null;
let tsv = null;
let symbolQuery = null;
let allImports = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--worklist") worklist = args[++i];
  if (args[i] === "--tsv") tsv = args[++i];
  if (args[i] === "--symbol") symbolQuery = args[++i];
  if (args[i] === "--all") allImports = true;
}

const MODULES = ["main", "sdk", "subsdk0", "subsdk1", "subsdk2", "subsdk3"];
const loaded = [];
for (const name of MODULES) {
  let mod = null;
  let lastError = null;
  for (const candidate of [join(dir, `${name}.decompressed`), join(dir, name)]) {
    try {
      mod = loadNso0(candidate);
      break;
    } catch (e) {
      lastError = e;
    }
  }
  if (!mod) {
    console.error(`note: ${name}: ${lastError?.message ?? "not found"}`);
    continue;
  }
  if (!mod.dynsym) {
    console.error(`note: ${name} has no dynsym`);
    continue;
  }
  const defined = mod.dynsym.entries.filter((e) => e.shndx !== 0);
  const undefinedSymbols = mod.dynsym.entries.filter((e) => e.shndx === 0);
  loaded.push({ name, defined, undefinedSymbols });
  console.log(`${name.padEnd(9)} defined=${String(defined.length).padStart(6)} undefined=${String(undefinedSymbols.length).padStart(4)}`);
}

const providers = new Map(); // mangled name -> [{module, value}]
for (const mod of loaded) {
  for (const e of mod.defined) {
    if (!e.name) continue;
    if (!providers.has(e.name)) providers.set(e.name, []);
    providers.get(e.name).push({ module: mod.name, value: e.value });
  }
}

const demangleCache = new Map();
function demangle(names) {
  const missing = names.filter((n) => !demangleCache.has(n));
  if (missing.length) {
    try {
      const out = execFileSync("c++filt", [], { input: missing.join("\n"), encoding: "utf8" });
      const lines = out.split("\n");
      missing.forEach((n, i) => demangleCache.set(n, lines[i] ?? n));
    } catch {
      for (const n of missing) demangleCache.set(n, n);
    }
  }
  return names.map((n) => demangleCache.get(n));
}

const main = loaded.find((m) => m.name === "main");
if (!main) {
  console.error("error: main.decompressed not found");
  process.exit(1);
}
const imports = main.undefinedSymbols.filter((e) => e.name);
const importNames = imports.map((e) => e.name);
const importDemangled = demangle(importNames);

// Symbols defined in main itself (InitializeAllocator, nvnLoadCProcs) are not imports.
const mainDefinedNames = main.defined.map((e) => e.name).filter(Boolean);

if (symbolQuery) {
  const matches = [...providers.entries()].filter(([name]) => name === symbolQuery || demangle([name])[0] === symbolQuery);
  if (!matches.length) {
    console.log(`not defined in the loaded modules: ${symbolQuery}`);
    process.exit(1);
  }
  for (const [name, list] of matches) {
    console.log(`\n${demangle([name])[0]}\n  ${name}`);
    for (const p of list) console.log(`  ${p.module.padEnd(9)} offset 0x${p.value.toString(16)}`);
  }
  process.exit(0);
}

function parseWorklist(path) {
  const rows = [];
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\| `0x([0-9a-f]+)` \| `([^`]+)` \|/);
    if (m) rows.push({ target: m[2], got: m[1] });
  }
  return rows;
}

function baseName(demangled) {
  return demangled.replace(/\(.*$/, "");
}

function matches(target, demangled) {
  const base = baseName(demangled);
  return base === target || base.startsWith(target + "::") || base === target.replace(/^nv::/, "");
}

const rows = [];
const unresolved = [];

if (allImports) {
  const byProvider = new Map();
  const missing = [];
  for (let i = 0; i < imports.length; i++) {
    const name = imports[i].name;
    const list = providers.get(name);
    if (list && list.length) {
      for (const p of list) byProvider.set(p.module, (byProvider.get(p.module) ?? 0) + 1);
    } else {
      missing.push({ name, demangled: importDemangled[i] });
    }
  }
  const resolved = imports.length - missing.length;
  console.log(`\nmain imports: ${imports.length}  resolved in the dump: ${resolved}  unresolved: ${missing.length}`);
  for (const [module, count] of [...byProvider.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${module.padEnd(9)} ${count}`);
  }
  for (const m of missing.slice(0, 40)) {
    console.log(`  MISSING ${m.demangled.slice(0, 110)}`);
  }
  if (missing.length > 40) console.log(`  ... and ${missing.length - 40} more`);
  process.exit(0);
}

if (worklist) {
  for (const { target, got } of parseWorklist(worklist)) {
    const candidates = [];
    for (let i = 0; i < imports.length; i++) {
      if (matches(target, importDemangled[i])) candidates.push(imports[i].name);
    }
    if (candidates.length === 0) {
      // Only symbols whose mangled name contains the target's leaf can match; demangling the
      // whole 145k-symbol main table for one lookup is wasteful (and c++filt line alignment
      // is not worth depending on at that size).
      const leaf = target.split("::").pop();
      for (const name of mainDefinedNames.filter((n) => n.includes(leaf))) {
        if (matches(target, demangle([name])[0])) candidates.push(name);
      }
    }
    const hits = [];
    for (const name of candidates) {
      for (const p of providers.get(name) ?? []) {
        if (!hits.some((h) => h.module === p.module && h.value === p.value && h.name === name)) {
          hits.push({ ...p, name });
        }
      }
    }
    if (hits.length) rows.push({ target, got, hits });
    else unresolved.push({ target, got, candidates });
  }

  console.log(`\nplatform symbols resolved from ${worklist}: ${rows.length}/${rows.length + unresolved.length}`);
  const lines = ["target\tgot_slot\tmodule\toffset\tresolved_name\tdemangled"];
  for (const { target, got, hits } of rows) {
    for (const h of hits) {
      const d = h.name === target ? h.name : demangle([h.name])[0];
      lines.push(`${target}\t0x${got}\t${h.module}\t0x${h.value.toString(16)}\t${h.name}\t${d}`);
      console.log(`  ${target.padEnd(48)} ${h.module.padEnd(8)} 0x${h.value.toString(16).padEnd(8)} ${d}`);
    }
  }
  for (const u of unresolved) {
    console.log(`  UNRESOLVED ${u.target} (main GOT 0x${u.got}); candidates: ${u.candidates.slice(0, 3).join(", ") || "none"}`);
  }
  if (tsv) {
    writeFileSync(tsv, lines.join("\n") + "\n");
    console.log(`\nwrote ${tsv} (${lines.length - 1} rows)`);
  }
} else {
  console.log("\nUse --worklist PORT_WORKLIST.md to map the 51 boot functions, or --symbol <name>.");
}
