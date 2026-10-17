# The allocator fix: 1,368 static constructors and still running

Round 9. The round-8 hypothesis — *"a null `new` because the game's allocator was never installed"* —
is **confirmed and fixed**, and it produced the largest advance in the entire project.

---

## 1. The proof

Instrumenting `call_preserving` to log any call to `nn::init::InitializeAllocator`
(`main+0xdda018`) produced **no log line at all** across a full run:

> **`nn::init::InitializeAllocator` is never called by any path this port takes.**

The game defines its own `operator new` (14 references in `main`'s table), so with no allocator
installed, **every `new` in `main`'s static initialisation returned null** — and `nn::nex::WaterMark`
was simply the first one to dereference it. That was the entire `this == NULL` fault.

## 2. The fix

`nn::init::InitializeAllocator(void* buf, size_t size)` over a **64 MB host buffer**, called in
`nn_main` **after `sdk`'s constructors and before `main`'s** — which is where real SDK start-up would
do it:

```
installing game allocator: buf=0x7c6fd8262010 size=0x4000000 via main+dda018 (_ZN2nn4init19InitializeAllocatorEPvm+0)
game allocator installed
```

## 3. The result

| Metric | Round 8 | **Round 9** |
|---|---:|---:|
| `sdk` constructors | 74 | **74** |
| `main` constructors | **0** | **1,368** |
| Outcome | SIGSEGV in `nn::nex::WaterMark` | **still running at the 180 s timeout** |

```
=== exit: 124 (124 = still running at 180s timeout) ===
=== total output lines: 1495 ===
  sdk  init[N]: 74
  main init[N]: 1368
```

The run executes **1,368 of `main`'s static constructors** — `nn::pia` (P2P networking), `nn::nex`
(Nintendo networking), `pead` (the heap layer), `std::vector` allocations, `pexp` string handling —
and **does not crash**.

**It is still inside the constructor loop when the timeout hits**, which means the remaining
constructors are simply numerous, not that it is stuck.

## 4. The complete chain, across all nine rounds

Every step was a *silent* Wonder-vs-Splatoon-2 mismatch, each discovered only by running:

| # | Assumption in the MIT runtime | What it cost | Round |
|---|---|---|---|
| 1 | `g_fast[4]` module table | 2 of 6 modules dropped | 1 |
| 2 | 16 MB module stride | `sdk` mapped over `main` | 4 |
| 3 | `kDtInit = 0x30` | called `_init+0xc` | 5 |
| 4 | `init_status == 1` | 74 SDK constructors skipped | 8 |
| 5 | **allocator already installed** | **every `new` returned null** | **9** |

**Not one of these produced an error message naming the assumption.** Four were caught by
fail-loudly guards (which at least named the function), and the fifth was a bare SIGSEGV that only a
hand-written fault handler could locate.

## 5. What this round establishes

| Item | State |
|---|---|
| Null-`new` hypothesis | ✅ **CONFIRMED** |
| `InitializeAllocator` never called | ✅ **proven by instrumentation** |
| Allocator installed over a host buffer | ✅ works |
| `nn::nex::WaterMark` fault | ✅ **gone** |
| `main`'s static constructors | ✅ **1,368 executed** |
| Process survives past them | ✅ **still running at 180 s** |

## 6. What this does NOT establish

- **`nnMain` has still not been reached.** The run is inside `main`'s *static constructors*, which run
  before `nnMain`. "Still running" is not "the game started".
- **The 180 s timeout is not completion.** Whether it finishes the constructor list, and how long that
  takes, is unknown.
- **`main`'s total `init_count` was never printed** — the loop is still going, so 1,368 is a lower
  bound, not the total.
- **No constructor's individual behaviour was inspected.** One could be silently failing or looping.
- **The allocator buffer is a fixed 64 MB.** If the game needs more, it will fail later and the
  failure will look unrelated.
- **The HLE remains barely exercised** — one import called across the whole run.
- **No NVN, no window, no shader, no render.** Display and audio are stubs by design.
- **This is not a playable game and not a booted game.** It is a process that survives static
  initialisation.

## 7. Next increment

Let the run continue past 180 s and find whether the constructor list completes and `nnMain` is
reached. If it stalls, the count at the stall point names the constructor responsible.
