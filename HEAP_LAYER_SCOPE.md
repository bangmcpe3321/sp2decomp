# Scoping the heap layer: is `HeapMgr`/`ExpHeap` a wall?

`GAMEFRAMEWORK_SCOPE.md` ended on this question, because every level of `GameFramework`
stands on the heap layer. This answers it.

**Verdict: tractable as an interface, but the real allocator is a wall — and the way around
it is to impement the sead API over the host allocator rather than reconstruct
`ExpHeap`'s free lists.**

---

## 1. A significant discovery: two heap namespaces

The heap classes exist **twice** in the binary:

| Namespace | `HeapMgr` | `ExpHeap` | Boot path? |
|---|---:|---:|---|
| `pead::` | 13 | 31 | these are the addresses `inventory.txt` lists for the pead manglings |
| `sead::` | present | present | **this is what the boot path calls** |

`GAMEFRAMEWORK_SCOPE.md` recorded `pead::HeapMgr` addresses from an inventory grep while
the decompiled `GameFramework::initialize` body calls **`sead::HeapMgr`** and
**`sead::ExpHeap`** (`ExpHeap::create(sz, {"sead::SystemManagers"}, ...)`).

**So any porting must target `sead::`, and the `pead::` set must not be confused for it.**
An earlier scoping script searched only `_ZN4sead` and silently returned nothing because the
grep had matched `_ZN4pead`; that mistake is why this section exists. Two same-named
hierarchies in one binary is exactly the kind of thing that produces a wrong port.

## 2. Sizes

| Class | Functions |
|---|---:|
| `pead::HeapMgr` | 13 |
| `pead::ExpHeap` | 31 |
| `pead::Heap` (base) | 11 |
| `pead::Arena` | 1 |
| **total** | **56** |

`ExpHeap`'s 31 split into roughly **21 interface-shaped** methods and **10 internal
block-management helpers**:

```
interface-like:  create, tryCreate, doCreate, destroy, freeAll, adjust, adjustBack_,
                 adjustFront_, tryAlloc, free, resizeFront, resizeBack, realloc_,
                 tryRealloc, getAllocatedSize, getManagementAreaSize, setAllocMode
algorithm (_-suffixed): createMaxSizeFreeMemBlock_, pushToFreeList_,
                 findLastMemBlockIfFree_, findFirstMemBlockIfFree_,
                 allocFromHead_ (x2), allocFromTail_ (x2), pushToUseList_
```

## 3. What the boot path actually needs

From `Framework::initialize` and `GameFramework::initialize`:

| Function | Address (`pead::` equivalent) | Role |
|---|---|---|
| `HeapMgr::initialize(u64)` | `0x7100c9419c` | boot entry, size form |
| `HeapMgr::initialize(Arena*)` | `0x7100c941b8` | boot entry, arena form |
| `HeapMgr::initializeImpl_` | `0x7100c94258` | shared body |
| `HeapMgr::createRootHeap_` | `0x7100c942f4` | creates the root heap |
| `HeapMgr::setCurrentHeap_` | `0x7100c94aec` | used at every manager |
| `ExpHeap::create` | `0x7100c8f6c8` | one per system manager |
| `Heap::getFreeSize` (`vptr+0x80`) | — | size the next heap |
| `Heap::destroy` (`vptr+0x28`) | — | tear down per-manager heaps |

That is **~8 functions** for the boot path — not 56.

## 4. The wall, and the way around it

**The wall:** `ExpHeap` is a genuine allocator. `allocFromHead_`/`allocFromTail_`,
`pushToFreeList_`, `findFirstMemBlockIfFree_` and friends are a real free-list
implementation with block splitting and `adjust`/`adjustBack_`/`adjustFront_` coalescing.
Reconstructing that faithfully is a substantial piece of work on its own.

**The way around it, which is what the port should do:** implement the **sead heap API over
the host allocator**. The engine reaches a heap through its **virtual interface**
(`vptr+0x80` for free size, `+0x28` for destroy, plus `alloc`/`free`/`resize`), so a host-
backed `Heap` that satisfies the interface is sufficient — the game does not depend on
`ExpHeap`'s *internal* block layout, only on the interface and its accounting.

This converts the gate from "reimplement a 31-method allocator" into **"implement the `Heap`
interface surface"**, which is exactly how the platform layer was built
(`port/src/os.cpp` implements `nn::os` over host primitives rather than reimplementing
Horizon).

**What would make the shortcut wrong:** anything that reads heap-internal state — walking
`MemBlock`s, `dumpTreeYAML`, or reasoning about fragmentation or exact addresses. Nothing
observed on the boot path does. If a later stage does, that is the point at which a real
`ExpHeap` becomes necessary.

## 5. Revised plan

1. **Port the `sead::Heap` interface** (the vtable surface the engine dispatches through)
   backed by the host allocator — the same strategy as the platform layer.
2. **Port `sead::HeapMgr::initialize` / `createRootHeap_` / `setCurrentHeap_`** — 3
   functions, all small, and the actual boot entry points.
3. **Implement `sead::ExpHeap::create` as a factory returning a host-backed heap.** This is
   the one place where faithfulness is traded for tractability, and it is recorded as such.
4. Only then return to `Framework::initialize` (§2 of `GAMEFRAMEWORK_SCOPE.md`), which
   consumes `InitializeArg` and creates the `ThreadMgr` heap.

## 6. Honest limits

- **The two-namespace finding needs reverifying before porting.** This document infers that
  `sead::` is the boot-path hierarchy from the decompiled call sites; the `pead::` set was
  what an inventory grep surfaced. The `sead::` addresses were not enumerated here.
- **`Heap`'s vtable offsets are taken from the decompile** (`+0x80`, `+0x28`) rather than from a full vtable dump, so the interface surface is only partly
  known. Enumerating it is the first task of step 1 above.
- **`MemBlock` has zero matches** in this inventory scan, so the block type `ExpHeap`
  manipulates was not located.
- **No code was ported in this round.** The boot runner still stops at step 5.
