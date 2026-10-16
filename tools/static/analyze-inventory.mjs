// Analyze the Ghidra inventory: decompose the module by namespace and surface
// the largest game functions.
import { readFileSync } from "node:fs";

const path = process.argv[2] ?? "inventory.txt";
const text = readFileSync(path, "utf8");
const lines = text.split("\n");

const funcs = [];
const syms = [];
const sections = [];
for (const ln of lines) {
  if (ln.startsWith("FUNCTION\t")) {
    const p = ln.split("\t");
    funcs.push({ va: p[1], name: p[2], size: Number(p[3]), kind: p[4], scope: p[5] });
  } else if (ln.startsWith("SYMBOL\t")) {
    const p = ln.split("\t");
    syms.push({ va: p[1], type: p[2], name: p[3] });
  } else if (ln.startsWith("SECTION\tNAME")) {
    continue;
  } else if (ln.startsWith("SECTION\t")) {
    const p = ln.split("\t");
    sections.push({ name: p[1], start: p[2], end: p[3], size: Number(p[4]), r: p[5], w: p[6], x: p[7] });
  }
}

console.log(`functions=${funcs.length} symbols=${syms.length} sections=${sections.length}`);

console.log("\n=== memory blocks ===");
for (const s of sections) {
  console.log(`  ${s.name.padEnd(14)} ${s.start} .. ${s.end}  size ${String(s.size).padStart(10)}  ${s.r ? "r" : "-"}${s.w ? "w" : "-"}${s.x ? "x" : "-"}`);
}

// Namespace of an itanium-mangled name
const nsOf = (n) => {
  const m = /^_ZN(\d+)/.exec(n);
  if (m) {
    const len = Number(m[1]);
    return n.slice(m[0].length, m[0].length + len);
  }
  if (n.startsWith("_Z")) return "<it-mangled-other>";
  return "<plain-C>";
};

const nsCount = new Map();
const nsBytes = new Map();
let totalBytes = 0;
for (const f of funcs) {
  const ns = nsOf(f.name);
  nsCount.set(ns, (nsCount.get(ns) || 0) + 1);
  nsBytes.set(ns, (nsBytes.get(ns) || 0) + f.size);
  totalBytes += f.size;
}

console.log(`\n=== functions by namespace (top 30) ===`);
console.log(`  ${"count".padStart(7)} ${"bytes".padStart(10)}  namespace`);
for (const [ns, c] of [...nsCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30)) {
  console.log(`  ${String(c).padStart(7)} ${String(nsBytes.get(ns)).padStart(10)}  ${ns}`);
}

console.log(`\ntotal attributed function bytes: ${totalBytes} of ${sections.find((s) => s.name === ".text")?.size ?? "?"} .text bytes`);

console.log("\n=== 25 largest functions ===");
for (const f of [...funcs].sort((a, b) => b.size - a.size).slice(0, 25)) {
  console.log(`  ${String(f.size).padStart(8)} bytes  ${f.va}  ${f.name.slice(0, 110)}`);
}

// Game-code functions: exclude known library/toolchain namespaces
const LIB = /^(_Z|__|std|wslay|sead|nn|agl|aal|eui|Cui|Lp\b)/;
const gameNs = ["Game", "Cmn", "Lobby", "Match", "Shop", "Cnet", "gsys", "pead", "enl", "xlink2", "MiniGame", "PlayerMake", "UICheck", "PlayerViewer", "DbgSetting", "Cstm"];
const gameFns = funcs.filter((f) => {
  const ns = nsOf(f.name);
  return gameNs.includes(ns);
});
console.log(`\n=== game-code functions (Game/Cmn/Lobby/Match/Shop/...): ${gameFns.length} ===`);
const gameByNs = new Map();
for (const f of gameFns) {
  const ns = nsOf(f.name);
  const cur = gameByNs.get(ns) || { count: 0, bytes: 0, largest: null };
  cur.count++;
  cur.bytes += f.size;
  if (!cur.largest || f.size > cur.largest.size) cur.largest = f;
  gameByNs.set(ns, cur);
}
for (const [ns, v] of [...gameByNs.entries()].sort((a, b) => b[1].bytes - a[1].bytes)) {
  console.log(`  ${ns.padEnd(14)} fns=${String(v.count).padStart(6)} bytes=${String(v.bytes).padStart(9)}  largest=${v.largest.size}B ${v.largest.name.slice(0, 70)}`);
}
