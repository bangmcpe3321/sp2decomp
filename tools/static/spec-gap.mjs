// Compare spec coverage against the worklist.
import { readFileSync } from "node:fs";

const spec = readFileSync("PLATFORM_IMPLEMENTATION_SPEC.md", "utf8");
const covered = [...spec.matchAll(/^## `([A-Za-z0-9_]+)`/gm)].map((m) => m[1]);

const wl = readFileSync("PORT_WORKLIST.md", "utf8");
const want = [];
for (const ln of wl.split("\n")) {
  const m = /^\|\s*`(0x[0-9a-f]+)`\s*\|\s*`([^`]+)`/.exec(ln);
  if (m) want.push({ va: m[1], full: m[2], short: m[2].split("::").pop() });
}

console.log(`worklist imports          : ${want.length}`);
console.log(`imports with call sites   : ${covered.length}`);

const missing = want.filter((w) => !covered.includes(w.short));
console.log(`\nMISSING from spec (${missing.length}):`);
for (const m of missing) console.log(`  ${m.va}  ${m.full}`);

// which spec entries are not in the worklist (extra coverage)
const wantShort = new Set(want.map((w) => w.short));
const extra = covered.filter((c) => !wantShort.has(c));
console.log(`\nIn spec but NOT in worklist (${extra.length}): ${extra.join(", ")}`);
