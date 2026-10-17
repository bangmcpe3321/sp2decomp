# The SIGSEGV, diagnosed: `nn::os::LockMutex` on uninitialised state

Round 6. The anonymous crash from round 5 is now **fully located** — fault address, guest function,
register state and host backtrace.

---

## 1. The report

```
=== HOST SIGSEGV ===
  fault address : 0x1b8  1b8
  guest lr      : 0x7140080ddc  sdk+80ddc (_ZN2nn2os9LockMutexEPNS0_9MutexTypeE+48)
  guest sp      : 0x6a00ffff00

  x0  00000071406b41b0 00000071406c6158 000000714068b000 00000071406c5b90
  x4  0000000000000000 00000071406bf5c1 00000071406bf5c0 00000071406bf5c0
  x8  0000000000000000 0000000000000f50 ffffff8ebf93b3c0 000000714032d768
  x12 0000007140311a30 0000006f00000030 0000006f00000000 0000007140311a30
  x20 0000000000000000 0000000000000000 0000000000000000 0000000000000000
  x28 0000000000000000 0000006a00ffff10 0000007140080ddc 0000006a00ffff00
  host backtrace: #0..#22 (generated C++ frames)
```

**The crash is in Splatoon 2's own `nn::os::LockMutex(MutexType*)`, at `+0x48`, dereferencing
address `0x1b8`.**

## 2. What that means

`0x1b8` is a small offset — the signature of **a null (or near-null) base plus a field offset**. The
call is guest code in `sdk`, not an HLE stub: it is Splatoon 2's own mutex implementation reading a
field at `+0x1b8` from a pointer that is not valid.

A mutex lock is one of the first things almost any initialisation path does. **The most economical
explanation is that the state `LockMutex` reads has never been initialised** — because the code that
would initialise it belongs to SDK system start-up, and **this port enters the game at `nnMain`,
bypassing it.**

That is a **direct consequence of the round-3 decision** to enter through `nnMain` rather than
`nn::init::Start`. That decision was correct in motivation — Splatoon 2's SDK predates
`nn::init::Start` and exports no such symbol — but **"no `nn::init::Start`" does not mean "no system
initialisation"**. Splatoon 2's SDK must have its own equivalent, and the port has not found or run
it.

## 3. Evidence for that reading

| Observation | Supports |
|---|---|
| `x20..x27` are **all zero** | the caller passed no context; initialisation state is absent |
| fault at a **small offset** (`0x1b8`) | dereference through a null/invalid base, not a wild pointer |
| fault inside **`LockMutex`**, very early | mutex use is early-init behaviour |
| `sdk: _init at +0x24` ran, then this | the module's `_init` ran, but system init did not |

**This is a hypothesis with supporting evidence, not a proven conclusion.**

## 4. What the port is missing

Splatoon 2's `nn::init` surface is four symbols (`GetAllocator`, `InitializeAllocator`, and two
thread-local allocator helpers). A mutex implementation needs a thread pointer and a lock table —
normally set up by the SDK's `nninitStartup`/`nninitStart`. Candidates the port has not yet tried:

- another exported init symbol in `main` or `sdk` (not yet enumerated);
- the `__rtld_init` hook the runtime already provides, which the `nn::init::Start` path passes as an
  argument;
- the runtime's own `kernel_init()`/`memory_init()` being insufficient for what this SDK expects.

**None of these was tested.** Finding the right entry sequence is the next increment.

## 5. The fault handler itself

Added to `platform_linux.cpp`: `SIGSEGV`/`SIGBUS`/`SIGILL`/`SIGFPE` with `SA_SIGINFO | SA_ONSTACK`,
reporting

- the faulting address, resolved through `nx::describe()`;
- **guest `lr` and `sp`**, also resolved — which is what named `nn::os::LockMutex`;
- the full register file, four per line, as the runtime's own `dump_guest` does;
- a host backtrace (glibc `execinfo`, declared locally since the header is not always present).

It `_exit(70)`s rather than resuming a guest that has already faulted.

**This is the same technique the round-1 harness used**, and it converted an anonymous crash into a
named function in one run.

## 6. What this round establishes

| Item | State |
|---|---|
| Fault handler | ✅ added, works |
| SIGSEGV located | ✅ **`nn::os::LockMutex+0x48`, fault address `0x1b8`** |
| Guest register state at fault | ✅ captured (x20–x27 all zero) |
| Host backtrace | ✅ captured |
| Likely cause | 🟡 **uninitialised SDK state — the entry bypasses system init** |
| Fix | ❌ not designed or tested |

## 7. What this does NOT establish

- **The cause is a hypothesis.** "System init was bypassed" fits the evidence but was **not tested**.
- **The correct entry sequence for Splatoon 2's SDK was not found.** Its init symbols were not
  enumerated.
- **No game initialisation has completed.**
- **The HLE remains unexercised** — 116 symbols bound, none meaningfully called.
- **No NVN, no window, no render.**
- **The host backtrace frames were not symbolised** — they are raw addresses into the 140 MB
  generated binary; resolving them would need the runtime's `describe()` fed with the load base.
- **`x1b8` was not mapped to a specific field** of `MutexType`.

## 8. Next increment

Enumerate Splatoon 2's SDK entry/init exports and determine which one performs system initialisation
for a pre-`nn::init::Start` SDK; then run it before `nnMain`. The fault handler now makes any wrong
guess cheap to evaluate — it names the function every time.
