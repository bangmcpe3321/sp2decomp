# The blocker after `nnMain`: `sead::HeapMgr::initialize(0)`

With `nnMain` reached, the next fault is `sead::HeapMgr::getCurrentHeap()` in `Framework::initialize`. The
cause is now identified: **the engine's heap manager is initialised with a size of zero**, so it never
creates a root heap.

---

## 1. The faulting pointer is the instance

The crash had `x0 = x19 = 0x7103663e70`. Resolving `main`'s symbols:

```
sead::HeapMgr::sInstance      0x3663e70     <- exactly the faulting pointer
sead::HeapMgr::sArena         0x3663e90
sead::HeapMgr::sRootHeaps     0x3663eb0
sead::HeapMgr::sIndependentHeaps 0x3663ee0
```

**So the null-ish dereference is `HeapMgr::sInstance` — the engine heap manager itself.**

## 2. The API, located

| Function | Offset |
|---|---|
| `HeapMgr::initialize(size_t)` | `0xe7c4e0` |
| `HeapMgr::initialize(Arena*)` | `0xe7c6b8` |
| `HeapMgr::initializeImpl_()` | `0xe7c5e4` |
| `HeapMgr::createRootHeap_()` | `0xe7c790` |
| `HeapMgr::setCurrentHeap_(Heap*)` | `0xe7cfc0` |
| `HeapMgr::getCurrentHeap()` | `0xe7cf7c` ← faults |

## 3. The decisive measurement

Breakpoints on all three initialisation entry points across a full run:

```
HeapMgr::initialize(size=0x0)     hit #1        <-- CALLED, WITH SIZE ZERO
HeapMgr::initialize(Arena*)       0 hits
HeapMgr::createRootHeap_          0 hits        <-- NEVER CREATED
```

**The game *does* call `HeapMgr::initialize` — but passes `0`.** And because the size is zero,
**`createRootHeap_` is never reached**, so `sRootHeaps`/`sCurrentHeap` stay empty, and the first
`getCurrentHeap()` in `Framework::initialize` dereferences a manager with no heap.

**That is the whole fault.**

## 4. Where the zero most likely comes from

The size passed to `HeapMgr::initialize` is presumably derived from a **memory query**. The run's SVC trace
showed:

```
svc 0x29  (GetInfo)  8 calls
```

`svcGetInfo` is exactly where a title asks how much memory it has. **If those queries return zero, the
computed heap size is zero, and `HeapMgr::initialize(0)` follows.**

`kernel.cpp` dispatches `GetInfo` to a `get_info(type, handle, sub, rc)` helper whose **definition was not
located in `kernel.cpp`** — it lives elsewhere in the runtime. **Its behaviour for the memory-info types was
not inspected.**

**This is the leading hypothesis and it is untested.**

## 5. What this establishes

| Item | State |
|---|---|
| Faulting pointer identity | ✅ **`HeapMgr::sInstance`** |
| `HeapMgr::initialize` called by the game | ✅ **yes, once** |
| **Size passed** | ✅ **`0x0`** |
| `createRootHeap_` ever called | ❌ **never** |
| `initialize(Arena*)` ever called | ❌ **no** |
| Consequence | ✅ **no root heap → `getCurrentHeap()` faults** |
| Why the size is zero | 🟡 **memory query returning 0 — leading, untested** |

## 6. What this does NOT establish

- **Where the size comes from is not determined.** `get_info`'s definition was not found and its
  memory-info behaviour was not read.
- **The eight `svc 0x29` calls were not individually inspected** — their types and return values are unknown.
- **Calling `HeapMgr::initialize` ourselves with a non-zero size was not attempted.** That is the obvious
  next experiment and it has not been run.
- **The game is not booted** — it faults in `GameFrameworkNx::initialize`.
- **Nothing is rendered.** No NVN, no window, no shaders. **This is not a playable game.**

## 7. Next increment

**Call `sead::HeapMgr::initialize(size)` ourselves, with a non-zero size, before `nnMain`** — after the
allocator is installed, since the root heap is carved from it. `main.base + 0xe7c4e0`, `x0 = size`.

If the fault disappears and the framework initialises further, that confirms the diagnosis and makes the
*correct* fix obvious: make the memory query that feeds the size return real values. If it does not, the
zero came from somewhere else and the search moves to the caller of `HeapMgr::initialize`.

**This is a one-line experiment with a decisive outcome either way.**
