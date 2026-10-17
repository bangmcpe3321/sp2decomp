# `HeapMgr::initialize(size)` starts by taking a lock — not by allocating

Disassembled `HeapMgr::initialize(size_t)` (`0xe7c4e0`) to find what it does *before* touching the arena. The
answer is narrow and useful.

---

## 1. The sequence

```asm
main_00E7C4E0  (HeapMgr::initialize(size_t))
  +8..+88    register/stack housekeeping
  +95        mov (%rdi),%rax ; c.x[0] = size
  +105       load a vtable-ish pointer
  +135       call main_00E98BD8      <-- sead::CriticalSection::lock()
  +140..+197 ...loads, then:
  +207       call main_00EB9F1C      <-- sead::Arena::initialize(size_t)
  ...
```

**`main_00E98BD8` resolves to `sead::CriticalSection::lock()`**, confirmed against the symbol table — and it sits
in a run of lock/event functions:

```
0xe98b2c  CriticalSection::CriticalSection(Heap*, IDisposer::HeapNullOption)
0xe98bd8  CriticalSection::lock()
0xe98be0  CriticalSection::tryLock()
0xe98be8  CriticalSection::unlock()
0xe98bf0  Event::Event()
```

## 2. What that means

**`HeapMgr::initialize(size)` does, in order:**

1. **lock the heap-tree critical section**
2. `sDefaultArena.initialize(size)`
3. create the root heap
4. (unlock)

**Nothing is allocated before the lock.** `initializeImpl_()` — the call guessed at last round — is **not** part
of this path, which explains why calling it produced a fault at `(nil)`: it is a *different* entry with different
preconditions.

**So the "something first" the bootstrap needed is simply: take the lock.** Not allocate a manager object, not
build an arena — lock.

## 3. Why that matters for the circularity

The lock is `sead::CriticalSection`, which derives from `IDisposer` — the type whose constructor **faults on a
null heap**. That looked like a hard circle: *the lock needs a heap, the heap setup needs the lock.*

**But `idDisposer`'s constructor takes a `HeapNullOption` parameter** (`CriticalSection::CriticalSection(Heap*,
IDisposer::HeapNullOption)`). That parameter exists **precisely** so a `CriticalSection` can be constructed with a
null heap, before any heap exists.

**So the lock is constructible first, and the circle is broken by `HeapNullOption` — which is what the earlier
rounds suspected but could not confirm.** The ordering is: lock (null-heap-permitted) → arena → root heap →
install → unlock.

## 4. What this establishes

| Item | State |
|---|---|
| First action of `HeapMgr::initialize(size)` | ✅ **`CriticalSection::lock()`** |
| Its offset | ✅ `0xe98bd8` |
| Second action | ✅ **`Arena::initialize(size)`** at `0xeb9f1c` |
| `initializeImpl_()` in this path | ❌ **not called** — explains the `(nil)` fault |
| Lock constructible without a heap | ✅ **`HeapNullOption` exists for exactly this** |
| Lock/event API located | ✅ `0xe98b2c`, `0xe98bd8`, `0xe98be0`, `0xe98be8` |

## 5. What this does NOT establish

- **`setCurrentHeap_`'s `0x88` fault was not explained.** It may require the lock held; untested.
- **Whether the heap-tree `CriticalSection` static is already constructed** by `main`'s `init_array` was not
  verified — if it is, the lock can simply be taken.
- **The unlock step** was not located in the disassembly beyond `+296`.
- **The correct call sequence from the port was not written or tested** — this round identified the shape, not a
  working implementation.
- **The port is not booted.** Nothing is rendered. **This is not a playable game.**

## 6. Next increment

**Reproduce the four steps explicitly**, now that their shape is known:

1. `CriticalSection::lock()` on the heap-tree lock (offset `0xe98bd8`)
2. `Arena::initialize(size)` (offset `0xeb9f1c`)
3. root heap already creatable via the **no-parent `tryCreate`** (proven last round)
4. `setCurrentHeap_` — and if it still faults, `unlock` first and retry

**Two of the four steps are already known to work.** The new information is that the sequence begins with a
**lock**, not an allocation — and that the lock is legal to create with a null heap.
