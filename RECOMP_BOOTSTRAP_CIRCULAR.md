# The circular dependency: `IDisposer(heap=null)` — and why patching cannot break it

The arena was chased. The result is the clearest statement yet of **why this cannot be fixed one patch at a
time**.

---

## 1. What was found

| Measurement | Result |
|---|---|
| `sead::Arena::Arena()` called? | ✅ **yes — once**, on `this = 0x7103663e98` = **`HeapMgr::sDefaultArena`** |
| Its caller | `main_00E7D068` ← `main_00000024` (`_init`) — **a normal static constructor** |
| `sead::Arena::initialize(size)` called? | ✅ yes — **by `HeapMgr::initialize(size)`**, with our diagnostic's `0x10000000` |
| New fault after that | **`sead::IDisposer::IDisposer(Heap*, HeapNullOption)`** at `0xe76550` |

## 2. What the new fault means

`sead::IDisposer` is the **base class of almost every sead object**, and its constructor takes a `Heap*` plus
a `HeapNullOption`. It registers the object with that heap.

The fault occurs immediately after, while constructing an `ExpHeap`
(`ExpHeap::ExpHeap(SafeStringBase const&, Heap*, void*, size_t, ...)` at `0xe76670`).

**So the engine is trying to create a heap, whose `IDisposer` base needs a heap — and there isn't one.**

**That is a genuine circular dependency:**

> to create the first heap, you need a heap.

## 3. Why this cannot be patched

On hardware the circle is broken by **SDK/engine start-up**, which:

1. obtains the process memory via `svcSetHeapSize`,
2. places a **static/system arena** over it,
3. creates the **first** `ExpHeap` with a **null parent** (which `HeapNullOption` exists precisely to permit),
4. installs it as `HeapMgr`'s root, and only then
5. runs `nnMain`, where `SysInit` and `Framework::initialize` can call `getCurrentHeap()` and get something.

**This port does none of steps 1–4.** It jumps to `nnosInitialize` → `nnMain`. Every missing value found so
far is a symptom of that one omission:

| Missing input | Why it is missing |
|---|---|
| `InitializeArg` size fields = 0 | filled by start-up code the port skips |
| `HeapMgr::initialize(0)` | the size comes from that same start-up state |
| `sDefaultArena` has no buffer | the arena is meant to be placed over process memory by start-up |
| `IDisposer(heap = null)` | no root heap exists because the bootstrap never ran |

**Each of these is a leaf. Cutting leaves does not grow the tree.**

## 4. The honest verdict

**This is no longer a bug to be found. It is a missing phase of the process lifecycle.**

The correct next step is not another measurement — it is to **implement the engine bootstrap**: allocate the
process heap, place a static `sead::Arena` over it, create the first `ExpHeap` with a null parent, and install
it via `HeapMgr` before `nnMain`. That is a **design task of real size**, not an observation.

**And even that would not produce a running game.** Beyond it remain the entire NVN surface — never exercised
once in this project — and Splatoon 2's Maxwell shaders, which have been out of scope throughout.

## 5. What this establishes

| Item | State |
|---|---|
| `sDefaultArena` is constructed | ✅ **yes, as a normal static** |
| `Arena::initialize(size)` is invoked | ✅ by `HeapMgr::initialize(size)` |
| A size is now supplied | ✅ `0x10000000` (diagnostic) |
| Fault cleared | ❌ **no — moved to `IDisposer(heap=null)`** |
| Root cause | ✅ **circular: a heap is needed to create the first heap** |
| Fixable by further patching | ❌ **no — it needs the bootstrap phase** |

## 6. What this does NOT establish

- **That the bootstrap as described is exactly what Splatoon 2's start-up does.** It is the standard
  NintendoSDK/sead sequence and it explains every observation, but **this game's start-up function was never
  located or read.**
- **Whether a root `ExpHeap` with a null parent would satisfy `Framework::initialize`.** Not tested.
- **That `Arena::initialize(size)` does not allocate a buffer internally.** Not disassembled.
- **The game is not booted.** Nothing is rendered. No NVN, no window, no shaders.
- **This is not a playable game, and this work has not made it one.**

## 7. Recommended next step — and it is a decision, not a measurement

**Stop measuring; decide.** Three honest options:

1. **Implement the engine bootstrap** (allocate process heap → static arena → first `ExpHeap` with null parent
   → install as `HeapMgr` root → then `nnMain`). Sizeable, and unblocks only the *next* layer.
2. **Port a title whose start-up this runtime already performs** — i.e. one whose SDK generation matches what
   the MIT runtime was written for. **Materially cheaper, materially more likely to produce a running game.**
3. **Stop, and keep this as documentation.** The repository now contains a fully-named map from `nnMain` to a
   circular bootstrap dependency, a six-entry silent-mismatch ledger, and two toolchain traps that transfer to
   any title.

**The experimental method has been exhausted.** Every further round of measurement will produce another named
leaf on the same tree. What remains is a build task, and it should be chosen deliberately rather than
discovered one fault at a time.
