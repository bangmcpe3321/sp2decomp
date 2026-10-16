// Build the full platform implementation spec from the whole-binary call-site scan.
//
// The scan matched every PTR_ symbol, which includes data imports such as sInstance and
// typeInfo. This restricts output to the platform FUNCTION imports (the 51 in
// PORT_WORKLIST.md, plus the NVN entry points the graphics path uses), and groups their
// call sites so the port can read the required arity and argument shapes.
import { readFileSync, writeFileSync } from "node:fs";

const sitesPath = process.argv[2] ?? "all-callsites.txt";
const worklistPath = process.argv[3] ?? "C:/Users/Hexa/Documents/nintendo/sp2decomp/PORT_WORKLIST.md";
const outPath = process.argv[4] ?? "PLATFORM_IMPLEMENTATION_SPEC.md";

// ---- the platform function names we care about --------------------------
// from PORT_WORKLIST.md (nn::os / nn::mem / nn::init / nn::vi / nn::time / ...)
const worklist = new Set();
for (const ln of readFileSync(worklistPath, "utf8").split("\n")) {
  const m = /^\|\s*`(0x[0-9a-f]+)`\s*\|\s*`([^`]+)`\s*\|/.exec(ln);
  if (m) worklist.add(m[2].split("::").pop());
}
console.log(`worklist function names: ${worklist.size}`);

// NVN entry points are pfnc_nvn*; they belong to the graphics path
const isNvn = (n) => /^pfnc_nvn/.test(n);
const isPlatform = (n) => worklist.has(n) || isNvn(n);

// ---- parse the scan output ---------------------------------------------
const text = readFileSync(sitesPath, "utf8");
const blocks = text.split(/^=+\s*$/m);

const byImport = new Map(); // import -> [{caller, va, size, lines:[]}]
let callers = 0;
for (const blk of blocks) {
  const hm = /^CALLER\s+(\S+)\s+(\S.*)$/m.exec(blk);
  if (!hm) continue;
  const va = hm[1];
  const name = hm[2].trim();
  const sizeM = /body size:\s*(\d+)/.exec(blk);
  const size = sizeM ? Number(sizeM[1]) : -1;
  // the call lines are the indented ones containing PTR_
  for (const ln of blk.split("\n")) {
    const pm = /PTR_([A-Za-z0-9_]+)_710[0-9a-f]{7}/.exec(ln);
    if (!pm) continue;
    const imp = pm[1];
    if (!isPlatform(imp)) continue;
    if (!byImport.has(imp)) byImport.set(imp, []);
    const list = byImport.get(imp);
    const site = ln.trim().replace(/\s+/g, " ").slice(0, 260);
    if (!list.some((e) => e.callerVa === va && e.site === site)) {
      list.push({ caller: name, callerVa: va, size, site });
    }
  }
  callers++;
}

const fnImports = [...byImport.entries()].filter(([k]) => !isNvn(k));
const nvnImports = [...byImport.entries()].filter(([k]) => isNvn(k));
console.log(`platform function imports with call sites: ${fnImports.length}`);
console.log(`NVN entry points with call sites         : ${nvnImports.length}`);

const total = [...byImport.values()].reduce((a, b) => a + b.length, 0);
console.log(`total call sites                         : ${total}`);

// ---- emit --------------------------------------------------------------
const out = [];
out.push("# Platform implementation spec");
out.push("");
out.push("How `main` actually calls each platform function, taken from a **whole-binary**");
out.push("call-site scan (1,417 distinct callers). This is the document the 51-function");
out.push("platform layer is written against.");
out.push("");
out.push("**Why call sites and not signatures.** The implementations are not in this dump —");
out.push("see [PLATFORM_LAYER_LOCATION.md](PLATFORM_LAYER_LOCATION.md). The platform thunks");
out.push("are 13-byte stubs that Ghidra often renders as `f(void)`, so their signatures do");
out.push("not give arity. The call sites do.");
out.push("");
out.push("Companion: [PLATFORM_CALL_SITES.md](PLATFORM_CALL_SITES.md) (boot-closure subset,");
out.push("66 sites), [PLATFORM_REFERENCE.md](PLATFORM_REFERENCE.md) (declared ABI signatures).");
out.push("");
out.push(`Method: every platform import is called through a GOT slot named`);
out.push("`PTR_<Name>_<slot>`. Ghidra resolves those as symbols, so references to them are");
out.push("enumerable. 453 of 502 slots resolved to at least one calling function.");
out.push("");
out.push(`**Coverage:** ${fnImports.length} platform functions, ${total - nvnImports.reduce((a, [, l]) => a + l.length, 0)} call sites, plus ${nvnImports.length} NVN entry points.`);
out.push("");
out.push("---");
out.push("");

function emitGroup(items, title, intro) {
  out.push(`## ${title}`);
  out.push("");
  if (intro) { out.push(intro); out.push(""); }
  for (const [imp, list] of items.sort((a, b) => b[1].length - a[1].length)) {
    out.push(`### \`${imp}\``);
    out.push("");
    out.push(`${list.length} call site${list.length === 1 ? "" : "s"} across ${new Set(list.map((e) => e.callerVa)).size} caller${new Set(list.map((e) => e.callerVa)).size === 1 ? "" : "s"}.`);
    out.push("");
    for (const e of list.slice(0, 8)) {
      out.push(`- \`${e.caller}\` (${e.callerVa}${e.size > 0 ? `, ${e.size} B` : ""})`);
      out.push("");
      out.push("  ```c");
      out.push(`  ${e.site}`);
      out.push("  ```");
    }
    if (list.length > 8) out.push(`- … and ${list.length - 8} more call sites`);
    out.push("");
  }
  out.push("---");
  out.push("");
}

