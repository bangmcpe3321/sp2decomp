// Verify SDK type sizes from the binary.
//
// Method: the game passes addresses of its own storage to these APIs, so the SPACING
// between adjacent objects reveals the SDK's own size for the type. For globals, the
// gap between consecutive initialisation call targets is the array stride.
import { readFileSync } from "node:fs";

const b = readFileSync("main.elf");
const FB = 0x100;          // file offset = 0x100 + (VA - imageBase)
const IMG = 0x7100000000;

const foff = (va) => FB + (va - IMG);
const readBytes = (va, n) => b.subarray(foff(va), foff(va) + n);
const u32 = (va) => b.readUInt32LE(foff(va));
const u64 = (va) => Number(b.readBigUInt64LE(foff(va)));

const hex = (buf) => buf.toString("hex").replace(/(.{32})/g, "$1\n                        ");

// ---------------------------------------------------------------------------
// 1. MutexType — globals observed being initialised
// ---------------------------------------------------------------------------
console.log("=== MutexType: global objects passed to InitializeMutex ===\n");
const mutexGlobals = [0x71036580b8, 0x71036580d8, 0x7103698368];
for (const va of mutexGlobals) {
  console.log(`  0x${va.toString(16)}`);
  console.log(`    bytes: ${hex(readBytes(va, 0x30))}`);
}
console.log(`\n  gap between 0x71036580b8 and 0x71036580d8 = 0x${(0x71036580d8 - 0x71036580b8).toString(16)} (${0x71036580d8 - 0x71036580b8} bytes)`);

// Is that region an array of MutexTypes? Check whether more init calls target nearby
// addresses by scanning .text for the immediate addresses used with ADRP+ADD.
// Cheaper: report whether the spacing divides the distance to the third global.
console.log(`\n  distance from 0x71036580b8 to 0x7103698368 = 0x${(0x7103698368 - 0x71036580b8).toString(16)}`);
console.log(`  divisible by 0x20? ${((0x7103698368 - 0x71036580b8) % 0x20) === 0}`);
console.log(`  divisible by 0x28? ${((0x7103698368 - 0x71036580b8) % 0x28) === 0}`);
console.log(`  divisible by 0x18? ${((0x7103698368 - 0x71036580b8) % 0x18) === 0}`);

// ---------------------------------------------------------------------------
// 2. MutexType embedded in class instances — spacing between two mutex fields
//    Observed: LockMutex(this + 0x348) and LockMutex(puVar4 + 0x768).
//    If the same class holds several, the deltas bound the size.
// ---------------------------------------------------------------------------
console.log("\n=== MutexType: offsets observed inside caller-owned objects ===");
const observedOffsets = [0x348, 0x768, 0x4a0];
for (const o of observedOffsets) console.log(`  this + 0x${o.toString(16)}`);
// 0x768 - 0x348 = 0x420; 0x4a0 - 0x348 = 0x158
console.log(`  delta 0x768-0x348 = 0x${(0x768 - 0x348).toString(16)}`);
console.log(`  delta 0x4a0-0x348 = 0x${(0x4a0 - 0x348).toString(16)}`);

// ---------------------------------------------------------------------------
// 3. MessageQueueType — one call site gives queue AND its buffer as sibling offsets
//    InitializeMessageQueue((MQ*)(this + 0x1f8), (ulong*)(this + 0x240), 0x20)
// -> the buffer starts 0x48 after the queue, so sizeof(MessageQueueType) <= 0x48.
// ---------------------------------------------------------------------------
console.log("\n=== MessageQueueType: bounds from an inline call site ===");
const qOff = 0x1f8, bufOff = 0x240, count = 0x20;
console.log(`  queue at this+0x${qOff.toString(16)}, buffer at this+0x${bufOff.toString(16)}, count 0x${count.toString(16)}`);
console.log(`  buffer - queue = 0x${(bufOff - qOff).toString(16)} (${bufOff - qOff} bytes)`);
console.log(`  => sizeof(MessageQueueType) <= 0x${(bufOff - qOff).toString(16)}`);
console.log(`  buffer size = count * 8 = 0x${(count * 8).toString(16)} (${count * 8} bytes)`);

// A second call site gives the same relationship at a different base
const pairs = [
  [0x1f8, 0x240, 0x20],
  [0x60, 0xa8, 0x20],
  [0x18, 0x60, 0x20],
  [0x168, 0x1b0, 0x21],
];
console.log("\n  all observed (queue, buffer) offset pairs:");
for (const [q, bf, c] of pairs) {
  console.log(`    queue +0x${q.toString(16)}  buffer +0x${bf.toString(16)}  count 0x${c.toString(16)}  -> delta 0x${(bf - q).toString(16)}`);
}

// ---------------------------------------------------------------------------
// 4. SemaphoreType — always observed at this + 0x20 across call sites
// ---------------------------------------------------------------------------
console.log("\n=== SemaphoreType: observed offsets ===");
console.log("  InitializeSemaphore((SemaphoreType *)(this + 0x20), ...) at four call sites");
console.log("  a single consistent offset gives no size bound on its own");

// ---------------------------------------------------------------------------
// 5. ThreadType — the game stores ThreadType POINTERS, not inline values
// ---------------------------------------------------------------------------
console.log("\n=== ThreadType: storage form ===");
console.log("  SetThreadCoreMask(*(ThreadType **)(this + 0xe0), -1, mask)  -> POINTER");
console.log("  SetThreadCoreMask(*(ThreadType **)(this + 0xd0), -1, mask)  -> POINTER");
console.log("  SetThreadCoreMask((ThreadType *)(this + 8), a, b)           -> inline at +8");
console.log("  ThreadType is mostly held BY POINTER, so its size is not exercised inline;");
console.log("  only the (this + 8) case constrains it.");
