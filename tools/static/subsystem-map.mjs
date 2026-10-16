// Build a port-oriented subsystem map from the module's function symbols.
//
// The symbol table carries real Itanium-mangled names (the binary is not
// stripped), so the namespaces reconstruct the game's own architecture far more
// reliably than inferring it from call graphs.
import { readFileSync, writeFileSync } from "node:fs";

const inPath = process.argv[2] ?? "inventory.txt";
const outPath = process.argv[3] ?? "subsystem-map.txt";
const text = readFileSync(inPath, "utf8");

const funcs = [];
for (const ln of text.split("\n")) {
  if (!ln.startsWith("FUNCTION\t")) continue;
  const p = ln.split("\t");
  funcs.push({ va: p[1], name: p[2] });
}

// --- Itanium ABI prefix demangler ---------------------------------------
// Handles constructor/destructor/operator prefixes and nested namespaces, which
// is all we need to group by subsystem. Templates are collapsed to <...>.
function demangle(mangled) {
  if (!mangled.startsWith("_Z")) return mangled;
  let s = mangled.slice(2);
  const quals = [];
  while (s.startsWith("K") || s.startsWith("V") || s.startsWith("R")) {
    quals.push({ K: "const ", V: "volatile ", R: "restrict " }[s[0]]);
    s = s.slice(1);
  }
  if (s.startsWith("N")) {
    s = s.slice(1);
    const parts = [];
    for (;;) {
      if (s.startsWith("E")) { s = s.slice(1); break; }
      const m = /^(\d+)/.exec(s);
      if (!m) break;
      const len = Number(m[1]);
      let name = s.slice(m[0].length, m[0].length + len);
      s = s.slice(m[0].length + len);
      if (name.startsWith("_GLOBAL__N")) name = "(anonymous)";
      parts.push(name);
    }
    if (parts.length === 0) return mangled;
    const last = parts[parts.length - 1];
    const isCtor = last === "C1" || last === "C2" || last === "C3";
    const isDtor = last === "D0" || last === "D1" || last === "D2";
    let rendered = parts.slice(0, isCtor || isDtor ? -2 : -1).join("::");
    if (!rendered && parts.length === 1) rendered = parts[0];
    const base = parts.slice(0, isCtor || isDtor ? -2 : -1).join("::");
    const leafRaw = parts[parts.length - (isCtor || isDtor ? 2 : 1)];
    if (isCtor) rendered = base + "::" + base.split("::").pop();
    else if (isDtor) rendered = base + "::~" + base.split("::").pop();
    else rendered = (base ? base + "::" : "") + leafRaw;
    return quals.join("") + rendered;
  }
  return mangled;
}

// --- group by system ------------------------------------------------------
const rows = [];
for (const f of funcs) {
  const dm = demangle(f.name);
  const segs = dm.split("::");
  rows.push({ va: f.va, mangled: f.name, demangled: dm, segs });
}

const groups = new Map();
const keyOf = (r) => {
  const s = r.segs;
  if (s.length >= 3) return s.slice(0, 3).join("::");
  return s.join("::");
};
for (const r of rows) {
  const k = keyOf(r);
  if (!groups.has(k)) groups.set(k, []);
  groups.get(k).push(r);
}

const out = [];
out.push(`Subsystem map for Splatoon 2 main (title 01003bc0000a0000)`);
out.push(`source: ${inPath}`);
out.push(`functions: ${rows.length}`);
out.push("");

// Top-level domains first
const domains = new Map();
for (const r of rows) {
  const d = r.segs[0] ?? "?";
  domains.set(d, (domains.get(d) || 0) + 1);
}
out.push("=== top-level domains ===");
for (const [d, c] of [...domains.entries()].sort((a, b) => b[1] - a[1])) {
  out.push(`  ${String(c).padStart(7)}  ${d}`);
}
out.push("");

out.push("=== subsystems (>= 40 functions), grouped by namespace ===");
const interesting = [...groups.entries()].filter(([, v]) => v.length >= 40).sort((a, b) => b[1].length - a[1].length);
for (const [k, v] of interesting) {
  out.push(`\n## ${k}  (${v.length} functions)`);
  const sample = v.slice(0, 12).map((r) => r.demangled);
  for (const s of sample) out.push(`   ${s}`);
  if (v.length > 12) out.push(`   ... ${v.length - 12} more`);
}

// Game-specific deep dive: Game::<second>
out.push("\n\n=== Game:: subsystem breakdown ===");
const gameSub = new Map();
for (const r of rows) {
  if (r.segs[0] !== "Game") continue;
  const k = r.segs.slice(0, 2).join("::");
  gameSub.set(k, (gameSub.get(k) || 0) + 1);
}
for (const [k, c] of [...gameSub.entries()].sort((a, b) => b[1] - a[1])) {
  out.push(`  ${String(c).padStart(6)}  ${k}`);
}

// Lp framework breakdown
out.push("\n=== Lp:: subsystem breakdown ===");
const lpSub = new Map();
for (const r of rows) {
  if (r.segs[0] !== "Lp") continue;
  const k = r.segs.slice(0, 2).join("::");
  lpSub.set(k, (lpSub.get(k) || 0) + 1);
}
for (const [k, c] of [...lpSub.entries()].sort((a, b) => b[1] - a[1])) {
  out.push(`  ${String(c).padStart(6)}  ${k}`);
}

// Platform API surface that a port must reimplement
out.push("\n\n=== nn:: SDK surface a port must reimplement ===");
const nnSub = new Map();
for (const r of rows) {
  if (r.segs[0] !== "nn") continue;
  const k = r.segs.slice(0, 2).join("::");
  nnSub.set(k, (nnSub.get(k) || 0) + 1);
}
for (const [k, c] of [...nnSub.entries()].sort((a, b) => b[1] - a[1])) {
  out.push(`  ${String(c).padStart(6)}  ${k}`);
}

writeFileSync(outPath, out.join("\n") + "\n");
console.log(`wrote ${outPath} (${out.length} lines)`);
console.log(`functions=${rows.length} subsystems>=40=${interesting.length}`);
