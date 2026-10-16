# Scoping the graphics subsystem

The boot runner stops at `sead::GameFrameworkNx::initializeGraphicsSystem`
(`0x7100e6738c`). Every dependency before it was heap, task or timing plumbing, which the port
now satisfies. This document answers what the graphics subsystem actually requires — the same
scope-before-porting pass that preceded the heap work.

**Headline: the platform boundary is small and precisely enumerable. The engine-side graphics
code is large and partly reference-free.**

---

## 1. The entry point

`initializeGraphicsSystem` is **2,372 bytes**. Its profile:

| Metric | Count |
|---|---:|
| Distinct named callees | **24** |
| Indirect dispatch sites | **46** |
| Local (unnamed) function addresses | 6 |
| Named `.data`/`.bss` globals referenced | 0 |

The 46 indirect sites are the important number: like the 10 in the boot root, they are not
statically resolvable, so **some of the real dependency set is invisible here.** That is a
recording of a limit, not an estimate.

## 2. The call chain, recovered

```
sead::GameFrameworkNx::initializeGraphicsSystem(Heap*, const Vector2<float>&)
  |
  +-- nv::SetGraphicsAllocator(3 callbacks, nullptr)          <- the port's allocator hook
  +-- heap->tryAlloc(..., *(u32*)(this + 0xcc), 0x1000)       <- vtable dispatch
  +-- nv::InitializeGraphics
  +-- nn::mem::StandardAllocator::StandardAllocator
  +-- nn::vi::Initialize
  +-- nn::vi::OpenDefaultDisplay
  +-- nn::vi::CreateLayer
  +-- nn::vi::SetLayerScalingMode
  +-- nn::vi::GetDisplayVsyncEvent
  +-- nvnLoadCProcs                                            <- the NVN table
  +-- GraphicsNvn::convertNvnDebugLevel
  +-- GraphicsNvn::GraphicsNvn
  +-- Graphics::initialize
  +-- GraphicsNvn::registerQueue
  +-- DisplayBufferNvn::DisplayBufferNvn
  +-- nn::vi::GetNativeWindow
  +-- GraphicsNvn::registerDisplayBufferNvn
  +-- ThreadUtil::ConvertPrioritySeadToPlatform
  +-- Thread::setAffinity
  +-- __cxa_guard_acquire / __cxa_guard_release (function-local statics)
  +-- operator new / operator_new
```

Two things are immediately visible:

- **The `nn::vi` surface is six functions.** `Initialize`, `OpenDefaultDisplay`, `CreateLayer`,
  `SetLayerScalingMode`, `GetDisplayVsyncEvent`, `GetNativeWindow`. That is the entire display
  boundary for this call — not "the Switch display API", six calls.
- **`nvnLoadCProcs` appears here**, confirming `GRAPHICS_NVN.md` §2 from the call site itself:
  the NVN entry point is the loader, and everything after it goes through the returned table.

## 3. The platform boundary: six `nn::vi` functions — verified

Searching the binary for `nn::vi` **functions** finds exactly 12 symbols, which are **6 unique
functions** appearing twice each (a local thunk in `.plt` at `0x7101413xxx` and an imported
symbol at `0x710386x000`):

| Function | Import (EXTERNAL) |
|---|---|
| `nn::vi::Initialize()` | `0x710386c000` |
| `nn::vi::CreateLayer(Layer**, Display*)` | `0x710386d000` |
| `nn::vi::GetNativeWindow(void**, Layer*)` | `0x710386e000` |
| `nn::vi::OpenDefaultDisplay(Display**)` | `0x710386f000` |
| `nn::vi::SetLayerScalingMode(Layer*, ScalingMode)` | `0x7103870000` |
| `nn::vi::GetDisplayVsyncEvent(os::SystemEventType*, Display*)` | `0x7103871000` |

All six carry `EXTERNAL:` symbol-table entries, confirming they are imports resolved by a
dynamic linker by name — the same position as the 51 `nn::os`/`nn::mem`/`nn::fs` imports the
platform layer already handles. `GRAPHICS_NVN.md` §2 recorded "`nn::vi` 12 functions"; that
figure counts **symbols**, and the functional surface is **six**.

This is a genuinely small increment, and it is the same shape as the work already done: a
handful of named functions implemented over host primitives.

## 4. The reference situation — with one correction

`GRAPHICS_NVN.md` and `AGL_COVERAGE.md` cite **`open-ead/nnsdk`** as providing the NVN table
implementation (`nnsdk/lib/nvn`) and the `nn::gfx` implementation (`nnsdk/lib/gfx`), described
as *"1 entry point"* and *"289 functions"* respectively.

