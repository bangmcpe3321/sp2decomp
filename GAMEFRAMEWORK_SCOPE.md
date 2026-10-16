# Scoping `GameFramework`: is step 5 a wall or a tree?

`sead::GameFrameworkNx::initialize` (`0x7100e6724c`) is the next unported boot-root
dependency, and `ENGINE_RECONSTRUCTION.md` flagged it as a step change in difficulty
because its body only *forwards*:

```c
void sead::GameFrameworkNx::initialize(InitializeArg const& arg) {
    GameFramework::initialize(arg);      // 0x7100e69fe4, 456 bytes
    PerformanceMgrNx::initialize();      // 0x7100e68c44
}
```

This document answers whether that opens a wall or a manageable tree. **It is a tree, and
a shallow one** — but it is a tree, not a single function, and that distinction is the
useful finding.

---

## 1. `GameFramework::initialize` — 456 bytes, 6 specific calls

Reproduced faithfully, the body is **heap and system-manager construction**:

```c
void sead::GameFramework::initialize(const InitializeArg& arg) {
    Framework::initialize(arg);                                  // 0x7100e698ac

    Heap* root = <first root heap from PTR_sRootHeaps>;
    size_t sz = root->getFreeSize(root, 8);                      // vtable +0x80

    Heap* sys = ExpHeap::create(sz, {"sead::SystemManagers"}, root, 8, 1, 0);
    sz = sys->getFreeSize(sys, 8);
    Heap* res = ExpHeap::create(sz, {"sead::ResourceMgr"}, sys, 8, 1, 0);
    if (res) prev = HeapMgr::setCurrentHeap_(PTR_sInstancePtr, res);
    ResourceMgr::createInstance(res);
    res->destroy(res);                                           // vtable +0x28
    if (prev != 1) HeapMgr::setCurrentHeap_(PTR_sInstancePtr, prev);

    sz = sys->getFreeSize(sys, 8);
    Heap* fdev = ExpHeap::create(sz, {"sead::FileDeviceMgr"}, sys, 8, 1, 0);
    if (fdev) prev2 = HeapMgr::setCurrentHeap_(PTR_sInstancePtr, fdev);
    FileDeviceMgr::createInstance(fdev);
    fdev->destroy(fdev);
    if (prev2 != 1) HeapMgr::setCurrentHeap_(PTR_sInstancePtr, prev2);
    ...
}
```

**The pattern repeats.** Each system manager gets its own `ExpHeap`, is installed as the
current heap, has `createInstance` called, and the previous heap is restored — with
`SystemManagers`, `ResourceMgr` and `FileDeviceMgr` visible in the first 456 bytes and the
`...` indicating more of the same.

| Metric | Count |
|---|---:|
| Distinct direct callees | **6** |
| Vtable / indirect dispatch sites | **6** |
| Heap-virtual calls (`vptr + 0x80`) | **3** |

So the wall is not 456 bytes of unique logic — it is **one pattern applied per manager**.

## 2. `Framework::initialize` — 200 bytes, also bounded

```c
void sead::Framework::initialize(const InitializeArg& arg) {
    if (arg.arena == nullptr) HeapMgr::initialize(arg.heap_size);   // +0x00 / +0x08
    else                      HeapMgr::initialize(arg.arena);

    Heap* root = <first root heap>;
    Heap* th = ExpHeap::create(0, {"sead::ThreadMgr"}, root, 8, 1, 0);
    ThreadMgr::createInstance(th);
    ThreadMgr::initialize(PTR_sInstance_7102f9d280, th);
    th->destroy(th);
    GlobalRandom::createInstance(root);
}
```

Note it reads **`arg.heap_size` and `arg.arena`** — the two fields of `InitializeArg`, which
is already ported (`port/src/framework_args.cpp`, 48 MB and null). That is the first place
the ported argument struct is actually consumed.

## 3. The subtree, with addresses

| Function | Address | State |
|---|---|---|
| `sead::GameFrameworkNx::initialize` | `0x7100e6724c` | wrapper, 20 B |
| `sead::GameFramework::initialize` | `0x7100e69fe4` | **456 B** — the tree root |
| `sead::PerformanceMgrNx::initialize` | `0x7100e68c44` | sibling, small |
| `sead::Framework::initialize` | `0x7100e698ac` | **200 B** |
| `sead::HeapMgr::initialize` | — | not yet resolved |
| `sead::HeapMgr::setCurrentHeap_` | `0x7100e7cfc0` | |
| `sead::ExpHeap::create` | not resolved | referenced, needs lookup |
| `sead::ThreadMgr::createInstance` / `initialize` | — | not yet resolved |
| `sead::GlobalRandom::createInstance` | — | not yet resolved |
| `sead::ResourceMgr::createInstance` | `0x7100e8f150` | |
| `sead::FileDeviceMgr::createInstance` | `0x7100e64760` | |

**Depth is 3–4** (`GameFrameworkNx` → `GameFramework` → `Framework` → `HeapMgr`), and each
level reaches only a handful of functions.

## 4. What this changes in the plan

**The step change is real but bounded.** It is not one function and it is not a subsystem
of unknown size — it is a **shallow tree of small constructors and manager factories**
behind one repeated pattern.

That validates recording it as a step change rather than a wall, and it changes the porting
order: **`Framework::initialize` (`0x7100e698ac`, 200 bytes) is the tractable next port**,
not `GameFramework::initialize`. It is smaller, its callees are named, and it consumes the
already-ported `InitializeArg`.

## 5. What would make this go wrong

- **`ExpHeap` has no resolved address.** `Heap::CreateArg`, the root-heap globals and the
  heap vtable (`+0x80` free-size, `+0x28` destroy) all need establishing. The heap layer is
  the substrate this whole tree stands on, and it has not been scoped at all.
- **6 indirect dispatch sites.** Like the 10 in the boot root, their targets are not
  statically resolvable, so some of the real dependency set is invisible here.
- **`PTR_sRootHeaps` / `PTR_sInstance` are `.bss` globals** — no file bytes, the same
  limitation recorded for `sAssertEvent`, `MutexType` and the firmware's `sAssertEvent`.

**The heap layer is the genuine next unknown.** Before porting `Framework::initialize`, the
question worth answering is whether `HeapMgr`/`ExpHeap` is itself a shallow tree or the
first real wall — because every level of `GameFramework` depends on it.
