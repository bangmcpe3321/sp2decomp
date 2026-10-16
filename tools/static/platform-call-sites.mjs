// Extract the platform call sites from the already-decompiled engine and boot bodies.
//
// This is the achievable form of the goal. The implementations are absent from the dump
// (PLATFORM_LAYER_LOCATION.md), so what a boot-milestone port needs is the CONTRACT, and
// the contract is observable where main calls these functions. Ghidra preserved the
// callee names, so the call sites can be lifted directly.
import { readFileSync, writeFileSync } from "node:fs";

const SOURCES = [
  ["engine-decompiled.txt", "boot-closure engine"],
  ["main-decompiled.txt", "boot roots"],
];

const PLATFORM = /(nn::(?:os|mem|init|vi|fs|time|diag|util|nifm|oe)::[A-Za-z0-9_:<>~]+)/;

// Collect per-function text so each call site keeps its enclosing caller.
const calls = new Map(); // callee -> [{caller, site, file}]
const perFile = {};

for (const [file, label] of SOURCES) {
  let text;
  try {
    text = readFileSync(file, "utf8").replace(/^\uFEFF/, "");
  } catch {
    console.log(`(skipped ${file} - not present)`);
    continue;
  }
  perFile[file] = label;

  // split into function blocks on the separator rule lines
  const blocks = text.split(/^=+\s*$/m);
  for (const blk of blocks) {
    const hm = /^\s*0x([0-9a-f]+)\s+(\S.*)$/m.exec(blk);
    if (!hm) continue;
    const caller = hm[2].trim();
    const callerVa = "0x" + hm[1];
    const lines = blk.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const ln = lines[i];
      const m = PLATFORM.exec(ln);
      if (!m) continue;
      const callee = m[1];
      // capture the call expression: same line plus a little continuation
      let site = ln.trim();
      let k = 1;
      while (!/;\s*$/.test(site) && k < 3 && i + k < lines.length) {
        site += " " + lines[i + k].trim();
        k++;
      }
      site = site.replace(/\s+/g, " ").slice(0, 300);
      if (!calls.has(callee)) calls.set(callee, []);
      const list = calls.get(callee);
      if (!list.some((e) => e.caller === caller && e.site === site)) {
        list.push({ caller, callerVa, site, file });
      }
    }
  }
}

console.log(`sources: ${Object.keys(perFile).join(", ")}`);
console.log(`distinct platform callees observed: ${calls.size}`);
const total = [...calls.values()].reduce((a, b) => a + b.length, 0);
console.log(`total call sites: ${total}`);

// group by namespace
const byNs = new Map();
for (const [callee, list] of calls) {
  const ns = callee.split("::").slice(0, 2).join("::");
  if (!byNs.has(ns)) byNs.set(ns, []);
  byNs.get(ns).push([callee, list]);
}

const out = [];
out.push("# Platform call sites observed in `main`");
out.push("");
out.push("**This is the achievable form of the platform reference.** The implementations");
out.push("of `nn::os` / `nn::mem` / `nn::init` / `nn::vi` are *not in this dump* (see");
out.push("[PLATFORM_LAYER_LOCATION.md](PLATFORM_LAYER_LOCATION.md)) — `main` imports them and");
out.push("the system provides them at runtime. What a port therefore needs is the");
out.push("**contract**, and the contract is observable exactly where `main` calls them.");
out.push("");
out.push("Every entry below is a call site lifted from decompiled `main` code, with the");
out.push("enclosing caller. Ghidra preserved the callee names, so these are direct");
out.push("observations, not inferences.");
out.push("");
out.push(`Sources: ${Object.keys(perFile).map((f) => `\`${f}\``).join(", ")}.`);
out.push(`Distinct platform callees: **${calls.size}** · call sites: **${total}**.`);
out.push("");
out.push("---");
out.push("");

for (const [ns, items] of [...byNs.entries()].sort((a, b) => b[1].length - a[1].length)) {
  const n = items.reduce((a, [, l]) => a + l.length, 0);
  out.push(`## \`${ns}\` — ${items.length} function${items.length === 1 ? "" : "s"}, ${n} call site${n === 1 ? "" : "s"}`);
  out.push("");
  for (const [callee, list] of items.sort((a, b) => b[1].length - a[1].length)) {
    out.push(`### \`${callee}\``);
    out.push("");
    out.push(`Observed ${list.length} call site${list.length === 1 ? "" : "s"}:`);
    out.push("");
    for (const e of list) {
      out.push(`- in \`${e.caller}\` (${e.callerVa}):`);
      out.push("");
      out.push("  ```c");
      out.push(`  ${e.site}`);
      out.push("  ```");
    }
    out.push("");
  }
  out.push("---");
  out.push("");
}

out.push("## How to use this");
out.push("");
out.push("For each function the port must implement:");
out.push("");
out.push("1. Read the call sites here — they show **how many arguments are passed and what");
out.push("   they are**, which is the part a signature alone cannot settle.");
out.push("2. Cross-reference the observed ABI signature in");
out.push("   [PLATFORM_REFERENCE.md](PLATFORM_REFERENCE.md) for the declared shape.");
out.push("3. Read the enclosing caller in full via `tools/ghidra/ExtractDecompiled.java` to");
out.push("   see what it does with the result.");
out.push("");
out.push("## Limits");
out.push("");
out.push("- **Only callers that are themselves in the boot closure are covered.** These come");
out.push("  from the 126 engine functions and the boot roots; the other ~113,000 functions in");
out.push("  `main` were not decompiled, so their call sites are not listed here.");
out.push("- **Argument types are Ghidra's inference.** Named parameters such as");
out.push("  `param_1` are unnamed in the output.");
out.push("- **A call site shows the interface, not the behaviour.** What the callee does with");
out.push("  its arguments still has to be inferred from the caller's expectations.");
out.push("- **No implementation of any of these was recovered**, because none exists in the");
out.push("  dump. This document does not change that.");

writeFileSync("PLATFORM_CALL_SITES.md", out.join("\n") + "\n");
console.log(`\nwrote PLATFORM_CALL_SITES.md`);
console.log("\nnamespaces:");
for (const [ns, items] of [...byNs.entries()].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`  ${ns.padEnd(14)} ${items.length} functions`);
}
