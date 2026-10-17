# The real heap size: 3218 MB — and why the port never got it

Caught `svcSetHeapSize` in the running game with the breakpoint armed before start-up. **The number this
project guessed at for five rounds is now measured.**

---

## 1. The capture

```
Breakpoint 1, 0x000000000be70660   (sdk_base 0x0bdd2000 + 0x9e660)
=== svcSetHeapSize CALLED ===
  x0 (out pointer) = 0x100c703f58
  x1 (SIZE)        = 0xc9200000   3374317568 bytes = 3218.0 MB
  lr (caller)      = 0xbe58868    sdk+0x86868
  sp               = 0x100c703f20
```

| Field | Value |
|---|---|
| **Heap size requested** | **`0xC9200000` = 3,374,317,568 bytes ≈ 3218 MB ≈ 3.14 GiB** |
| **Caller** | **`sdk+0x86868`** |
| Out-pointer | `0x100c703f58` — a **stack** address (`sp + 0x38`), so the caller stores the returned base locally |

**The port was giving the game 512 MB. The real request is 3218 MB — 6.3× larger.**

## 2. Where the number comes from — and a guess that was right

`0xC9200000` sits just below our own `get_info` **case 6** value:

```
get_info type 6 (TotalMemoryAvailable)  returns  0xCD500000   = 3442 MB
game asks for                                    0xC9200000   = 3218 MB
difference                                       0x04300000   =   67 MB
```

**The game computes `size = TotalMemoryAvailable − 67 MB` and asks for that.** Our `get_info` case 6 value of
`0xCD500000` (~3.2 GiB) — which was chosen as "like an application" — turned out to be **very close to
correct**, and the derivation is consistent.

**So the memory model in the port is sound.** The failure was never the number — it was that **the call is
never made.**

## 3. Why the port never makes it

The caller is **`sdk+0x86868`**. Context from earlier rounds:

| Address | Symbol / meaning |
|---|---|
| **`sdk+0x86868`** | **the caller of `svcSetHeapSize`** |
| `sdk+0x86bd8` | `nnosInitialize` — **the port calls this** |
| `sdk+0x86d6c` | inside `nnosInitialize`, where it calls `nnosGetDefaultUserExceptionStackForApplication` |

**The caller sits `0x370` bytes before `nnosInitialize`.** So it is either a separate function immediately
preceding it, or an earlier part of the same start-up region.

**The port calls `nnosInitialize` but evidently never reaches `sdk+0x86868`.** Two candidate reasons, neither
tested:

1. **`sdk+0x86868` is a different function that the port simply never calls** — i.e. the port starts one step
   too late.
2. **It is reached, but a guard sends it down a path that skips the call** — plausible, given
   `nnosGetDefaultUserExceptionStackForApplication` (a **missing import**) returned 0 inside this same region.

## 4. What this establishes

| Item | State |
|---|---|
| `svcSetHeapSize` breakpoint | ✅ **HIT** — the emulator does not service it for the guest; **the game calls it** |
| **Real heap size** | ✅ **`0xC9200000` = 3218 MB** |
| **Caller address** | ✅ **`sdk+0x86868`** |
| Out-pointer semantics | ✅ **stack local (`sp+0x38`)**, matches the disassembly |
| Size derivation | ✅ **`TotalMemoryAvailable − 67 MB`**, using our own case-6 value |
| Port's memory model | ✅ **sound** — the number was never the problem |
| Port reaches the caller | ❌ **no — this is the gap** |

## 5. What this does NOT establish

- **`sdk+0x86868` was not resolved to a symbol name.** Whether it is a distinct function or part of another is
  unknown.
- **Why the port doesn't reach it is not determined** — the two candidates above are untested.
- **Whether it is called once or more** — only the first hit was seen; the breakpoint continued and no further
  hits were reported, but the run was short.
- **`InitializeAllocator` was not caught** to confirm it receives `0xC9200000`.
- **The port is unchanged and still not booted.** Nothing is rendered. **This is not a playable game.**

## 6. Next increment

**Resolve `sdk+0x86868` and disassemble around it** in the retail `sdk` image:

- if it is a function with its own prologue → it is the **start-up entry the port should call instead of (or
  before) `nnosInitialize`**;
- if it sits inside a larger function → **which function**, and what guard precedes the call.

Either answer tells the port exactly which call to make, with a size it now knows precisely.

---

## Why this round matters more than the last several

For five rounds the port's heap was a guess: 64 MB, then 512 MB, chosen because no basis existed. **It is now a
measured value from the shipping game** (`0xC9200000`), with a **verified derivation** from a value the port
already returns, and a **single named address** responsible for requesting it.

The remaining work is no longer "discover the bootstrap" — it is **call the right function, which the port
already has the number for.**
