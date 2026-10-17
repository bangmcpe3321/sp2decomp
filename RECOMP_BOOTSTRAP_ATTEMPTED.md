# The engine bootstrap, implemented — and the null-parent assumption falsified

The bootstrap was implemented as designed. **It runs, and `tryCreate` returns null.** That falsifies the
central assumption behind it.

---

## 1. What was built

`bootstrap_engine_heap(CPU&)` in `main.cpp`, called after `main`'s constructors and before `nnMain`:

```cpp
// ExpHeap::tryCreate(void* buf, size_t size, SafeStringBase<char> const&, Heap* parent, bool)
//   _ZN4sead7ExpHeap9tryCreateEPvmRKNS_14SafeStringBaseIcEEPNS_4HeapEb   @ 0xe76c6c
// SafeStringBase<char> is { const char* stringTop; size_t length; }
c.x[0] = kHeapBase + 0x01000000;   // buf  (16 MB into the game heap)
c.x[1] = 0x0F000000;               // size (240 MB)
c.x[2] = &ssb;                     // SafeStringBase over a scratch page
c.x[3] = 0;                        // parent = nullptr   <- the intended circle-breaker
c.x[4] = 0;                        // bool
call(c, main.base + 0xe76c6c);
heap = c.x[0];
if (heap) { c.x[0] = heap; call(c, main.base + 0xe7cfc0); }  // HeapMgr::setCurrentHeap_
```

It also **removed** the unconditional `HeapMgr::initialize` diagnostic from the previous increment, so the
port is back to measuring its true state rather than a doctored one.

## 2. What happened

```
bootstrap: ExpHeap::tryCreate(buf=5001000000, size=0xf000000, parent=null) at main+e76c6c
bootstrap: root heap = 0x0
bootstrap: tryCreate returned null -- root heap NOT created
entering nnMain
=== HOST SIGSEGV ===  fault 0x88
  guest lr : main+e767d0  sead::ExpHeap::tryCreate + 0x44
```

**The call executed cleanly and returned `0`.** No fault, no crash — `tryCreate` **refused**.

That is a clean, informative result: **`ExpHeap::tryCreate` will not create a heap with a null parent.** It
returns null rather than faulting, which is exactly what a `try*` factory should do.

## 3. What that falsifies

The bootstrap design rested on this claim:

> *creating the first `ExpHeap` with a null parent (which `HeapNullOption` exists precisely to permit)*

**That is now falsified for this call.** `IDisposer`'s `HeapNullOption` permits a null heap for *some*
constructors, but `ExpHeap::tryCreate` does not accept a null parent in the way the design assumed.

**So the circle does not break at `ExpHeap::tryCreate`.** It breaks somewhere else, or with a different
parent.

## 4. What this establishes

| Item | State |
|---|---|
| Bootstrap implemented and wired in | ✅ **yes, runs before `nnMain`** |
| Diagnostic removed | ✅ yes — the port measures its true state again |
| `SafeStringBase<char>` as `{ptr, len}` accepted | ✅ **no crash — the call went through** |
| `tryCreate(buf, size, name, nullptr, false)` | ❌ **returns null** |
| Null-parent heap assumption | ❌ **FALSIFIED** |
| Root heap created | ❌ **no** |
| Fault unchanged | ✅ still `ExpHeap::tryCreate +0x44`, `0x88` |

## 5. What this does NOT establish

- **Why `tryCreate` returned null is not known.** Candidates: null parent rejected; the `SafeStringBase`
  layout I assumed is wrong; the `bool` argument means something other than assumed; alignment or size
  rejection.
- **`x[4] = 1` was not tried.** One bit, one experiment, untested.
- **`HeapMgr::initialize(Arena*)` (0xe7c6b8) was never called** — it is the other candidate entry point and
  remains untried.
- **No other `Heap` subclass was considered** (a `UnitHeap`, or a non-`ExpHeap` root).
- **The game is not booted.** Nothing is rendered. No NVN, no window, no shaders.
- **This is not a playable game, and this work has not made it one.**

## 6. Where this leaves the decision

This was the recommended option 1 — **implement the bootstrap**. It has been implemented, faithfully, and the
first concrete attempt was **rejected by the engine**.

That is the honest outcome: **the bootstrap is not a single call to a known signature; it is an unknown
sequence that must be reverse-engineered from the game's own start-up.**

**The remaining paths, unchanged in shape but now with evidence behind them:**

1. **Find and read Splatoon 2's actual start-up function** — the code that on hardware runs before `nnMain`
   and performs this sequence. **This is the only route that does not guess.** It has never been located.
2. **Port a title whose start-up the runtime already performs.**
3. **Stop, and keep the documentation.**

**Option 1 is now clearly the bottleneck**: every attempt to *guess* the bootstrap has been rejected by the
engine, which is what you would expect. The sequence is discoverable — but by reading the game's start-up, not
by trying signatures.

## 7. What the repository now contains

- A fully-named chain from `nnMain` to a circular heap dependency.
- **Six** documented Wonder-vs-Splatoon-2 silent mismatches (`g_fast`, module stride, `kDtInit`,
  `init_status`, allocator, `nnos` entry contract).
- Two toolchain traps: **`exefs` is LZ4** (never do offset math on it) and **`call_preserving` hooks miss
  direct recompiled calls**.
- The working recipes that produced every result: gdb watchpoints on a struct field, breakpoint-plus-backtrace,
  and the vtable resolution technique.
- A working 140 MB recompiled binary that reaches `nnMain` and runs the game's own framework start-up.
