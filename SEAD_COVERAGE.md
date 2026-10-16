# sead coverage: what [open-ead/sead](https://github.com/open-ead/sead) gives the port

Assessment of how much of the `sead` engine layer in Splatoon 2 is covered by the
existing decompilation, and what must be written from scratch.

`sead` is the largest single component of the boot closure — **94 of 232
functions** — so its coverage materially changes the port's shape.

---

## 1. What the repository is

**[open-ead/sead](https://github.com/open-ead/sead)** — *"Decompilation of sead: the
standard C++ library for first-party Nintendo games."*

- It **is a decompilation**, not a clean reimplementation. Names come from debug
  symbols, assertions and file organisation. The README states plainly that
  *"many names (especially for inlined, templated functions) are just plain
  guesses."*
- **No license file.** This matters for a porting project and should be resolved
  before any code is reused.
- Switch-first: `CMakeLists.txt` sets `SEAD_PLATFORM "nin"` as the **only permitted
  value**; Wii U (`cafe`) sources remain in-tree but are not compiled.
- **Not self-contained.** It links `NintendoSDK`/`nnSdk` and `nn_gfx`, and expects
  a matching nnSdk. It cannot build standalone.
- **Completeness is partial.** 178 headers but only 102 `.cpp` files. The README's
  module list is partly aspirational: **`audio`, `geom` and `message` do not exist
  in the tree at all.** The README also admits *"several modules currently fail to
  build for Switch."* No verifiable function-level completeness figure exists.

### Layout (differs from the obvious guess)

```
include/<module>/...          NOT include/sead/<module>/...
modules/src/<module>/...      NOT src/...
```

18 modules: `basis, codec, container, controller, devenv, filedevice, framework,
gfx, heap, hostio, math, mc, prim, random, resource, stream, thread, time`.

---

## 2. Class coverage against this binary's closure

Of the 39 `sead` subsystems the boot closure touches, **36 are PRESENT** in the
repository:

| Class | Path |
|---|---|
| Arena | `include/heap/seadArena.h` |
| AssertConfig | `include/devenv/seadAssertConfig.h` |
| BufferedSafeStringBase | `include/prim/seadSafeString.h` |
| CalendarTime | `include/time/seadCalendarTime.h` |
| CriticalSection | `include/thread/seadCriticalSection.h` |
| DateTime / DateUtil | `include/time/seadDateTime.h`, `seadDateUtil.h` |
| DelegateThread | `include/thread/seadDelegateThread.h` |
| DrawLockContext | `include/gfx/seadDrawLockContext.h` |
| EnumUtil | `include/prim/seadEnum.h` |
| ExpHeap | `include/heap/seadExpHeap.h` |
| FileDeviceMgr | `include/filedevice/seadFileDeviceMgr.h` |
| Framework / GameFramework | `include/framework/seadFramework.h` |
| GlobalRandom / Random | `include/random/` |
| Heap / HeapMgr | `include/heap/` |
| MainFileDevice | `include/filedevice/seadMainFileDevice.h` |
| MessageQueue | `include/thread/seadMessageQueue.h` |
| NinContentFileDevice | `include/filedevice/nin/seadNinContentFileDeviceNin.h` |
| NinFileDeviceBase | `include/filedevice/nin/seadNinFileDeviceBaseNin.h` |
| ReadWriteLock / Semaphore | `include/thread/` |
| ResourceMgr | `include/resource/seadResourceMgr.h` |
| StringUtil | `include/prim/seadStringUtil.h` |
| TaskBase | `include/framework/seadTaskBase.h` |
| Thread / ThreadMgr / ThreadUtil | `include/thread/` |

`FindContainHeapCache`, `FormatFixedSafeString`, `IDisposer`, `ListNode`,
`PtrArrayImpl` and `ThreadMgr` have no dedicated file but are defined in adjacent
headers (`seadHeapMgr.h`, `seadSafeString.h`, `seadDisposer.h`, `seadListImpl.h`,
`seadPtrArray.h`, `seadThread.h`).

---

## 3. The gap — verified against the binary, not assumed

The repository's NX-specific layer is the part this port actually needs, and it is
the part that is missing. Verified two ways: the repository's complete file tree,
and the actual symbol table of `main`.

| Class | In open-ead/sead | In Splatoon 2 `main` |
|---|---|---|
| `GameFrameworkNx` | header only, **no `.cpp`** | **35 functions** — ctor, dtor, `initialize`, `initializeGraphicsSystem`, `presentAsync_`, `outOfMemoryCallback_` |
| `GraphicsNvn` | header only, **no `.cpp`** | **47 functions** — ctor, `initializeImpl`, `registerQueue`, `registerDefaultCommandBuffer`, `getNewTextureId` |
| `PerformanceMgrNx` | **ABSENT** | **14 functions** — `initialize`, `setPerformanceConfiguration`, `isDockIn`, `setCPUPerformance1122MHz`, power measuring |
| `ForegroundBucketMgr` | **ABSENT** | 1 function — `initialize(Heap*, u32, u32, bool)` |

Evidence from the binary (`main.elf` symbol table):

```
0x7100e6724c  sead::GameFrameworkNx::initialize(Framework::InitializeArg const&)
0x7100e6738c  sead::GameFrameworkNx::initializeGraphicsSystem(Heap*, Vector2<float> const&)
0x7100e67d2c  sead::GameFrameworkNx::presentAsync_(Thread*, long)
0x7100e70e1c  sead::GraphicsNvn::initializeImpl(Heap*)
0x7100e68c44  sead::PerformanceMgrNx::initialize()
0x7100e68c7c  sead::PerformanceMgrNx::isDockIn()
0x710139fb3c  sead::ForegroundBucketMgr::initialize(Heap*, u32, u32, bool)
```

**The repository is strongest exactly where the port needs it least.** The heap,
string, container, thread, time, resource and file-device core is well covered —
but the graphics and framework bring-up path, which
[BOOT_CALLGRAPH.md](BOOT_CALLGRAPH.md) identifies as the last and hardest step of
boot, is headers-only or absent.

---

## 4. ABI versioning: the real risk

`include/seadVersion.h` exposes the ABI-relevant differences as compile-time
feature macros, with presets:

```
SEAD_VERSION_BOTW  1    (default)
SEAD_VERSION_SMO   2
SEAD_VERSION_SPL3  3
SEAD_VERSION_TOTK  4
SEAD_VERSION_SMBW  5
SEAD_VERSION_SMM2  6
SEAD_VERSION_CUSTOM 0
```

**There is no Splatoon 2 preset.** Splatoon 2 appears only as a source of symbol
names. The closest documented 2017-era presets are BOTW (1) and SMO (2).

These flags change class layout and vtable order, which is precisely what breaks an
ABI match:

| Flag | Effect |
|---|---|
| `SEAD_SAFESTRING_NONVIRTUAL` | **adds or removes a vtable from `SafeStringBase`** |
| `SEAD_CRITICALSECTION_PURE` | removes `IDisposer` from `CriticalSection` |
| `SEAD_THREAD_GETFIBER` | adds virtual `getFiber()`, removes `getStackCheckStartAddress_()` — **shifts every Thread subclass vtable** |
| `SEAD_THREADMGR_MOVED_SINGLETON_DISPOSER` | moves `ThreadMgr`'s singleton-disposer member |
| `SEAD_FINDCONTAINHEAPCACHE_FIXED` | 64-bit pointer fix — **directly relevant to AArch64** |
| `SEAD_HOSTIO_NONVIRTUAL`, `SEAD_HEAP_FREEANDGETALLOCATABLESIZE_VIRTUAL`, `SEAD_ARCHIVERES_ISCONST`, `SEAD_RTTI_CHECKDERIVEDRUNTIMETYPEINFO_RETURNS_INSTANCE` | further layout/vtable effects |

**Which preset (if any) matches Splatoon 2 is unknown**, and — importantly — was
**not resolvable from assertion strings**: a direct scan of `main` found **zero**
occurrences of any `SEAD_VERSION_*` or `SEAD_*` flag identifier. These are
compile-time macros that leave no string trace. The values must be determined
empirically from the binary's own layouts (vtable lengths, member offsets,
`sizeof` assertions).

