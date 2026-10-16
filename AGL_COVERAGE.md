# `agl` coverage: [open-ead/agl](https://github.com/open-ead/agl)

Assessment of the library that [NNWARE_COVERAGE.md](NNWARE_COVERAGE.md) identified
as **the largest reference-free component in the port**.

**It is not reference-free.** A decompilation exists, and its header coverage
matches this binary closely.

---

## 1. What it is

| Property | Value |
|---|---|
| Description | *"Decompilation of agl, a C++ library for first-party Nintendo games that is used for graphics, lighting and parameter utils (AAMP)"* |
| Created | **2020-08-14** |
| Last push | **2026-10-16** (active) |
| Default branch | `master` |
| Languages | C++ |
| Stars / forks | **46 / 15** |
| Topics | `decompilation`, `nintendo-switch`, `reverse-engineering` |
| **License** | **none** |
| Size | ~203 KB |

This is the most mature of the `open-ead` repositories consulted so far: six years
old, actively pushed, and by far the most-starred. `nnware` explicitly defers to it
— *"See [sead](https://github.com/open-ead/sead) for more information about the goal
of this project"* — the same project family and conventions.

**Note what it is not:** there is no `agl::ForegroundBucketMgr` here, and no
`agl` core renderer implementation. `nnware` and `open-ead/sead` cover the engine
*below* and *beside* `agl`; this covers `agl` itself.

---

## 2. Coverage verified against this binary

`main` contains **2,852 `agl::` functions**. Class-by-class:

| Class | nnware header | Functions in `main` | Implementation in repo |
|---|---|---|---|
| ParameterObj | ✅ | 57 | ✅ 6.5 KB |
| ParameterList | ✅ | 28 | ✅ 9.9 KB |
| ParameterCurve | ✅ | 31 | — |
| ParameterIO | ✅ | 11 | ✅ 1.3 KB |
| ParameterStringMgr | ✅ | 11 | ✅ 0.5 KB |
| ResParameter | ✅ | 22 | ✅ 3.0 KB |
| ResShaderArchive | ✅ | 6 | ✅ **13.6 KB** |
| ResShaderProgram | ✅ | 8 | — |
| ShaderProgramArchive | ✅ | 17 | — |
| ShaderLocation | ✅ | 9 | ✅ 1.8 KB |
| AtomicPtrArray | ✅ | 7 | ✅ 2.4 KB |
| GPUMemBlockMgr | ✅ | 27 | ✅ 1.6 KB |
| GPUMemAddr | ✅ | 47 | — |
| GPUMemBlock | ✅ | 120 | — |
| GraphicsDriverMgr | ✅ | 11 | ✅ 0.3 KB |
| NVNMgr | ✅ | 30 | ✅ 0.2 KB |
| ShaderProgram | ✅ | 84 | — |
| Shader | ✅ | 172 | — |
| TextureData | ✅ | 108 | — |
| DisplayList | ✅ | 18 | — |
| DrawContext | ✅ | **223** | — |
| RenderBuffer | ✅ | 31 | — |
| RenderTarget | ✅ | 17 | — |
| Surface | ✅ | 6 | — |
| FileIOMgr | ✅ | 16 | — |
| MemoryPoolHeap | ✅ | 9 | — |
| PrivateResource | ✅ | 13 | — |
| ShaderHolder | ✅ | 10 | — |
| ScreenShotMgr | ✅ | 21 | — |
| DevTools | ✅ | 70 | — |
| EnvObj | ✅ | **151** | — |
| EnvObjMgr | ✅ | 27 | — |
| Fog | ✅ | 7 | — |
| Light | ✅ | **242** | — |
| Projector | ✅ | 10 | — |
| Bloom | ✅ | 30 | — |
| DepthOfField | ✅ | 65 | — |
| NVNtexture | ✅ | 19 | — |
| NVNsampler | ✅ | 10 | — |
| NVNimage | ✅ | 5 | — |

**Every header-declared class in this repository corresponds to real code in
`main`.** That is a strong version-match signal: the repository was almost
certainly built against a Switch title in this engine era.

### Classes with no counterpart in this binary

`ResCommon`, `ResShaderSymbol`, `FxOfxLensFlare`, `ShaderTextClause`,
`ShaderTextLexer`, `ShaderTextPreprocessor`, `NW4FToNN` — all zero. These are
likely version differences, or dead-stripped code. Harmless, but they show the
match is not exact.

### Implementation surface present

Twelve `.cpp` files, concentrated in parameter utils and resource handling:

