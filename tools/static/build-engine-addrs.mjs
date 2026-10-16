// Build the address list for boot-closure ENGINE functions (everything that is not
// already covered as a platform function in PORT_WORKLIST.md).
//
// IMPORTANT: boot-closure.txt prints ABSOLUTE VAs (0x71011f5b20), as used by the
// Ghidra project. Adding the image base again produces a nonsense address like
// 0xe2011f5ab4 and every lookup misses.
import { readFileSync, writeFileSync } from "node:fs";

const closurePath = process.argv[2] ?? "boot-closure-fixed.txt";
const platformPath = process.argv[3] ?? "platform-addrs.txt";
const outPath = process.argv[4] ?? "engine-addrs.txt";

// platform addresses already handled
const platform = new Set(
  readFileSync(platformPath, "utf8")
    .trim()
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
);

// closure lines look like:  "     0x71011f5b20  Lp::Sys::SysInit::Init  [1308B, 37 calls]"
const entries = [];
const seen = new Set();
for (const ln of readFileSync(closurePath, "utf8").split("\n")) {
  const m = /^\s+(0x[0-9a-f]+)\s+(.+?)(?:\s+\[.*)?$/.exec(ln);
  if (!m) continue;
  const abs = "0x" + BigInt(m[1]).toString(16);
  if (platform.has(abs)) continue; // already in the platform reference
  if (seen.has(abs)) continue;
  seen.add(abs);
  entries.push({ abs, name: m[2].trim() });
}

// dedupe by name as well, to avoid repeating the same function under two labels
const byName = new Map();
for (const e of entries) if (!byName.has(e.name)) byName.set(e.name, e);
const list = [...byName.values()];

console.log(`closure entries (non-platform, distinct address+name): ${list.length}`);

const groups = new Map();
for (const e of list) {
  const ns = e.name.split("::").slice(0, 2).join("::");
  if (!groups.has(ns)) groups.set(ns, []);
  groups.get(ns).push(e);
}
console.log("");
for (const [ns, items] of [...groups.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 14)) {
  console.log(`  ${String(items.length).padStart(3)}  ${ns}`);
}
if (groups.size > 14) console.log(`  ... ${groups.size - 14} more namespaces`);

writeFileSync(outPath, list.map((e) => e.abs).join(",") + "\n");
writeFileSync(
  outPath.replace(/\.txt$/, "-index.txt"),
  list.map((e) => `${e.abs}\t${e.name}`).join("\n") + "\n",
);
console.log(`\nwrote ${outPath} (${list.length} addresses)`);
