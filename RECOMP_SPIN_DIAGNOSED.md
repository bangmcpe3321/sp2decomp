# The hang is a SPIN, and the worker threads are asleep

Two experiments, both decisive. This is the sharpest diagnosis the project has produced.

---

## 1. Experiment A: allocator exhaustion — ELIMINATED

Round 10 flagged a fixed 64 MB game heap as an untested alternative cause of the hang.

| Heap size | Result |
|---:|---|
| 64 MB | hang at `main init[1367]` |
| **512 MB (8×)** | **hang at `main init[1367]`** |

**Eight times the memory changed nothing.** The hang is not allocation pressure. That hypothesis is
**disproved**, cheaply, and it was right to test it first.

## 2. Experiment B: what is the hung thread actually *doing*?

No debugger is installed (`gdb`, `eu-stack`, `pstack` all missing), so the kernel's own view was used
while the process was hung:

```
wchan: 0
threads: 3
  tid 14968  wchan=0                     state=R     <- the main thread
  tid 14970  wchan=hrtimer_nanosleep     state=S
  tid 14971  wchan=hrtimer_nanosleep     state=S
```

**This eliminates two of the three remaining hypotheses and confirms the third:**

| Hypothesis | Kernel evidence would be | Observed | Verdict |
|---|---|---|---|
| Spin-wait on a lock | `state=R`, `wchan=0` | **exactly that** | ✅ **it is a spin** |
| Thread join | `state=S`, wchan in `futex`/`wait` | state is R | ❌ eliminated |
| Blocking wait / sleep | `state=S` | state is R | ❌ eliminated |

**The main thread is burning CPU in a busy loop** (`wchan=0` means it is not blocked in the kernel at
all), inside `nn::nex::PseudoGlobalVariable<nn::StreamSettings>::PseudoGlobalVariable()+0x3cc`.

## 3. The finding that follows

**There are three threads.** The main thread spins, and **the other two are sleeping**
(`hrtimer_nanosleep`) — so the runtime *does* create threads, and they are alive but idle.

**The most economical reading is that `main` is spinning on a condition that the sleeping worker
threads are supposed to satisfy, and those threads are asleep because the work they should be doing was
never handed to them or never completed.**

That is a *shape* of bug this port has not seen before: not a wrong constant, not a missing
initialiser, but **a cross-thread handshake where one side spins and the other sleeps**. The scheduled
HLE provides no real service behind `nex`, so anything waiting on networking activity would spin
forever — which fits.

**This is a hypothesis with strong supporting evidence, not a proven conclusion.**

## 4. What this establishes

| Item | State |
|---|---|
| Allocator exhaustion | ❌ **DISPROVED** (512 MB, same hang) |
| Hang is a blocking wait | ❌ **DISPROVED** (state R, not S) |
| Hang is a thread join | ❌ **DISPROVED** (state R, not S) |
| Hang is a spin | ✅ **CONFIRMED** (`state=R`, `wchan=0`) |
| Thread count | ✅ **3** — main spinning, two asleep |
| Location | ✅ `main+d5a238`, `nn::nex::PseudoGlobalVariable<StreamSettings>+0x3cc` |

## 5. What this does NOT establish

- **The loop condition was not identified.** "Spinning on something the sleeping threads should
  satisfy" fits the evidence but was not proven.
- **What the two sleeping threads are** was not determined — no thread names, no stacks (no debugger).
- **The spin was not stopped or bounded.** It had to be killed.
- **`main`'s total constructor count remains unknown.**
- **`nnMain` has still not been reached.**
- **No NVN, no window, no render.** Display and audio are stubs.
- **This is not a booted game.**

## 6. Next increment

Install a debugger (`sudo apt install gdb`, which needs network/root — neither of which this session
had) **or** add a SIGALRM watchdog *inside* the runtime that, after N seconds without progress, prints
the guest `pc`/`lr` through `describe()`. Either names the spinning function precisely — which is what
has made every previous failure tractable.

The cheaper route in-session is the watchdog, because it needs no new packages and the fault-reporting
machinery is already written.
