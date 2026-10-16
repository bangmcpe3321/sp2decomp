// Which of NVN's 453 functions does the boot-to-graphics-bringup path actually reach?
//
// nvnLoadCProcs resolves all 453 by name (see nvn.hpp), but the engine reaches them through
// PTR_pfnc_nvn*_7102xxxxxx globals. Counting the DISTINCT globals referenced in the graphics
// bring-up bodies gives a bounded "needed to boot" subset instead of the whole API -- which is
// the question worth answering before porting any of it.
import { readFileSync, existsSync } from "node:fs";

const FILES = [
  ["GraphicsNvn::GraphicsNvn", "gnvn.txt"],
  ["GraphicsNvn::initializeImpl", "gnvninit.txt"],
  ["initializeGraphicsSystem", "igs.txt"],
];

// The full measured surface, for the "how much of it" fraction.
const allNames = new Set();
{
  const body = readFileSync("loadc.txt", "utf8");
  for (const m of body.matchAll(/"(nvn[A-Za-z0-9_]+)"/g)) allNames.add(m[1]);
}

console.log(`measured NVN surface: ${allNames.size} functions\n`);

const reached = new Map(); // nvn name -> which bodies reference it
for (const [label, file] of FILES) {
  if (!existsSync(file)) {
    console.log(`  (missing ${file} -- skipping ${label})`);
    continue;
  }
  const body = readFileSync(file, "utf8");
  // The globals are spelled PTR_pfnc_<nvnName>_7102xxxxxx
  const here = new Set();
  for (const m of body.matchAll(/PTR_pfnc_(nvn[A-Za-z0-9_]+)_7102[0-9a-f]{6}/g)) here.add(m[1]);
  // Only count names that are part of the measured surface.
  const known = [...here].filter((n) => allNames.has(n));
  const unknown = [...here].filter((n) => !allNames.has(n));
  for (const n of known) {
    if (!reached.has(n)) reached.set(n, []);
    reached.get(n).push(label);
  }
  console.log(`${label}`);
  console.log(`   globals referenced : ${here.size}`);
  console.log(`   in the 453-name surface : ${known.length}`);
  if (unknown.length) console.log(`   NOT in the surface (${unknown.length}): ${unknown.join(", ")}`);
  for (const n of known) console.log(`      ${n}`);
  console.log("");
}

console.log("=== the bounded bring-up subset ===");
console.log(`distinct NVN functions reached: ${reached.size} of ${allNames.size}` +
  ` (${((100 * reached.size) / allNames.size).toFixed(1)}% of the API)`);
for (const [n, where] of reached) {
  console.log(`   ${n.padEnd(42)} <- ${where.join(", ")}`);
}

// Which parts of the API are NOT reached at bring-up? That is where the remaining work lives.
const byPrefix = new Map();
for (const n of allNames) {
  const m = /^nvn([A-Z][a-z0-9]*)/.exec(n);
  const k = m ? m[1] : "(other)";
  if (!byPrefix.has(k)) byPrefix.set(k, { total: 0, reached: 0 });
  byPrefix.get(k).total++;
  if (reached.has(n)) byPrefix.get(k).reached++;
}
console.log("\n--- reached vs total, by object ---");
for (const [k, v] of [...byPrefix.entries()].sort((a, b) => b[1].total - a[1].total)) {
  const mark = v.reached === 0 ? "  <-- NOT TOUCHED at bring-up" : "";
  console.log(`   ${k.padEnd(16)} ${String(v.reached).padStart(4)} / ${String(v.total).padStart(4)}${mark}`);
}

// Extraction-order sanity: these bodies reference the resolver globals, so every name should
// already be in the surface. Report if not, because that would mean a name was missed.
const missing = [...reached.keys()].filter((n) => !allNames.has(n));
console.log(`\nnames reached but absent from the 453 surface: ${missing.length}`);
