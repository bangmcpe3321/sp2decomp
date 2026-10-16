// Which of the boot root's ENGINE dependencies were already decompiled in
// engine-decompiled.txt, and which still need bodies extracted?
//
// engine-decompiled.txt holds the 126 boot-closure functions. The boot root's direct
// engine callees are a different set, so this measures the gap before porting begins.
import { readFileSync } from "node:fs";

const decomp = readFileSync("engine-decompiled.txt", "utf8").replace(/^\uFEFF/, "");
const present = new Map();
for (const b of decomp.split(/^=+\s*$/m)) {
  const m = /^\s*0x([0-9a-f]+)\s+(\S.*)$/m.exec(b);
  if (m) present.set(m[2].trim(), "0x" + m[1]);
}
console.log(`functions in engine-decompiled.txt: ${present.size}`);

// AUTHORITATIVE NAME SOURCE. Ghidra strips namespaces, so several functions are named
// just "initialize" and matching on the trailing name collides them (an earlier version
// of this script assigned 0x7100eb9f1c to BOTH sead::GameFrameworkNx::initialize and
// sead::ForegroundBucketMgr::initialize). The boot closure inventory carries
// full-namespace names with addresses, so use it first and only fall back to name
// matching when a symbol is absent there.
const closure = new Map(); // full name -> address
try {
  for (const ln of readFileSync("boot-closure-fixed.txt", "utf8").split("\n")) {
    const m = /^\s+(0x[0-9a-f]+)\s+(\S.*?)(?:\s+\[.*)?$/.exec(ln);
    if (m) closure.set(m[2].trim(), m[1]);
  }
} catch {
  console.log("  (boot-closure-fixed.txt unavailable; falling back to name matching only)");
}
console.log(`closure entries with full names: ${closure.size}`);

// The 13 engine dependencies extracted from SysInit::Init, in call order.
const bootDeps = [
  "Lp::Sys::SysInit::Init",
  "Utl::dumpDateTime",
  "sead::AssertConfig::registerCallback",
  "sead::Framework::InitializeArg::InitializeArg",
  "sead::GameFrameworkNx::initialize",
  "Utl::dumpMemoryInfo",
  "sead::ForegroundBucketMgr::initialize",
  "HeapGroup::createInstance",
  "HeapGroup::createHeap",
  "Framework::Framework",
  "sead::GameFrameworkNx::initializeGraphicsSystem",
  "sead::TaskBase::MgrTaskArg::MgrTaskArg",
  "sead::Framework::RunArg::RunArg",
];

console.log("\n=== coverage of the boot root's engine dependencies ===");
let have = 0;
for (const d of bootDeps) {
  // 1. authoritative: the boot closure inventory
  let hit = closure.get(d);
  let how = "closure";
  // 2. fall back to the decompiled set, but ONLY when the trailing name is unambiguous
  if (!hit) {
    const tail = d.split("::").pop();
    const candidates = [...present.entries()].filter(
      ([name]) => name === tail || name.endsWith("::" + tail),
    );
    if (candidates.length === 1) {
      hit = candidates[0][1];
      how = `unique name match '${candidates[0][0]}'`;
    } else if (candidates.length > 1) {
      console.log(`  AMBIGUOUS  ${d}  -> ${candidates.length} candidates: ` +
        candidates.map(([n, v]) => `${v} ${n}`).join(", "));
      continue;
    }
  }
  if (hit) { have++; console.log(`  HAVE    ${d}  ${hit}  (${how})`); }
  else console.log(`  NEED    ${d}`);
}
console.log(`\n${have} of ${bootDeps.length} resolved.`);

// Names in engine-decompiled that look like the boot root's own family, to guide which
// addresses to extract next.
console.log("\n=== engine-decompiled entries in the Lp::Sys / Utl families ===");
let n = 0;
for (const [name, va] of present) {
  if (/^(Lp::Sys|Utl|RootTask|SysInit)/.test(name) || /SysInit|RootTask|dumpDate|dumpMem/.test(name)) {
    console.log(`  ${va}  ${name}`);
    if (++n > 24) break;
  }
}
