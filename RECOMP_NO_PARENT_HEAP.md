# The circle-breaker exists: `ExpHeap::tryCreate` has a no-parent overload

The engine start-up was implemented as properly as the evidence allows. **It produced the first working heap
creation this project has had** — and revealed the next layer of the circularity.

---

## 1. The discovery

`sead::ExpHeap` has **three** `tryCreate` overloads, and the project had been using the wrong one:

| Overload | Symbol | Result |
|---|---|---|
| `(size, name, Heap* parent, int, HeapDirection, bool)` | `…tryCreateEmRKNS_…EPNS_4HeapEiNS5_13HeapDirectionEb` | **faults** at `+0x44` (the engine's own path) |
| `(void* buf, size_t, name, Heap* parent, bool)` | `…tryCreateEPvmRKNS_…EPNS_4HeapEb` | **returns null** (rejects a null parent) |
| **`(void* buf, size_t, name, bool)`** | **`…tryCreateEPvmRKNS_…Eb`** | ✅ **WORKS** |

**The 4-argument overload has no parent parameter at all** — it exists precisely so the *first* heap can be
created when there is nothing to parent it to. **This is the non-circular primitive the bootstrap needed.**

```
bootstrap: ExpHeap::tryCreate(buf=5001000000, size=0xf000000, NO-PARENT overload) at main+e76b18
bootstrap: root heap = 0x5001000000
```

**`0x5001000000` is the first heap this port has ever successfully created.** Every earlier attempt returned
null or faulted.

## 2. The next layer of circularity

With a real heap in hand, two calls were tried to install it, and both fault:

| Call | Offset | Result |
|---|---|---|
| `HeapMgr::setCurrentHeap_(heap)` | `0xe7cfc0` | fault, `0x88` |
| `HeapMgr::initializeImpl_()` (added before it) | `0xe7c5e4` | fault at **`(nil)`** |

**Both need `HeapMgr::sInstance` to exist, and it does not.** So the ordering problem recurses one level:

> a root heap exists, but the **heap manager object that would own it** does not.

`HeapMgr::initialize(size)` is the call that creates that state — **and it is the one that needs the arena**,
which is the dead end from earlier rounds.

## 3. A correction worth recording

At one point `lr = 0x6f000005a0 (hle:__process_return)` looked like evidence of a bad return address. **It is
not** — that is the trampoline `call_preserving` installs, so it simply marks "the fault happened inside this
call". Reading it as evidence was a mistake, and it is noted so it is not repeated.

## 4. What this establishes

| Item | State |
|---|---|
| **`tryCreate(buf, size, name, bool)` exists and works** | ✅ **root heap created, non-null** |
| The 5-arg overload rejects a null parent | ✅ confirmed |
| The engine's own `tryCreate(size, …, parent)` path fails | ✅ confirmed |
| `setCurrentHeap_` alone is sufficient | ❌ **faults — needs `sInstance`** |
| `initializeImpl_()` first is sufficient | ❌ **faults at `(nil)` — also needs `sInstance`** |
| Bootstrap complete | ❌ **no — one layer deeper** |

## 5. What this does NOT establish

- **What `HeapMgr::initializeImpl_()` dereferences at `(nil)`** was not identified — it may need `sInstance`
  allocated, or a lock, or an arena.
- **How `sInstance` is meant to be created** was not determined. `HeapMgr::initialize(size)` does it, but needs
  the arena; nothing else in the API does.
- **Whether the root heap address is correct** — it equals the buffer we passed, which is expected, but nothing
  has yet *used* it successfully.
- **The 240 MB root-heap size and the 16 MB offset** remain arbitrary choices.
- **The port is not booted.** Nothing is rendered. **This is not a playable game.**

## 6. Next increment

**Find what creates `HeapMgr::sInstance`.** It is a static at `0x3663e70`. Two routes:

1. **Disassemble `HeapMgr::initialize(size)`** (`0xe7c4e0`) — it must construct `sInstance` and the arena before
   `createRootHeap_`. Whatever it does *first* (before touching the arena) is what needs reproducing.
2. **Allocate `sInstance` from the root heap we now have**, then call `initializeImpl_()`. If `sInstance` is a
   plain object the manager allocates from its own heap, this closes the loop.

**Route 1 is the principled one and it is a static read.** The no-parent heap has removed one layer of the
circle; route 1 shows how to remove the next.