**`open-ead/nnsdk` is not cloned in this environment.** The references present under
`~/refs/` are `sead`, `agl`, `nnware` and `eui`. The repository cites `nnsdk` as a **remote
link**, not as a local checkout, so **its NVN content was not verified in this session.**

That matters for the plan below: the claim that the NVN table has a ready implementation rests
on the earlier documents' description of a remote repository, not on inspected code.

| Layer | Size | Reference verified in this session? |
|---|---:|---|
| `nvnLoadCProcs` → NVN table | 1 entry point | **No** — `nnsdk` is a remote link, not cloned |
| `nn::vi` | **6 functions** | **Yes** — enumerated from the binary above |
| `nn::gfx` | 289 | **No** — same `nnsdk` dependency |
| `nn::g3d` | 292 | Headers in `nnware` (cloned); not inspected here |
| `agl` | 2,852 | `agl` cloned; not inspected here |
| `sead::GraphicsNvn` | 47 | **Header cloned** — `gfx/nin/seadGraphicsNvn.h` |
| `sead::DisplayBufferNvn` | 12 | Header not located in this pass |
| `GameFrameworkNx` | 35 | Ported in part (`initialize` only) |

### What the `GraphicsNvn` header shows

`~/refs/sead/include/gfx/nin/seadGraphicsNvn.h` is present and gives the class:

```cpp
class GraphicsNvn : public Graphics {
public:
    GraphicsNvn(const CreateArg& arg);
    void initializeDrawLockContext(Heap*) override;
    void initializeImpl(Heap*) override;
    void registerQueue(NVNqueue*);
    void registerDisplayBufferNvn(DisplayBufferNvn*);
    s32 convertNvnDebugLevel(u32);
    // ... ~35 more virtual set*Impl / get* overrides
    NVNdevice* getNvnDevice() const;
private:
    NVNdevice* mNvnDevice;
    NVNtexturePool mNvnTexturePool;
    // ...
};
```

**This is a header, not an implementation.** It declares roughly 40 overrides that a port must
write, and it includes `"nvn/nvn.h"` — a header **not present** in the cloned `sead` checkout
(`gfx/nvn/` contains only `seadDebugFontMgrNvn.h`). So the `GraphicsNvn` reference is a
declaration of the surface, with its dependencies missing.

## 5. What this means for the plan

**The graphics work splits cleanly into two halves of very different character:**

**Half A — the platform/display boundary. Small, verified, tractable now.**
Six `nn::vi` functions, all imports, all with known signatures, implemented over host windowing
(one window, one swapchain). Plus `nvnLoadCProcs`: one entry point returning a table of
function pointers, which `GRAPHICS_NVN.md` §2 argues is "provide a VTable backed by Vulkan"
rather than "reimplement the Switch GPU API". `devkitPro/deko3d` is the permissively-licensed
reference for what the table contains.

**Half B — the engine graphics layer. Large and partly reference-free.**
`sead::GraphicsNvn` (~40 overrides), `DisplayBufferNvn` (12), `nn::gfx` (289), `nn::g3d` (292),
`agl` (2,852). `agl` remains the largest single unknown, as `GRAPHICS_NVN.md` already recorded.
Only `GraphicsNvn`'s *declaration* is in hand; its implementation is not.

**So the honest reading is:** the display boundary is a small increment that could be done next
in the same style as the platform layer. The renderer behind it is not, and nothing in this
session establishes that `agl`/`g3d` are portable at acceptable cost.

## 6. Recommended next increment — and why it is narrow

**Port the six `nn::vi` functions plus a stub `nvnLoadCProcs` table**, then let the boot runner
advance into `initializeGraphicsSystem` and **stop at the next real gap inside it**. That is the
same method that has worked for the last five rounds: port a bounded, verified layer and let
fail-loudly report the next boundary rather than guessing the whole shape up front.

This is deliberately *not* "port the graphics subsystem". Given §5, attempting the renderer
before the display boundary is the cold-attempt mistake that cost three rounds on
`registerCallback`.

## 7. Limits of this scoping

- **`nnsdk` was not inspected.** The NVN-table and `nn::gfx` implementation claims come from
  earlier documents citing a remote repository; they are unverified here.
- **The 46 indirect dispatch sites** mean the dependency list in §2 is incomplete by
  construction.
- **`DisplayBufferNvn`'s header was not located** in the cloned `sead`; its 12 functions are
  counted from the binary only.
- **`nn::g3d`, `nn::gfx`, `agl` and `nnware` were not inspected** in this pass.
- **`nvn/nvn.h` is missing** from the cloned `sead`, so the NVN type definitions that
  `GraphicsNvn` depends on are not in hand.
- **No code was ported.** The boot runner still stops at step 11.
