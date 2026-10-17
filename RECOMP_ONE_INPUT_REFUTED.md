# The one-input hypothesis is wrong: the fault moves to `sead::Heap::Heap`

The diagnostic was run. Calling `HeapMgr::initialize(0x10000000)` ourselves moved the fault **deeper into
the heap bootstrap** rather than clearing it — which answers the strategic question: **this is a
framework-initialisation problem, not a missing number.**

---

## 1. What the diagnostic did

Inserted before the real `nnMain`:

```cpp
uint64_t hm = 0;
if (find_func_offset(nx_module_main, "_ZN4sead7HeapMgr10initializeEm", hm)) {
    c.x[0] = 0x10000000;                       // 256 MB of the 512 MB game heap
    call_preserving(c, nx_module_main.base + hm);
}
```

It ran — the log shows `DIAGNOSTIC: sead::HeapMgr::initialize(0x10000000) at main+e7c4e0` — and then:

| | Before | After |
|---|---|---|
| Faulting function | `sead::ExpHeap::tryCreate` | **`sead::Heap::Heap(SafeStringBase const&, Heap*, void*, size_t, HeapDirection, bool)`** |
| Fault address | `0x88` | **`0x10`** |

**The fault moved rather than disappeared.** `HeapMgr::initialize(size)` got *into* heap creation and then
failed a step further down.

## 2. What that means

`sead::HeapMgr::initialize(size_t)` constructs a root heap from a **default arena** — in this build,
`sead::HeapMgr::sArena` (`0x3663e90`) / `sDefaultArena` (`0x3663e98`). **That arena holds the buffer the heap
is carved from, and the port never initialises it**, so the `Heap` constructor is handed a null buffer/parent
and dereferences `+0x10`.

**So supplying a size is necessary but not sufficient.** The sead heap bootstrap is a **sequence**:

1. an `Arena` must be created over a real buffer,
2. `HeapMgr::initialize(Arena*)` (or an equivalent) must install it,
3. only then can `HeapMgr::initialize(size)`/`createRootHeap_` succeed.

**The port performs none of steps 1–2**, because they live in the SDK/engine start-up that entering at
`nnosInitialize` → `nnMain` bypasses.

## 3. The strategic answer

| Question | Answer |
|---|---|
| Is this a one-input problem? | ❌ **no** |
| Is it a framework-initialisation problem? | ✅ **yes — a multi-step heap bootstrap the port skips** |

**That is the useful result.** Had the fault cleared, the remaining work would have been "supply the right
number". It did not clear, and the shape of the remaining work is now known to be larger and different.

## 4. What this establishes

| Item | State |
|---|---|
| `HeapMgr::initialize(size)` callable from the port | ✅ yes, runs |
| Fault cleared by supplying a size | ❌ **no** |
| Fault moved | ✅ **to `sead::Heap::Heap(...)` at `0x10`** |
| Root cause of *that* fault | 🟡 **null arena/buffer — leading, not proven** |
| Nature of the remaining problem | ✅ **multi-step framework bootstrap** |

## 5. What this does NOT establish

- **The null arena reading is not proven.** The `Heap` constructor's arguments were not read at the fault;
  `0x10` could be a different field of a different null object.
- **`HeapMgr::initialize(Arena*)` was not tried** — the next step in the sequence, and the obvious experiment.
- **The `sead::Arena` API was not located** in the symbol table.
- **The diagnostic is currently unconditional**: `main.cpp` calls `HeapMgr::initialize(0x10000000)` before every
  `nnMain`. **It is a diagnostic, not a fix**, and it changes the observed failure from the true one to a
  deeper one. **It should be gated or removed before any further "how far does it get" measurement.**
- **The game is not booted.** Nothing is rendered. No NVN, no window, no shaders.
- **This is not a playable game.**

## 6. Where this leaves the project

The chain is now fully mapped and ends in a **known-missing multi-step bootstrap**:

```
nnMain
  -> Lp::Sys::SysInit::Init
    -> sead::GameFrameworkNx::initialize
      -> sead::GameFramework::initialize
        -> sead::Framework::initialize
          -> arg sizes are 0  (who fills them: unknown)
          -> sead::HeapMgr::initialize(0)
            -> no arena installed  (step 1-2 never happen)
              -> sead::Heap::Heap(null buffer) -> fault
```

**Every link is named. None of the missing inputs has been located.** Supplying them means reproducing sead's
engine bootstrap, which on hardware runs as part of SDK start-up that this port does not perform.

## 7. Next increment

**Locate the `sead::Arena` API** (`Arena::initialize`, `Arena::sInstance`) and determine whether an arena can
be constructed over the game heap and installed before `nnMain`. That is the next link in the sequence, and
it is the same kind of measurement that has worked: find the function, break on it, see whether it is called.

If the arena cannot be bootstrapped without further missing state, then the honest conclusion is that this
port needs the **SDK/engine start-up path** rather than more individual patches — a substantially larger piece
of work than anything attempted so far.
