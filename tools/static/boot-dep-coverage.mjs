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
  // exact, then by trailing member name (Ghidra strips the namespace in its output)
  const tail = d.split("::").pop();
  let hit = present.get(d);
  let how = "exact";
  if (!hit) {
    for (const [name, va] of present) {
      if (name === tail || name.endsWith("::" + tail)) { hit = va; how = `matched '${name}'`; break; }
    }
  }
  if (hit) { have++; console.log(`  HAVE    ${d}  ${hit}  (${how})`); }
  else console.log(`  NEED    ${d}`);
}
console.log(`\n${have} of ${bootDeps.length} available; ${bootDeps.length - have} need bodies extracted.`);

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
