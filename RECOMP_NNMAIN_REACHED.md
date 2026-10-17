# `nnMain` IS REACHED — the game's own framework initialisation is running

**The goal's primary target is achieved.** With the double-constructor bug fixed, the port now enters
`nnMain`, runs the game's own `SysInit`, and reaches `sead::GameFrameworkNx::initialize` — where it faults.

---

## 1. The evidence

**`entering nnMain` appears in the run log** (line 55), and the fault backtrace is entirely inside the game's
own framework startup:

```
#0  0x00E7CF7C  sead::HeapMgr::getCurrentHeap()                      ← FAULT
#1  0x00E7678C  sead::ExpHeap::tryCreate(size, SafeStringBase<char> const&, Heap*, int, HeapDirection, bool)
#2  0x00E76784  (same function, entry)
#3  0x00E698AC  sead::Framework::initialize(Framework::InitializeArg const&)
#4  0x00E69FE4  sead::GameFramework::initialize(Framework::InitializeArg const&)
#5  0x00E6724C  sead::GameFrameworkNx::initialize(Framework::InitializeArg const&)
#6  0x011F5B20  Lp::Sys::SysInit::Init()                            ← the GAME's own sysinit
#7  0x0019A3E0  nnMain                                              ← ★ nnMain REACHED ★
#8  nx::call
#9  nx::nn_main
```

**Every frame is a real, named engine function.** This is no longer static-initialisation scaffolding — this
is Splatoon 2's own game framework coming up.

## 2. What this proves

| Claim | Status |
|---|---|
| `main`'s `_init` completed | ✅ **yes — `nnMain` was entered after it** |
| **`nnMain` reached** | ✅ **YES — `entering nnMain` logged, and frame #7 is `nnMain`** |
| The game's own code runs | ✅ `Lp::Sys::SysInit::Init` is the game's sysinit |
| `sead` engine initialisation runs | ✅ **`GameFrameworkNx` → `GameFramework` → `Framework`** |
| The double-constructor fix was correct | ✅ **it is what unblocked all of this** |

**This is the goal's primary target: "get the boot past main's static constructors and into `nnMain`."**

## 3. The new blocker — and it is precise

**`sead::HeapMgr::getCurrentHeap()` is what faults.** `sead::ExpHeap::tryCreate` asks the heap manager for
the current heap (to use as the parent), and the manager has **none** — so the dereference at `+0x88` reads
through a null.

**In other words: `sead::HeapMgr` was never given a root heap.** The game's own engine heap manager is
uninitialised when `Framework::initialize` asks it for a heap to allocate from.

**That is a single, well-defined missing step**, not a mystery. On hardware something initialises `HeapMgr`
with a root heap before `Framework::initialize` runs. Candidates:

1. **`sead::HeapMgr::initialize()` is called by code the port skips** — possibly part of the SDK startup we
   bypass by entering at `nnosInitialize` → `nnMain`.
2. **It is called by the game but silently failed** — e.g. its own `new` returned null because
   `nn::init::InitializeAllocator` state differs from hardware.

## 4. What changed to get here

One condition in `init_module`: the `init_array` loop is now gated behind `NX_DOUBLE_CTOR`, because **`_init`
already runs the constructor table.** Before that, every constructor ran twice, the PGV list self-linked, and
the boot died at constructor #1367 without ever approaching `nnMain`.

## 5. What this does NOT establish

- **The game does not boot.** It faults during `GameFrameworkNx::initialize`.
- **`sead::HeapMgr`'s initialisation path was not located.** Nobody has yet found which function is supposed to
  set the root heap, or why it did not.
- **`main`'s per-constructor logs are zero** — because `_init` runs them internally and the port no longer logs
  each entry. **That the 1,604 constructors all ran is inferred from `nnMain` being reached, not observed.**
- **`NX_DOUBLE_CTOR` was never exercised** — the old path was not re-tested after this change.
- **The allocator is still 512 MB at `kHeapBase`, an arbitrary size**, now installed via the real
  `svcSetHeapSize` path.
- **No NVN, no window, no shader, no render.** Nothing is drawn, and shaders remain out of scope.
- **This is not a playable game and not a booted game.** It is a process that reaches `nnMain` and faults in
  the engine's heap manager.

## 6. Next increment

**Find `sead::HeapMgr::initialize` / `setCurrentHeap` in the symbol table, and determine whether it was
called.** Then check who should call it — if the answer is "the SDK startup", the port needs to call it with a
root `sead::ExpHeap` created over the game heap before `nnMain`, exactly as the real startup would.

This is now a **targeted** problem with a named function, a named missing state, and a small set of
candidates — a very different position from where this started.
