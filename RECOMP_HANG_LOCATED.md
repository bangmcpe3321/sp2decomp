# The hang is located: `main`'s constructor #1367

Round 10. The round-9 run was "still running" at 180 s. Run for **ten minutes** and the position is
**identical** — so it is not slow, it is **hung**, and the hang is located precisely.

---

## 1. The measurement

| Duration | `main` constructors | Last line |
|---:|---:|---|
| 180 s (round 9) | 1,368 | `main init[1367]` |
| **600 s (round 10)** | **1,368** | **`main init[1367]`** |

```
exit: 124  (still running at the 600s timeout)
lines: 1495
  sdk  init[N]: 74
  main init[N]: 1368
...
main init[1367] +0xd5a238 -> main+d5a238
    (_ZN2nn3nex20PseudoGlobalVariableINS0_14StreamSettingsEEC2Ev+3cc)
```

**Ten minutes produced no additional constructor.** The run is stuck inside **#1367**.

## 2. The exact location

```
nn::nex::PseudoGlobalVariable<nn::nex::StreamSettings>::PseudoGlobalVariable()   at +0x3cc
```

`nn::nex` is Nintendo's networking library. `PseudoGlobalVariable` is a lazy-initialisation wrapper.
The constructor never returns — the `call_preserving` for `init[1367]` was entered and did not come
back.

**The three plausible causes**, none tested:

1. **A spin-wait on a lock** that will never be released — very likely, given `nex` is threaded
   networking code and the HLE provides no real service behind it.
2. **A thread join** on a thread that never runs to completion.
3. **An unbounded loop** in recompiled code, e.g. waiting for a service response.

## 3. Why this is a good result, not a bad one

The progression across ten rounds has been from *wrong* to *located*:

| Round | Failure | Character |
|---:|---|---|
| 3 | `nn::init::Start` not found | one missing entry point |
| 5 | `sdk+30 (_init+c)` | wrong hardcoded offset |
| 6 | `nn::os::LockMutex` SIGSEGV | located by a fault handler |
| 8 | 74 constructors silently skipped | wrong status convention |
| 9 | `nn::nex::WaterMark` null `this` | missing allocator |
| **10** | **hang in constructor #1367** | **located to one function** |

**Every one of these is now a named function, not an anonymous failure.** The port has gone from
"cannot link" to "executes 1,368 of `main`'s static constructors and hangs inside a specific one".

## 4. What this round establishes

| Item | State |
|---|---|
| Round-9 "still running" | ✅ **resolved: it was a hang, not slowness** |
| Hang location | ✅ **`nn::nex::PseudoGlobalVariable<StreamSettings>` ctor, `main+d5a238+0x3cc`** |
| `sdk` constructors complete | ✅ **74 / 74** |
| `main` constructors | ✅ **1,367 completed, hangs on #1,367 (0-based)** |
| `nnMain` reached | ❌ **no** |

## 5. What this does NOT establish

- **The cause of the hang is not identified** — spin-wait, join, or loop are all open.
- **`main`'s total constructor count is unknown**, so how far #1367 is through the list is unknown.
- **`nnMain` has still not been reached.**
- **The hang was not made interruptible** — no watchdog, so the process had to be killed by timeout.
- **No individual constructor's behaviour was inspected** beyond its entry log.
- **The allocator buffer is still a fixed 64 MB**, and `nex` allocates heavily; exhaustion is an
  untested alternative explanation for the stall.
- **No NVN, no window, no shader, no render.** Display and audio are stubs.
- **This is not a booted game.** It is a process that survives 1,367 static constructors and hangs on
  the next.

## 6. Next increment

Distinguish "waiting" from "looping": run with a sampling profiler or add a watchdog that dumps the
guest `pc`/`lr` for the hung thread after N seconds of no progress. The fault handler already proves
that naming the function is what makes these problems tractable — the same technique applied to a
*hang* rather than a *fault* would name the loop or the wait.
