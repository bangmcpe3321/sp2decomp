# `system_resource_size` is ruled out — the zero comes from elsewhere

The obvious suspect for `HeapMgr::initialize(0)` was `game::kInfo.system_resource_size`, which sits at `0x0`
in `game_sp2.cpp` and is returned verbatim by `svcGetInfo` type 16. **Logging every `svcGetInfo` call shows the
game never asks for type 16.** That suspect is eliminated.

---

## 1. Every `svcGetInfo` call in the run

The log instrumentation (added to `get_info`, `svc_process.cpp`) captured **ten** calls — the whole set for a
full run to the fault:

| Type | Sub | `get_info` returns |
|---:|---:|---|
| 11 | `0x2` | `RandomEntropy` (`0x1234567890ABCDEF ^ sub`) |
| 11 | `0x3` | same |
| 12 | `0x0` | `kAddressSpaceBase` |
| 12 | `0x0` | same |
| 13 | `0x0` | `kAddressSpaceSize` |
| 14 | `0x0` | `kStackBase` |
| 14 | `0x0` | same |
| 15 | `0x0` | `kStackSize` |
| **7** | `0x0` | `heap_size() + 0x4000000` |
| **6** | `0x0` | `0xCD500000` |

**No type 16. No type 4. No type 5.** The `system_resource_size` theory is dead.

## 2. What the game actually asks for

The pattern — **address-space base/size (12/13), stack base/size (14/15), then heap size (7) and total memory
(6)** — is the shape of a **memory-layout probe**, which is what `sead` does when it is working out where it
may allocate. It is not a straightforward "how big should my root heap be" query.

**So the zero passed to `HeapMgr::initialize` is computed from these values, or from something else entirely** —
and which, is not yet known.

## 3. Why the obvious fix would have been wrong

Had I "fixed" this by setting `system_resource_size` to a large number, **nothing would have changed** — the
game never reads type 16. Writing that value in would have been a plausible-looking edit that silently did
nothing, and the next round would have been spent wondering why.

**The measurement cost one rebuild; the guess would have cost a round.**

## 4. What this establishes

| Item | State |
|---|---|
| `svcGetInfo` fully logged | ✅ **10 calls, all types captured** |
| Type 16 (`SystemResourceSizeTotal`) queried | ❌ **never** |
| `system_resource_size` as the cause | ❌ **ELIMINATED** |
| Type 7 (`heap_size() + 0x4000000`) queried | ✅ yes — **returns ~0x24000000, not zero** |
| Type 6 (`TotalMemoryAvailable`) queried | ✅ yes — returns `0xCD500000` |
| Type 4 / 5 (heap base / max) queried | ❌ never |
| Source of the zero | ❌ **still unknown** |

## 5. What this does NOT establish

- **Where `HeapMgr::initialize`'s zero comes from is not determined.** It is not any of the ten queried
  `svcGetInfo` types as far as this evidence goes, but the *computation* those feed was not traced.
- **The caller of `HeapMgr::initialize` was not identified.** Finding it — one breakpoint with a host
  backtrace — would show exactly which value it loads before the call, and that is the direct answer.
- **`HeapMgr::initialize` with a non-zero size was not called** to test whether it fixes the fault.
- **The game is not booted** — it faults in `GameFrameworkNx::initialize`.
- **Nothing is rendered.** No NVN, no window, no shaders. **This is not a playable game.**

## 6. Next increment

**Break on `HeapMgr::initialize` and take a host backtrace, then read the caller's argument.** The size is in
`x0` at entry and is zero; the caller just computed it. Disassembling the few instructions before the call
site shows which register it came from and which load produced it — that is the missing link, and it is one
attach away.

This is more direct than continuing to theorise about which memory value feeds it.
