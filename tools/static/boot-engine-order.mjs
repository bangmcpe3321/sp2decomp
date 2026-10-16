// Extract the ENGINE dependencies of the boot root, in call order, to build the ordered
// reconstruction target list.
//
// SysInit::Init is the boot root (1308 bytes). Its decompiled body names the engine
// functions it calls; batching by first appearance gives the order the engine must be
// stood up, which is far more useful than porting the 126 boot-closure functions in
// arbitrary order.
import { readFileSync, writeFileSync } from "node:fs";

const src = process.argv[2] ?? "main-decompiled.txt";
const targetVa = (process.argv[3] ?? "0x71011f5b20").toLowerCase();
const outPath = process.argv[4] ?? "boot-engine-order.md";

const text = readFileSync(src, "utf8").replace(/^\uFEFF/, "");
let block = null;
for (const b of text.split(/^=+\s*$/m)) {
  const m = /^\s*0x([0-9a-f]+)\s+/m.exec(b);
  if (m && "0x" + m[1] === targetVa) block = b;
}
if (!block) {
  console.error(`function ${targetVa} not found`);
  process.exit(1);
}

const lines = block.split("\n").map((l) => l.replace(/\s+$/, "")).filter((l) => l.trim());

// Engine namespaces we intend to port. nn:: is already handled by the platform layer,
// so record it separately as "already satisfied".
const PLATFORM = /^nn::/;
const ENGINE_CALL = /(?:^|[\s=(])([A-Za-z_][A-Za-z0-9_]*(?:::[A-Za-z_~][A-Za-z0-9_]*)+)\s*\(/g;

const seen = new Map(); // name -> first line index
const platform = new Map();
const indirect = [];

lines.forEach((ln, i) => {
  // indirect dispatch: (**(code **)(*x + 0xNN))(x)  -- a vtable call, unresolvable statically
  if (/\(\*\*\(code \*\*\)/.test(ln)) {
    const off = /\+ 0x([0-9a-f]+)\)/.exec(ln);
    indirect.push({ line: ln.trim().slice(0, 110), off: off ? "0x" + off[1] : "?" });
    return;
  }
  let m;
  ENGINE_CALL.lastIndex = 0;
  while ((m = ENGINE_CALL.exec(ln)) !== null) {
    const name = m[1];
    if (PLATFORM.test(name)) {
      if (!platform.has(name)) platform.set(name, i);
      continue;
    }
    // skip pure-local constructs
    if (/^(if|while|for|switch|return|sizeof)$/.test(name)) continue;
    if (!seen.has(name)) seen.set(name, i);
  }
});

const engine = [...seen.entries()].sort((a, b) => a[1] - b[1]);
const plat = [...platform.entries()].sort((a, b) => a[1] - b[1]);

console.log(`SysInit::Init body lines: ${lines.length}`);
console.log(`distinct ENGINE calls: ${engine.length}`);
console.log(`distinct PLATFORM calls (already implemented): ${plat.length}`);
console.log(`indirect/vtable dispatch sites: ${indirect.length}`);

const out = [];
out.push("# Boot engine porting order");
out.push("");
out.push("The reconstruction target list, derived from the boot root's own body rather");
out.push("than from the 126-function closure in arbitrary order. `Lp::Sys::SysInit::Init`");
out.push("(`0x71011f5b20`, 1308 bytes) is the entry point; the engine functions it calls are");
out.push("listed in **first-appearance order**, which is the order the engine must be stood up.");
out.push("");
out.push("Source: `main-decompiled.txt`, the Ghidra body of the boot root.");
out.push("");
out.push("---");
out.push("");
out.push(`## Engine dependencies (${engine.length})`);
out.push("");
out.push("| # | Function | first seen at line |");
out.push("|---:|---|---:|");
engine.forEach(([name, i], n) => out.push(`| ${n + 1} | \`${name}\` | ${i} |`));
out.push("");
out.push("---");
out.push("");
out.push(`## Indirect / vtable dispatch sites (${indirect.length})`);
out.push("");
out.push("These are **not resolvable statically** — the target is loaded from a vtable slot.");
out.push("They are where `sead::`'s virtual interfaces must match the binary's vtable layout,");
out.push("and they are the reason [VTABLE_VERIFICATION.md](VTABLE_VERIFICATION.md) exists.");
out.push("");
for (const d of indirect) out.push(`- slot \`${d.off}\` — \`${d.line}\``);
out.push("");
out.push("---");
out.push("");
out.push(`## Platform calls already satisfied (${plat.length})`);
out.push("");
out.push("These are handled by the reconstructed platform layer in `port/`.");
out.push("");
for (const [name] of plat) out.push(`- \`${name}\``);
out.push("");
out.push("---");
out.push("");
out.push("## How to use this");
out.push("");
out.push("1. Work down the engine list in order. A function cannot be ported before the ones");
out.push("   it depends on, and first-appearance order approximates dependency order because");
out.push("   the boot root constructs things before using them.");
out.push("2. For each `sead::` entry, check `open-ead/sead` first — it is the most mature");
out.push("   reference (252 stars) and covers framework, heap, thread, gfx.");
out.push("3. Record every **unimplemented dependency reached** rather than stubbing silently:");
out.push("   the harness should fail loudly at the first missing engine function, which is the");
out.push("   fastest way to discover the true porting order.");
out.push("");
out.push("## Limits");
out.push("");
out.push("- **This is the boot root only.** The remaining 125 boot-closure functions and the");
out.push("  wider engine (113,000 functions) are not represented here.");
out.push("- **First-appearance order is a heuristic**, not a dependency graph. Static call");
out.push("  order can differ from runtime order where branches reorder work.");
out.push("- **Vtable dispatch is opaque.** Roughly a third of the boot root's calls go through");
out.push("  indirect slots, so the list above understates the true dependency set.");

writeFileSync(outPath, out.join("\n") + "\n");
console.log(`\nwrote ${outPath}`);
console.log("\nengine dependencies in order:");
engine.slice(0, 22).forEach(([n], i) => console.log(`  ${String(i + 1).padStart(2)}. ${n}`));
if (engine.length > 22) console.log(`  ... and ${engine.length - 22} more`);
