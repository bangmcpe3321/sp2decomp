// Determine which decompiled function is really sead::ForegroundBucketMgr::initialize,
// resolving the address collision that boot-dep-coverage.mjs produced by matching on the
// trailing name "initialize".
//
// Ghidra strips namespaces from its output, so several functions can be named just
// "initialize". This lists ALL of them with addresses and body sizes so the right one can
// be identified by its size, and cross-checks against the boot closure inventory.
import { readFileSync } from "node:fs";

const decomp = readFileSync("engine-decompiled.txt", "utf8").replace(/^\uFEFF/, "");
const rows = [];
for (const b of decomp.split(/^=+\s*$/m)) {
  const hm = /^\s*0x([0-9a-f]+)\s+(\S.*)$/m.exec(b);
  if (!hm) continue;
  const sm = /body size:\s*(\d+)/.exec(b);
  rows.push({
    va: "0x" + hm[1],
    name: hm[2].trim(),
    size: sm ? Number(sm[1]) : -1,
    body: b,
  });
}

console.log(`functions in engine-decompiled.txt: ${rows.length}\n`);

console.log("=== every function whose name ends in 'initialize' ===");
const inits = rows.filter((r) => /initialize$/.test(r.name));
for (const r of inits) console.log(`  ${r.va}  ${String(r.size).padStart(5)} B  ${r.name}`);

console.log("\n=== names containing ForegroundBucket / BucketMgr ===");
for (const r of rows.filter((r) => /Bucket/i.test(r.name))) {
  console.log(`  ${r.va}  ${String(r.size).padStart(5)} B  ${r.name}`);
}

// The boot root's call site for ForegroundBucketMgr::initialize: find the line in
// SysInit::Init that calls it, to see which symbol Ghidra actually labelled there.
console.log("\n=== the boot root's line calling it ===");
const init = rows.find((r) => r.name === "Init" && r.va === "0x71011f5b20");
if (init) {
  for (const ln of init.body.split("\n")) {
    if (/Bucket|initialize/i.test(ln)) console.log(`  ${ln.trim().slice(0, 120)}`);
  }
}

// Cross-check against the boot closure inventory, which has the authoritative name.
console.log("\n=== boot closure entries mentioning Foreground or Bucket ===");
try {
  const clo = readFileSync("boot-closure-fixed.txt", "utf8");
  for (const ln of clo.split("\n")) {
    if (/Foreground|Bucket/i.test(ln)) console.log(`  ${ln.trim()}`);
  }
} catch {
  console.log("  boot-closure-fixed.txt not readable");
}

// And the older engine reference, which recorded name+address pairs.
console.log("\n=== ENGINE_REFERENCE.md entries mentioning Foreground ===");
try {
  const ref = readFileSync("C:/Users/Hexa/Documents/nintendo/sp2decomp/ENGINE_REFERENCE.md", "utf8");
  const idx = ref.indexOf("Foreground");
  if (idx >= 0) console.log(ref.slice(Math.max(0, idx - 320), idx + 220));
  else console.log("  no mention");
} catch {
  console.log("  ENGINE_REFERENCE.md not readable");
}
