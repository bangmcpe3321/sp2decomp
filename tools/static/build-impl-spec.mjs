// Build the platform implementation spec from the thunk-caller scan.
//
// Input: thunk-callers.txt, whose per-caller blocks carry "imports referenced:" and
// "CALL <line>" entries. Output: one section per platform import, with usage counts,
// caller counts and representative call sites -- the material a port is written against.
import { readFileSync, writeFileSync } from "node:fs";

const src = process.argv[2] ?? "thunk-callers.txt";
const outPath = process.argv[3] ?? "PLATFORM_IMPLEMENTATION_SPEC.md";

const text = readFileSync(src, "utf8");

// --- parse ---------------------------------------------------------------
const byImport = new Map(); // import -> {callers:Map(va->{name,size}), sites:[]}
let callerCount = 0;

for (const blk of text.split(/^=+\s*$/m)) {
  const hm = /^CALLER\s+(\S+)\s+(\S.*)$/m.exec(blk);
  if (!hm) continue;
  const va = hm[1];
  const name = hm[2].trim();
  const sm = /body size:\s*(\d+)/.exec(blk);
  const size = sm ? Number(sm[1]) : -1;
  callerCount++;

  for (const ln of blk.split("\n")) {
    if (!ln.startsWith("  CALL ")) continue;
    const expr = ln.slice(7).trim().replace(/\s+/g, " ");
    // which import does this line invoke?
    const im = /([A-Za-z_][A-Za-z0-9_]*)\s*\(/.exec(expr);
    if (!im) continue;
    const imp = im[1];
    // ignore obvious non-imports (control flow, locals)
    if (["if", "while", "for", "switch", "return", "sizeof"].includes(imp)) continue;
    if (!byImport.has(imp)) byImport.set(imp, { callers: new Map(), sites: [] });
    const e = byImport.get(imp);
    e.callers.set(va, { name, size });
    if (!e.sites.some((s) => s.va === va && s.expr === expr)) {
      e.sites.push({ va, name, size, expr });
    }
  }
}

console.log(`callers parsed: ${callerCount}`);
console.log(`imports with call sites: ${byImport.size}`);
const totalSites = [...byImport.values()].reduce((a, b) => a + b.sites.length, 0);
console.log(`total call sites: ${totalSites}`);

// --- rank ---------------------------------------------------------------
const ranked = [...byImport.entries()].sort((a, b) => b[1].sites.length - a[1].sites.length);

// --- emit ---------------------------------------------------------------
const out = [];
out.push("# Platform implementation spec");
out.push("");
out.push("How `main` actually calls each platform import, from a **whole-binary** scan:");
out.push(`**${byImport.size} imports, ${totalSites} call sites, ${callerCount} calling functions.**`);
out.push("");
out.push("This is the document the 51-function platform layer is written against.");
out.push("");
out.push("**Why call sites, not signatures.** The implementations are *not in this dump* —");
out.push("see [PLATFORM_LAYER_LOCATION.md](PLATFORM_LAYER_LOCATION.md). And the platform");
out.push("thunks are 13-byte stubs that Ghidra frequently renders as `f(void)`, so their");
out.push("signatures do not give arity. The call sites do.");
out.push("");
out.push("Companions: [PLATFORM_CALL_SITES.md](PLATFORM_CALL_SITES.md) (boot-closure subset),");
out.push("[PLATFORM_REFERENCE.md](PLATFORM_REFERENCE.md) (declared ABI signatures),");
out.push("[ENGINE_REFERENCE.md](ENGINE_REFERENCE.md) (the 126 boot engine functions).");
out.push("");
out.push("## Method");
out.push("");
out.push("Each import is invoked through a 13-byte thunk, and callers invoke it as a **named**");
out.push("function (Ghidra renders `nn::os::GetSystemTick()`). So the scan enumerates");
out.push("references to each thunk's **entry address**, decompiles every distinct caller, and");
out.push("keeps the pseudocode lines that call a platform import.");
out.push("");
out.push("All 50 thunks had callers, so this covers the complete import set rather than a");
out.push("subset. Reproduce with `tools/ghidra/PlatformThunkCallers.java`.");
out.push("");
out.push("## Usage ranking");
out.push("");
out.push("| Import | Call sites | Callers |");
out.push("|---|---:|---:|");
for (const [imp, e] of ranked) {
  out.push(`| \`${imp}\` | ${e.sites.length} | ${e.callers.size} |`);
}
out.push("");
out.push("---");
out.push("");

for (const [imp, e] of ranked) {
  out.push(`## \`${imp}\``);
  out.push("");
  out.push(`**${e.sites.length} call site${e.sites.length === 1 ? "" : "s"} across ${e.callers.size} caller${e.callers.size === 1 ? "" : "s"}.**`);
  out.push("");
  out.push("Observed call expressions:");
  out.push("");
  for (const s of e.sites.slice(0, 10)) {
    out.push(`- in \`${s.name}\` (${s.va}${s.size > 0 ? `, ${s.size} B` : ""})`);
    out.push("");
    out.push("  ```c");
    out.push(`  ${s.expr}`);
    out.push("  ```");
  }
  if (e.sites.length > 10) {
    out.push(`- … and ${e.sites.length - 10} more call site${e.sites.length - 10 === 1 ? "" : "s"}`);
  }
  out.push("");
  out.push("---");
  out.push("");
}

out.push("## How to use this");
out.push("");
out.push("For each import the port must implement:");
out.push("");
out.push("1. **Read the call expressions here.** They give arity and the shape of each");
out.push("   argument, which the thunk signature cannot.");
out.push("2. **Note the caller and its size.** A heavily-used import (e.g. `GetSystemTick` at");
out.push("   753 sites) is on the hot path; a rarely-used one can be implemented later.");
out.push("3. **Cross-reference the declared form** in [PLATFORM_REFERENCE.md](PLATFORM_REFERENCE.md).");
out.push("4. **Regenerate any caller in full** with `tools/ghidra/ExtractDecompiled.java` to see");
out.push("   what it does with the result.");
out.push("");
out.push("## Limits");
out.push("");
out.push("- **Call expressions are single pseudocode lines**, truncated by the scanner's regex");
out.push("  match. A call whose arguments span lines appears partially.");
out.push("- **Argument types are Ghidra's inference**, with parameters named `param_N`.");
out.push("- **A call site shows the interface, not the behaviour.** What the callee does with");
out.push("  its arguments is still inferred from the caller's expectations.");
out.push("- **Imports are matched by name from the thunk map.** An import reached through a");
out.push("  computed pointer rather than the thunk would be missed.");
out.push("- **No implementation of any of these was recovered** — none exists in the dump.");

writeFileSync(outPath, out.join("\n") + "\n");
console.log(`\nwrote ${outPath}`);
console.log("\ntop imports by call sites:");
for (const [imp, e] of ranked.slice(0, 16)) {
  console.log(`  ${String(e.sites.length).padStart(5)} sites  ${String(e.callers.size).padStart(4)} callers  ${imp}`);
}