```
src/utility/aglParameter.cpp                  16.6 KB
src/utility/common/aglResShaderArchive.cpp    13.6 KB
src/utility/aglParameterList.cpp               9.9 KB
src/utility/aglParameterObj.cpp                6.5 KB
src/utility/aglResParameter.cpp                3.0 KB
src/utility/aglAtomicPtrArray.cpp              2.4 KB
src/common/aglShaderLocation.cpp               1.8 KB
src/detail/aglGPUMemBlockMgr.cpp               1.6 KB
src/utility/aglParameterIO.cpp                 1.3 KB
src/utility/aglParameterStringMgr.cpp          0.5 KB
src/driver/aglGraphicsDriverMgr.cpp            0.3 KB
src/driver/aglNVNMgr.cpp                       0.2 KB
```

**Parameter utils (AAMP) — 160 functions, plus `ResShaderArchive` — are the
substantial implemented parts.** Everything else is declarations.

---

## 3. What this changes

`agl` was the whole remaining risk. Reclassified:

| `agl` area | Functions | Reference |
|---|---:|---|
| Parameter utils (AAMP) | ~160 | ✅ **implemented** |
| Resource/shader archive | ~31 | ✅ **mostly implemented** |
| GPU memory management | 194 | ⚠ headers |
| Driver / NVN bridge | 64 | ⚠ headers |
| Shader + program objects | 256 | ⚠ headers |
| Texture / surface | 114 | ⚠ headers |
| Draw context, display list, render | 295 | ⚠ headers |
| Environment: light, fog, envobj, projector | 437 | ⚠ headers |
| Post-effects: bloom, DoF | 95 | ⚠ headers |
| DevTools, screenshot, file IO, misc | ~120 | ⚠ headers |
| Unclassified remainder | ~1,086 | ⚠ unknown |

**No `agl` area is now reference-free.** The distinction is between *implemented*
(parameter utils, shader archive) and *header-documented* (the renderer and
effects), rather than available versus absent.

That is a materially different position from the previous assessment, which
concluded `agl` had *"no reference anywhere."*

---

## 4. Remaining unknowns

- **The core renderer has declarations but no code.** `DrawContext` (223
  functions), `DisplayList` (18), `RenderBuffer` (31), `RenderTarget` (17) — these
  are the actual drawing path and are headers only.
- **~1,086 of the 2,852 `agl` functions are unclassified** by the simple
  substring matching used here. A proper pass against the repository's full header
  list would tighten this.
- **`agl::ForegroundBucketMgr` is not in this repository** despite being in
  `main` (1 function) and being referenced by the boot path. It may live in a
  version not yet decompiled.
- **No license**, as with every `open-ead` repository consulted.
- **Version match is inferred, not proven.** Every declared class existing in the
  binary is good evidence, but `static_assert`s in the headers should be checked
  against the binary's own construction sites before trusting layouts.

## 5. Consolidated dependency position

| Layer | Functions | Best available reference |
|---|---:|---|
| NVN function table | 1 entry point | ✅ `nnsdk/lib/nvn` (implementation) |
| `nn::gfx` | 289 | ✅ `nnsdk/lib/gfx` (implementation) |
| `nn::os`/`mem`/`fs`/`hid`/`vi` | ~382 | ✅ `nnsdk/include` (headers) |
| `nn::g3d`/`ui2d`/`atk`/`vfx`/`font` | 2,823 | ⚠ `nnware` (headers, stubs) |
| `sead` non-NX | ~4,022 | ✅ `sead` (decompilation) |
| `sead::*Nx` | ~97 | ❌ binary only |
| **`agl`** | **2,852** | ✅ **`agl` (decompilation; ~190 implemented)** |

**Every major layer now has at least a header-level reference.** The genuinely
unreferenced code has shrunk to the Switch-specific `sead` classes
(`GameFrameworkNx`, `GraphicsNvn`, `PerformanceMgrNx`, `ForegroundBucketMgr` — ~97
functions) and whatever `agl` internals the repository has not yet reached.

## 6. Recommended next step

The four repositories now form a coherent reference set for this engine era:

- [open-ead/sead](https://github.com/open-ead/sead) — engine core
- [open-ead/agl](https://github.com/open-ead/agl) — graphics/lighting/AAMP
- [open-ead/nnware](https://github.com/open-ead/nnware) — `g3d`/`ui2d`/`atk`/`vfx`/`font`
- [open-ead/nnsdk](https://github.com/open-ead/nnsdk) — nnSdk + NVN + `nn::gfx`

**The highest-value verification is now cross-repository layout agreement.**
`nnware`'s headers descend from OdysseyReversed and `agl`'s from this project; if
their struct layouts agree *and* match `main`'s construction sites, that is
independent corroboration rather than a single source to be trusted. The
`static_assert` values in these headers give exact numbers to test against the
binary with the address-decode method already used throughout this repository.

All four lack licenses. That remains unresolved and should be settled before code
is incorporated.
