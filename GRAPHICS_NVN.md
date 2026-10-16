# Graphics layer: NVN dispatch and the `open-ead/nnsdk` headers

How the graphics stack is structured, and why it is more tractable than the
raw function counts suggest.

---

## 1. What `open-ead/nnsdk` is

**[open-ead/nnsdk](https://github.com/open-ead/nnsdk)** — *"User-created headers for
NintendoSDK for decompilation projects."*

| Property | Value |
|---|---|
| Language | C++ |
| Size | ~737 KB |
| Created | 2026-09-23 |
| Last push | 2026-10-12 |
| Stars / forks | 4 / 3 |
| **License** | **none** |

It is the nnSdk dependency [SEAD_COVERAGE.md](SEAD_COVERAGE.md) identified as
missing for `sead`. It is **not headers only** — it contains substantial
implementations.

### Core SDK headers

Under `include/nn/`: `account`, `album`, `am`, `aoc`, `applet`, `audio`, `bcat`,
`crypto`, `diag`, `err`, `friends`, `fs` (`fs_Mount`, `fs_Rom`, `fs_Files`,
`fs_Directories`, `fs_Save`), `hid` (25 KB), `image`, `init`, `irsensor`, `mem`
(`mem_StandardAllocator`), `nfp`, `nifm`, `nlibsdk` (central heap, heap error),
and more.

These cover essentially the exact namespaces
[BOOT_CALLGRAPH.md](BOOT_CALLGRAPH.md) lists as boot-critical: `nn::init`,
`nn::mem::StandardAllocator`, `nn::fs::MountRom`, `nn::hid`, `nn::audio`.

### The graphics implementations (the significant part)

`lib/gfx/` and `lib/nvn/` contain **real code**, not declarations:

```
lib/gfx/src/gfx/detail/gfx_CommandBuffer-api.nvn.8.cpp     47 KB
lib/gfx/src/gfx/detail/gfx_NvnHelper.cpp                   30 KB
lib/gfx/src/gfx/detail/gfx_Shader-api.nvn.8.cpp            25 KB
lib/gfx/src/gfx/detail/gfx_State-api.nvn.8.cpp             17 KB
lib/gfx/src/gfx/util/gfx_PrimitiveShape.cpp                17 KB
lib/gfx/src/gfx/detail/gfx_Texture-api.nvn.8.cpp           13 KB
lib/gfx/src/gfx/detail/gfx_DescriptorPool-api.nvn.8.cpp     9 KB
lib/gfx/src/gfx/detail/gfx_Buffer-api.nvn.8.cpp             7 KB
lib/gfx/src/gfx/detail/gfx_ResShader-api.nvn.8.cpp          7 KB
lib/nvn/src/nvn/nvn_FuncPtrImpl.h                         110 KB
lib/nvn/src/nvn/nvn_CppFuncPtrImpl.h                      102 KB
lib/nvn/include/nvn/nvn_Cpp.h                             110 KB
lib/nvn/include/nvn/nvn_FuncPtrInline.h                    98 KB
```

Note the `-api.nvn.8` suffixes: these target **NVN API version 8** on Horizon.

---

## 2. Verified against the binary: NVN is a dispatch table

Checking `main`'s own symbol table for NVN:

```
nvnBootstrapLoader   0x7101413d48   (in .plt region — an import thunk)
nvnBootstrapLoader   0x7103877000   (EXTERNAL — the imported symbol)
nvnLoadCProcs        0x7100ddd6e4
```

**There are no other `nvn*` functions in the binary.** No `nvnDeviceInitialize`,
no `nvnDeviceGetProcAddress`, none of the hundreds of `nvn*` entry points.

That is not a gap — it is the architecture. **NVN is a Vulkan-style loader API:**
the single bootstrapping entry point returns a struct of function pointers, and
every subsequent GPU call goes through that table. The per-function NVN surface
does not exist as named code because it is reached exclusively through pointers.

Surrounding counts, for scale:

| Namespace | Functions |
|---|---:|
| `nn::vi` | 12 |
| `nn::gfx` | 289 |
| `nn::g3d` | 292 |
| `agl` | 2,852 |

### Why this matters

**A port does not reimplement hundreds of `nvn*` functions. It implements
`nvnBootstrapLoader` once and fills in one struct.** That is a categorically
smaller problem than "reimplement the Switch GPU API" — it is "provide a VTable
backed by Vulkan."

The `open-ead/nnsdk` files are directly useful here because
`nvn_FuncPtrImpl.h` and `nvn_FuncPtrInline.h` enumerate the table's contents with
names and layout, giving the exact structure to fill in.

---

## 3. Revised graphics dependency chain

The graphics stack, bottom-up, with what is known to be available:

| Layer | Functions | Reference available? |
|---|---:|---|
| `nvnBootstrapLoader` → NVN table | 1 entry point | **Yes** — `lib/nvn/*` in nnsdk |
| `nn::gfx` | 289 | **Yes** — `lib/gfx/src/**` implements it |
| `nn::g3d` (renderer) | 292 | Headers only — must be written |
| `agl` (graphics library) | 2,852 | Absent — must be written |
| `sead::GraphicsNvn`, `GameFrameworkNx` | 47 + 35 | Headers only — must be written |

**So the two layers that are genuinely reference-free are `nn::g3d` and `agl`.**
Everything below them has either an implementation or a verified declaration to
work from. That is a much better position than
[SEAD_COVERAGE.md](SEAD_COVERAGE.md) implied when it said "expect to write the
entire graphics bring-up path yourself" — that remains true for `g3d` and `agl`,
but `nn::gfx` and the NVN table are now covered.

---

## 4. Caveats

1. **License.** `nnsdk` has **no license file**, as is also the case for
   `open-ead/sead`. Two unlicensed dependencies now sit on the critical path.
   Resolve this before incorporating any code.
2. **Maturity.** 4 stars, 3 forks, created 2026-09-23. It is a young,
   low-traffic project. Authorship of *implementations* (as opposed to headers) is
   also worth scrutinising — a decompilation-adjacent implementation of a
   proprietary graphics API raises the same provenance questions as `sead`.
3. **SDK version match is unverified.** Which nnSdk version these headers
   correspond to, and whether it matches this 2017-era binary, is unknown. The
   `gfx_*Info` struct layouts and `-api.nvn.8` API version are the things to check
   against the binary's own structures.
4. **NVN table is large.** "One struct" understates the work — the NVN API surface
   is broad, and every entry actually reached by the game must be backed by real
   Vulkan. The saving is architectural (one dispatch table rather than hundreds of
   named functions), not a reduction in total GPU work.
5. **`nn::g3d` and `agl` have nothing.** 3,144 functions with no reference
   implementation. This is the largest remaining graphics task.

## 5. Bottom line

The graphics path is more tractable than it first appeared: **`nn::gfx` has an
implementation and NVN is a single dispatch table**, so the bottom two thirds of
the GPU stack can be stood up from references rather than reconstructed blind.

The unbounded-looking part is now precisely bounded: **`nn::g3d` (292) and `agl`
(2,852) are reference-free**, and both sit above a layer that can be made to work.

Two things to settle before writing code: **the missing licenses**, and **whether
the nnsdk header structs match this binary's layouts** (checkable with the same
address-decode approach used elsewhere in this repo).
