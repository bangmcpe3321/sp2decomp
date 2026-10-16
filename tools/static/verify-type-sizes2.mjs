// Distinguish "adjacent array elements" from "separate globals" for the two mutexes,
// and pin down region membership for every address the game hands to these APIs.
import { readFileSync } from "node:fs";

const b = readFileSync("main.elf");
const FB = 0x100;
const IMG = 0x7100000000;
const foff = (va) => FB + (va - IMG);
const inFile = (va, n = 1) => foff(va) >= 0 && foff(va) + n <= b.length;

// Section ranges in memory (established earlier from the NSO header).
const SEC = [
  { name: ".text",   start: 0x7100000000, end: 0x7100000000 + 0x1415068 },
  { name: ".rodata", start: 0x7101416000, end: 0x7102d624b3 },
  { name: ".rwdata", start: 0x7102d63000, end: 0x7102fdb1b0 },
  { name: ".bss",    start: 0x7102fdc000, end: 0x7103699e50 },
];
const secOf = (va) => SEC.find((s) => va >= s.start && va < s.end)?.name ?? "OUTSIDE image";

const ADDRS = {
  "InitializeMutex #1 (recursive true)": 0x71036580b8,
  "InitializeMutex #2 (recursive true)": 0x71036580d8,
  "InitializeMutex #3 (recursive false)": 0x7103698368,
};

console.log("=== which section does each mutex global live in? ===\n");
for (const [label, va] of Object.entries(ADDRS)) {
  const sec = secOf(va);
  const readable = inFile(va, 0x40);
  console.log(`  ${label}`);
  console.log(`    0x${va.toString(16)}  section=${sec}  bytes-readable-in-file=${readable}`);
}

// If a global is in .bss it has no file bytes, which is why the earlier dump was empty.
console.log("\n=== does the file actually contain these addresses? ===\n");
const FILE_LIMIT = FB + (0x2fdc000 - IMG); // start of .bss in file terms
console.log(`  file length                = 0x${b.length.toString(16)}`);
console.log(`  .bss begins at file offset = 0x${FILE_LIMIT.toString(16)}`);
for (const [label, va] of Object.entries(ADDRS)) {
  const f = foff(va);
  console.log(`  0x${va.toString(16)} -> file 0x${f.toString(16)}  ${f < b.length ? "IN FILE" : "BEYOND EOF (bss, zero-filled at runtime)"}`);
}

// ---------------------------------------------------------------------------
// Are the two globals adjacent elements of one object, or independent globals?
// Independent globals in .bss are separated by the linker's alignment for each
// symbol, which is NOT necessarily sizeof(MutexType).
// ---------------------------------------------------------------------------
console.log("\n=== interpretation of the 0x20 gap ===\n");
console.log("  0x71036580d8 - 0x71036580b8 = 0x20");
console.log("  Both are in .bss, so they are distinct symbols, not proven array elements.");
console.log("  A 0x20 separation is CONSISTENT with sizeof(MutexType)==0x20 but does not");
console.log("  prove it: two independent 8-byte-aligned globals can also be 0x20 apart.");
console.log("  => treat 0x20 as an UPPER BOUND candidate, not a measurement.");

// ---------------------------------------------------------------------------
// MessageQueueType is a genuine measurement: the queue and its buffer are two fields
// of the SAME object, so their delta is a hard bound.
// ---------------------------------------------------------------------------
console.log("\n=== MessageQueueType: hard bound from inline sibling fields ===\n");
const pairs = [
  [0x1f8, 0x240, 0x20],
  [0x60, 0xa8, 0x20],
  [0x18, 0x60, 0x20],
  [0x168, 0x1b0, 0x21],
];
for (const [q, bf, c] of pairs) {
  const queueSize = bf - q;
  const bufSize = c * 8;
  console.log(
    `  queue +0x${q.toString(16)}  buffer +0x${bf.toString(16)}  count ${c}  ` +
    `queue-region 0x${queueSize.toString(16)}  buffer 0x${bufSize.toString(16)}`
  );
}
console.log("\n  Every pair shows the buffer exactly 0x48 after the queue, so the queue's");
console.log("  region is 0x48. If the buffer is declared as an array field, then");
console.log("  sizeof(MessageQueueType) == 0x48 - 0 and the count is a runtime capacity.");
console.log("  Observed count 0x20/0x21 with 8-byte slots => buffer 0x100/0x108 bytes.");

// ---------------------------------------------------------------------------
// SemaphoreType: consistent offset 0x20 across four sites, but no sibling bound.
// ---------------------------------------------------------------------------
console.log("\n=== SemaphoreType ===\n");
console.log("  Always 'this + 0x20' at four call sites. Consistency means the field offset");
console.log("  is stable, but with no following field in evidence the size is UNBOUNDED by");
console.log("  these call sites alone.");

// ---------------------------------------------------------------------------
// ThreadType: mostly held by pointer, so its size is largely unexercised.
// ---------------------------------------------------------------------------
console.log("\n=== ThreadType ===\n");
console.log("  Three of four SetThreadCoreMask sites dereference a POINTER field:");
console.log("    *(ThreadType **)(this + 0xe0), *(ThreadType **)(this + 0xd0)");
console.log("  One passes inline storage: (ThreadType *)(this + 8)");
console.log("  ThreadType is allocated by the SDK on the game's behalf (CreateThread), so its");
console.log("  size is an SDK-internal detail and is NOT observable from these call sites.");
console.log("  Any host reserve >= the true size is sufficient, since the game never reads");
console.log("  fields inside it in the observed code.");
