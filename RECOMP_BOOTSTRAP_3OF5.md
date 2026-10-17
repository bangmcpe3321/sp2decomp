# Three of five bootstrap steps now pass

The four-step bootstrap was implemented in the order read from `HeapMgr::initialize(size)`. **Steps 1–3 all
succeed.** The fault has moved to step 4.

---

## 1. The implementation

`bootstrap_engine_heap()` in `main.cpp` now performs, in order:

| Step | Call | Offset | Result |
|---|---|---|---|
| **1** | `CriticalSection::lock()` on `HeapMgr::sHeapTreeLockCS` (`main+0x3663f10`) | `0xe98bd8` | ✅ |
| **2** | `HeapMgr::sDefaultArena.initialize(size)` (`main+0x3663e98`) | `0xeb9f1c` | ✅ |
| **3** | `ExpHeap::tryCreate(buf, size, name, bool)` — **no-parent overload** | `0xe76b18` | ✅ **heap `0x5001000000`** |
| **4** | `HeapMgr::setCurrentHeap_(heap)` | `0xe7cfc0` | ❌ **fault `0x88`** |
| 5 | `CriticalSection::unlock()` | `0xe98be8` | not yet reached |

```
bootstrap: 1/5 locked sHeapTreeLockCS
bootstrap: 2/5 sDefaultArena.initialize(0xf000000)
bootstrap: 3/5 no-parent tryCreate -> heap 0x5001000000
=== HOST SIGSEGV ===  fault 0x88
```

**Three of five**, including the heap creation that every previous attempt failed to achieve.

## 2. Why step 4 fails — and it is diagnosable

The fault is at `0x88`, the **same offset** seen in the original `getCurrentHeap` crash. The adjacent statics
explain it:

| Address | What |
|---|---|
| `0x3663e70` | **`HeapMgr::sInstance` — a pointer** |
| `0x3663e98` | `HeapMgr::sDefaultArena` — **an object, only `0x28` later** |

So `setCurrentHeap_` is almost certainly `sInstance->mCurrentHeap = heap`, and **`sInstance` is still null** →
`*(0 + 0x88)`. **The lock and the arena do not create it.**

## 3. What this establishes

| Item | State |
|---|---|
| Step 1 `CriticalSection::lock()` | ✅ **works** |
| Step 2 `Arena::initialize(size)` | ✅ **works** |
| **Step 3 root heap via no-parent `tryCreate`** | ✅ **works — heap `0x5001000000`** |
| Step 4 `setCurrentHeap_` | ❌ **faults — `sInstance` is null** |
| Steps 1–3 in the correct order | ✅ **confirmed by execution** |
| Lock is legal before any heap exists | ✅ **confirmed in practice** |

## 4. What this does NOT establish

- **`HeapMgr::HeapMgr()` (`0xe7c4c0`) was not called**, so whether constructing `sInstance` is the right fix is
  untested.
- **`sInstance`'s expected size and where it should be allocated** are unknown.
- **Whether `setCurrentHeap_` requires anything else** — a lock being held (it is), or `initializeImpl_` having
  run (which faults) — is not determined.
- **Step 5 (`unlock`) was never reached**, so the lock is left held if the install path errors.
- **The 240 MB root-heap size and 16 MB offset remain arbitrary**, not derived.
- **The port is not booted.** Nothing is rendered. **This is not a playable game.**

## 5. Next increment

**Construct `HeapMgr` and set `sInstance`**, then retry step 4:

1. carve a small object from the heap buffer (`HeapMgr::HeapMgr()` at `0xe7c4c0`)
2. call it with `x0` = that object
3. store the result into `*(main.base + 0x3663e70)` — set `sInstance`
4. retry `setCurrentHeap_`

Three lines on top of what already works. **This is a short, concrete task, not a search.**
