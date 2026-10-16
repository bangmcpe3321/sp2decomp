# `sead::Heap` interface surface, from the vtable

`HEAP_LAYER_SCOPE.md` concluded the heap layer should be implemented **as an interface over
the host allocator** rather than by reconstructing `ExpHeap`'s free lists, and named
"enumerate the vtable" as step 1. This is that enumeration.

The vtable **is** the interface contract: the engine reaches a heap only through virtual
dispatch, so these are exactly the methods a host-backed heap must provide.

---

## A correction to `HEAP_LAYER_SCOPE.md`

That document said the two boot-path offsets were:

> `vptr+0x80  Heap::getFreeSize` and `vptr+0x28  Heap::destroy`

**The second is right; the first is wrong.** The actual entries are:

| Offset | Entry |
|---|---|
| `vptr+0x78` | `ExpHeap::getFreeSize()` |
| **`vptr+0x80`** | **`ExpHeap::getMaxAllocatableSize(int)`** |

The boot path calls `+0x80` while building each system-manager heap:

```c
lVar3 = (**(code **)(*(long *)pHVar5 + 0x80))(pHVar5, 8);
pHVar5 = ExpHeap::create(lVar3, {"sead::SystemManagers"}, ...);
```

so it is asking for the **max allocatable size** at 8-byte alignment, not the free size.
That distinction matters: a host-backed heap must implement `getMaxAllocatableSize(align)`
as its own method, not alias it to `getFreeSize()`.

## `sead::ExpHeap` vtable — 27 virtual functions

| vptr | Entry | Address |
|---:|---|---|
| +0x00 | `~ExpHeap()` (deleting) | `0x7100e76704` |
| +0x08 | `~ExpHeap()` | `0x7100e76740` |
| +0x10 | `checkDerivedRuntimeTypeInfo` | `0x7100e79958` |
| +0x18 | `getRuntimeTypeInfo` | `0x7100e79a24` |
| +0x20 | `destroy()` | `0x7100e76efc` |
| **+0x28** | **`adjust()`** | `0x7100e77308` |
| +0x30 | `tryAlloc(size, align)` | `0x7100e776c0` |
| +0x38 | `free(ptr)` | `0x7100e78334` |
| +0x40 | `resizeFront(ptr, size)` | `0x7100e786f4` |
| +0x48 | `resizeBack(ptr, size)` | `0x7100e78888` |
| +0x50 | `tryRealloc(ptr, size, align)` | `0x7100e789f4` |
| +0x58 | `freeAll()` | `0x7100e77208` |
| +0x60 | `getStartAddress()` | `0x7100e78c14` |
| +0x68 | `getEndAddress()` | `0x7100e78c1c` |
| +0x70 | `getSize()` | `0x7100e78c28` |
| +0x78 | `getFreeSize()` | `0x7100e78c30` |
| **+0x80** | **`getMaxAllocatableSize(align)`** | `0x7100e78cc4` |
| +0x88 | `isInclude(ptr)` | `0x7100e771d0` |
| +0x90 | `isEmpty()` | `0x7100e79930` |
| +0x98 | `isFreeable()` | `0x7100e79940` |
| +0xa0 | `isResizable()` | `0x7100e79948` |
| +0xa8 | `isAdjustable()` | `0x7100e79950` |
| +0xb0 | `dump()` | `0x7100e79820` |
| +0xb8 | `dumpYAML(WriteStream&, int)` | `0x7100e78f9c` |
| +0xc0 | `genInformation_(hostio::Context*)` | `0x7100e7992c` |
| +0xc8 | `Heap::makeMetaString_(...)` | `0x7100e7c378` |
| +0xd0 | `Heap::pushBackChild_(Heap*)` | `0x7100e7b450` |

**27 entries.** Entries +0xc8 and +0xd0 are inherited from `sead::Heap`, which confirms the
base and derived vtables line up — `ExpHeap`'s first four slots mirror `Heap`'s
(`~Heap` ×2, `checkDerivedRuntimeTypeInfo`, `getRuntimeTypeInfo`).

## What the host-backed heap must implement

**Everything from +0x20 to +0xb8** is the real interface. For the boot path specifically:

| Method | Needed for |
|---|---|
| `tryAlloc` / `free` / `freeAll` | the actual allocations |
| `getMaxAllocatableSize(align)` | **sizing each system-manager heap** (the `+0x80` call) |
| `getFreeSize` / `getSize` / `getStartAddress` / `getEndAddress` | heap accounting |
| `destroy` | tearing down per-manager heaps |
| `adjust` | boot path reaches it at `+0x28` |
| `resizeFront` / `resizeBack` / `tryRealloc` | reachable; needed for growth |
| `isInclude` / `isEmpty` / `isFreeable` / `isResizable` / `isAdjustable` | capability queries |

**`dump`, `dumpYAML` and `genInformation_` can be inert** — they are diagnostics, not boot
path. `dumpYAML` is precisely the "reads heap-internal state" case
`HEAP_LAYER_SCOPE.md` flagged as where the shortcut would break; nothing on the boot path
calls it, so it can be a stub while the rest is real.

## A vtable-format finding worth recording

These vtables begin with **two zero words**, not the GNU ABI's `offset-to-top` and
`typeinfo` pointers. The first reader of this script broke out of its loop on the first
zero and reported an **empty vtable for all three classes** — the same relative-vs-absolute
and format-assumption trap recorded earlier in this project. The zeros must be *skipped*,
not treated as the end.

Slots also hold **image-base-relative** values at rest (RELATIVE relocation addends), so a
stored `0xe77308` means `0x7100e77308`. Reading them as absolute yields small unnamed
numbers.

## Next increment

Implement `sead::Heap`'s interface (the table above) backed by the host allocator, then
`HeapMgr::initialize` / `createRootHeap_` / `setCurrentHeap_`, then `ExpHeap::create` as a
factory returning a host-backed heap — at which point `Framework::initialize` becomes
portable.

## Limits

- **`HeapMgr`'s vtable entries at +0x18..+0x50 are unnamed** (`0x7100e7d704` onward, 4-byte
  apart), so `HeapMgr`'s virtual surface is not identified — only `ExpHeap`/`Heap`'s is.
- **`sead::Heap`'s own vtable stops at +0x18** in this scan (four real entries), so the rest
  of its surface is defined by `ExpHeap`'s full listing rather than enumerated directly.
- **No code was ported.** The boot runner still stops at step 5.