emitGroup(fnImports, `Platform functions (${fnImports.length})`);

// NVN is a dispatch-table design; summarise rather than dump every builder call
out.push(`## NVN entry points (${nvnImports.length})`);
out.push("");
out.push("[GRAPHICS_NVN.md](GRAPHICS_NVN.md) established that NVN is a single dispatch table:");
out.push("the binary has no per-function NVN surface, and a port fills one struct. The scan");
out.push("confirms it — every NVN call goes through a `pfnc_nvn*` function pointer, and they");
out.push("are concentrated in `initializeGraphicsSystem`.");
out.push("");
out.push("| NVN entry point | call sites |");
out.push("|---|---:|");
for (const [imp, list] of nvnImports.sort((a, b) => b[1].length - a[1].length)) {
  out.push(`| \`${imp}\` | ${list.length} |`);
}
out.push("");
out.push("The distinct callers for NVN are:");
const nvnCallers = new Set();
for (const [, list] of nvnImports) for (const e of list) nvnCallers.add(`${e.caller} (${e.callerVa})`);
for (const c of [...nvnCallers].sort()) out.push(`- \`${c}\``);
out.push("");
out.push("---");
out.push("");

out.push("## How to use this");
out.push("");
out.push("For each platform function the port must implement:");
out.push("");
out.push("1. Read its call sites here — they show **arity and argument shapes**, which the");
out.push("   thunk signature does not.");
out.push("2. Cross-reference [PLATFORM_REFERENCE.md](PLATFORM_REFERENCE.md) for the declared");
out.push("   form, and [PLATFORM_CALL_SITES.md](PLATFORM_CALL_SITES.md) for the boot-path subset.");
out.push("3. Regenerate any caller in full with `tools/ghidra/ExtractDecompiled.java`.");
out.push("");
out.push("## Limits");
out.push("");
out.push("- **453 of 502 slots resolved.** The other 49 had no in-binary reference the scan");
out.push("  could attribute, so their callers are missing.");
out.push("- **Call lines are truncated to 260 characters**, and long calls wrapped across");
out.push("  source lines may appear only partially.");
out.push("- **Argument types are Ghidra's inference**, with parameters named `param_N`.");
out.push("- **A call site shows the interface, not the behaviour.** What the callee does with");
out.push("  its arguments is still inferred from the caller's expectations.");
out.push("- **No implementation of any of these was recovered** — none exists in the dump.");

writeFileSync(outPath, out.join("\n") + "\n");
console.log(`\nwrote ${outPath}`);
console.log("\nplatform functions with the most call sites:");
for (const [imp, list] of fnImports.sort((a, b) => b[1].length - a[1].length).slice(0, 14)) {
  console.log(`  ${String(list.length).padStart(4)}  ${imp}`);
}