One useful anchor the repository does provide: `seadGameFrameworkNx.h` carries
`static_assert(sizeof(GameFrameworkNx) == 0x210)` and
`static_assert(sizeof(CreateArg) == 0x48)`. Those give concrete numbers to test
against this binary's construction sites.

---

## 5. Verdict for the port

**Use it as a structural reference and as a source for the non-platform layers.**
Do not treat it as a drop-in ABI-compatible `sead`.

**What it saves you:** the 36 covered classes — heap management, strings,
containers, threading primitives, time, resource and file-device core. That is a
substantial share of the 94 `sead` functions in the closure, and because it is a
decompilation matched against real builds, member ordering and vtable order are
likely correct *for whichever preset was matched* — making it a good oracle for
validating your own struct offsets.

**What it does not save you:** the entire Switch graphics and framework bring-up
path. `GameFrameworkNx`, `GraphicsNvn`, `PerformanceMgrNx` and `ForegroundBucketMgr`
must be reconstructed from the binary — and those are exactly the functions
[BOOT_CALLGRAPH.md](BOOT_CALLGRAPH.md) puts on the critical path to the first frame.

> **Partial correction.** This section originally concluded *"expect to write the
> entire graphics bring-up path yourself."* That holds for `sead`'s own graphics
> classes, but it over-stated the problem for the stack beneath them. NVN turns out
> to be a single dispatch table, and `nn::gfx` has a reference implementation in
> the companion repository `open-ead/nnsdk`. See
> **[GRAPHICS_NVN.md](GRAPHICS_NVN.md)** for the corrected picture — the
> reference-free layers are `nn::g3d` (292 functions) and `agl` (2,852), not the
> whole graphics path.

**Three caveats to settle before relying on it:**

1. **License.** No license file in the repository. Resolve before reusing code.
2. **ABI flags.** Determine Splatoon 2's flag values from the binary; do not assume
   a preset.
3. **nnSdk dependency.** Building requires a matching nnSdk, and matching one to a
   2017 binary is a separate problem.

## Unknowns

- Whether `PerformanceMgrNx` / `ForegroundBucketMgr` are defined *inside* another
  header in the repository. No such file exists and neither name appears in the
  framework/gfx headers that were read in full, but a whole-repo text search was
  not possible.
- Which `SEAD_VERSION` preset corresponds to Splatoon 2 — no statement exists.
- Any quantified completeness metric — none available.
- Whether the repository builds for Switch today — the README says several modules
  do not.
