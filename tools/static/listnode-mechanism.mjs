// Examine the intrusive list mechanism sead::AssertConfig::registerCallback depends on.
//
// The body calls ListNode::insertFront_ / ListNode::erase_ on a slot at param_1+0x20 and
// adjusts refcounts at +0x38 and in the event object. Those two ListNode functions are
// the reusable primitive; porting them unblocks everything that uses sead's intrusive
// lists, which is a large fraction of the engine.
import { readFileSync } from "node:fs";

const b = readFileSync("main.elf");
const FB = 0x100;
const IMG = 0x7100000000;
const foff = (va) => FB + (va - IMG);
const u32 = (va) => b.readUInt32LE(foff(va));
const u64 = (va) => Number(b.readBigUInt64LE(foff(va)));

// Find the sAssertEvent global and inspect its shape.
console.log("=== sAssertEvent ===");
const sAssertEventPtr = 0x7102fd79a0;
console.log(`  PTR_sAssertEvent @0x${sAssertEventPtr.toString(16)}`);
try {
  const target = u64(sAssertEventPtr);
  console.log(`  -> 0x${target.toString(16)}`);
  if (target >= IMG && target < IMG + 0x4000000) {
    // registerCallback treats PTR_sAssertEvent + 8 as a ListNode*, and +0x18 as a count.
    // So inspect 0x40 bytes from the target.
    const t = target;
    console.log(`  fields near 0x${t.toString(16)} (the flagged value is the pointee):`);
    for (let off = 0; off <= 0x28; off += 8) {
      try {
        const hi = u32(t + off);
        const lo = u32(t + off + 4);
        console.log(`    +0x${off.toString(16)}  0x${lo.toString(16).padStart(8, "0")}${hi.toString(16).padStart(8, "0")}`);
      } catch { break; }
    }
  }
} catch (e) {
  console.log(`  (read failed: ${e.message})`);
}

// Locate ListNode::insertFront_ and erase_ by finding the mangle stems in .rodata or by
// scanning the inventory for the names.
console.log("\n=== search decompiled inventory for ListNode ===");
try {
  const inv = readFileSync("../../sp2decomp/../re-work/inventory.txt", "utf8");
  let n = 0;
  for (const ln of inv.split("\n")) {
    if (/ListNode/.test(ln)) {
      console.log(`  ${ln.slice(0, 140)}`);
      if (++n > 10) break;
    }
  }
  if (n === 0) console.log("  no ListNode matches in inventory");
} catch (e) {
  console.log(`  inventory unreadable: ${e.message}`);
}

// The mangles themselves may appear as strings, which gives the exact symbol names.
console.log("\n=== ListNode mangles present as strings in main? ===");
const s = b.toString("latin1");
for (const stem of ["12insertFront_", "5erase_", "6ListNode", "13DelegateEvent"]) {
  const idx = s.indexOf("_ZN4sead" + stem);
  console.log(`  ${stem.padEnd(16)} ${idx >= 0 ? "found at file 0x" + idx.toString(16) : "not found"}`);
}
const m = s.match(/_ZN4sead8ListNode[0-9A-Za-z_]{4,}/g);
console.log(`  distinct _ZN4sead8ListNode* strings: ${m ? new Set(m).size : 0}`);
if (m) for (const t of [...new Set(m)].slice(0, 8)) console.log(`    ${t}`);
