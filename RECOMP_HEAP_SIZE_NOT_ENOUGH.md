# The heap size was not the blocker — and the caller claim is retracted

Two results, one negative and one self-correction.

---

## 1. The measured heap size, applied: a clean negative

`kAllocSize` was changed from 512 MB to the **measured `0xC9200000` (3218 MB)**, taken from the live game's
`x1` at `svcSetHeapSize`.

```
installing game allocator at kHeapBase: 0x5000000000 size 0xc9200000
game allocator installed
entering nnMain
=== HOST SIGSEGV ===  fault 0x88
  main+e767d0  sead::ExpHeap::tryCreate + 0x44
```

**The heap is now 6.3× larger and the fault is byte-identical.**

**So the size was never the binding constraint.** Five rounds of guessing at 64 MB / 512 MB are closed, and the
answer to "would the right number fix it?" is **no**. That is worth exactly one rebuild to have established.

## 2. The caller address is RETRACTED

I reported the caller of `svcSetHeapSize` as `sdk+0x86868`, from the `lr` captured at the breakpoint. **That is
wrong**, and disassembling around it shows why:

```
sdk+0x086854:  0xa9017bfd              ; stp x29, x30, [sp, #N]      <- prologue
sdk+0x086858:  0x910043fd              ; mov x29, sp
sdk+0x08685c:  0xaa0103e0              ; mov x0, x1
sdk+0x086860:  0xaa0203e1              ; mov x1, x2
sdk+0x086864:  0x9408ea96              ; bl  -> sdk+0x2C1xBC      *** NOT 0x9e660 ***
sdk+0x086868:  0x34000300              ; cbz w0, ...              <- what lr pointed at
```

`lr = 0x86868` implies the call was a `bl` at `0x86864` — but **that `bl` targets `sdk+0x2C1xBC`, not
`svcSetHeapSize` at `0x9e660`**. To reach `0x9e660` the encoding would need `imm26 = 0x5F7F`
(`0x94005F7F`); the actual word is `0x9408EA96`.

**Not the caller.** The most plausible explanation is that the wrapper at `0x9e660` is **tail-entered with `b`**,
so `lr` was inherited from farther up and never pointed at the `bl` I assumed.

**What survives:** the heap size `0xC9200000`, read directly from `x1`. **What does not:** the caller address.

## 3. The methodological error, stated plainly

**I hand-matched `lr` to a `bl` instead of taking a backtrace.** That is the *same class of mistake* as the
round-2 `GetNext`/`SetNext` "overlap": arithmetic on encoded instructions, done by hand, where a tool exists
that cannot make that error.

**`bt` at the breakpoint would have been correct the first time.** The lesson from this project's five previous
corrections applies again: when a debugger is attached, use it rather than decoding by hand.

## 4. What this round establishes

| Item | State |
|---|---|
| Heap size applied | ✅ `0xC9200000` (3218 MB) |
| Heap size fixed the fault | ❌ **no — identical fault** |
| Heap size was the blocker | ❌ **DISPROVED** |
| Heap size value itself | ✅ **still valid** (read from `x1`) |
| Caller = `sdk+0x86868` | ❌ **RETRACTED** |
| Next method for the caller | ✅ **`bt` at the breakpoint** |

## 5. What this does NOT establish

- **The real caller of `svcSetHeapSize` is unknown again.**
- **Whether `0x9e660` is tail-entered with `b`** is a hypothesis, not measured.
- **Why `ExpHeap::tryCreate` still fails** is unexplained — and it is now clear the cause is *neither* the heap
  size *nor* (as far as was investigated) the arena buffer.
- **No `InitializeAllocator` capture** confirmed the size reaches it, though the log shows the call was made with
  `0xc9200000`.
- **The port is unchanged in behaviour and still not booted.** Nothing is rendered. **This is not a playable
  game.**

## 6. Next increment

**Re-catch `svcSetHeapSize` and take a `bt`** — the caller from the debugger, not from `lr` arithmetic. That is
the only correction needed to restore the missing link, and it uses the method that should have been used
originally.

Beyond that, the accumulated evidence points away from "supply the right number" and toward **the engine's own
start-up doing something the port still has not done** — which is a build task, not a measurement.
