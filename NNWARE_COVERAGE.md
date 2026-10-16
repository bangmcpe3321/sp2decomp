# NintendoWare coverage: `open-ead/nnware`

Assessment of **[open-ead/nnware](https://github.com/open-ead/nnware)** — *"Decompilation
of NintendoWare modules that are linked statically in some Nintendo games."*

This is the layer [GRAPHICS_NVN.md](GRAPHICS_NVN.md) flagged as reference-free.
It turns out to be **half** covered.

---

## 1. What it is

| Property | Value |
|---|---|
| Description | User-created headers for NintendoWare for decompilation projects |
| Language | C++ |
| Size | ~611 KB |
| Created | 2026-09-23 |
| Last push | 2026-10-14 |
| Stars / forks | 3 / 2 |
| **License** | **none** |
| Branch / tags | one branch (`main`), no tags |

Credits: [Shadow](https://github.com/shadowninja108) for
[Skyline](https://github.com/shadowninja108/Skyline), and
[Shibbo](https://github.com/shibbo) for
[OdysseyReversed](https://github.com/shibbo/OdysseyReversed) — *"which most of
these headers came from."* OdysseyReversed is a Super Mario Odyssey decompilation,
which is a 2017 Switch title in the same engine era as this target. That is a
meaningful provenance signal.

### ⚠ Stated usage restriction

The README says, verbatim:

> Do not ask for or PR any copyrighted material to this repo. You will be ignored.
> **Usage of the materials here outside of matching decompilation is not supported.**

This is stricter than the other dependencies. `open-ead/sead` and `open-ead/nnsdk`
are silent on permitted use; **nnware explicitly disclaims use outside matching
decompilation**, which is precisely what a PC port is not. Treat this repository as
a *structural reference* — headers can be read for class layouts — rather than as
code to incorporate. Its maintainers have stated their intent plainly and it should
be respected.

### Modules present

Under `lib/`: **`g3d`** (3D renderer), **`ui2d`** (2D UI), **`atk`** (audio toolkit),
**`vfx`** (effects), **`font`**.

### Critical limitation: headers only

Every module's `src/` contains a stub, not an implementation:

```
lib/g3d/src/g3d/g3d_Stub.cpp      8 bytes
lib/ui2d/src/ui2d/ui2d_Stub.cpp   0 bytes
lib/atk/src/atk/atk_Stub.cpp      0 bytes
lib/vfx/src/vfx/vfx_Stub.cpp      0 bytes
lib/font/src/font/font_Stub.cpp   0 bytes
```

**There is no executable NintendoWare code here.** The value is entirely in the
headers: class layouts and `static_assert`s.

---

## 2. Coverage verified against this binary

Namespaces nnware declares, measured in `main`:

| Namespace | nnware module | Functions in `main` |
|---|---|---:|
| `nn::g3d` | `lib/g3d` | **292** |
| `nn::ui2d` | `lib/ui2d` | **479** |
| `nn::atk` | `lib/atk` | **1,426** |
| `nn::vfx` | `lib/vfx` | **396** |
| `nn::font` | `lib/font` | **230** |
| | **total** | **2,823** |

Header-declared classes line up with real code in the binary:

| Class | Functions | Class | Functions |
|---|---:|---|---:|
| `g3d::AnimObj` | 93 | `ui2d::Pane` | 352 |
| `g3d::ResMaterial` | 58 | `ui2d::Layout` | 158 |
| `g3d::ModelObj` | 43 | `ui2d::Material` | 112 |
| `g3d::ResModel` | 40 | `ui2d::TextBox` | 89 |
| `g3d::ResSkeleton` | 16 | | |
| `g3d::ViewVolume` | 13 | | |

**2,823 functions — about 85% of the 3,144 that GRAPHICS_NVN.md called
"reference-free" — now have a header-level structural reference.**

### But `agl` is absent

```
agl::*   2,852 functions in main   —   NOT in nnware
```

`agl` is the layer `agl::ForegroundBucketMgr` and the `Lp::Sys` framework sit
against. It is **not** NintendoWare, it is not in nnware, and it is **the largest
single reference-free component in the entire port**:

| Layer | Functions | Reference |
|---|---:|---|
| `nn::g3d` | 292 | ✅ nnware headers |
| `nn::ui2d` | 479 | ✅ nnware headers |
| `nn::atk` | 1,426 | ✅ nnware headers |
| `nn::vfx` | 396 | ✅ nnware headers |
| `nn::font` | 230 | ✅ nnware headers |
| **`agl`** | **2,852** | ❌ **nothing** |

---

## 3. Where the port now stands

Consolidating all dependency assessments in this repository:

| Layer | Functions | Status |
|---|---:|---|
| NVN function table | 1 entry point | ✅ `nnsdk/lib/nvn` |
| `nn::gfx` | 289 | ✅ implementation in `nnsdk/lib/gfx` |
| `nn::vi` | 12 | ✅ headers |
| `nn::os` / `nn::mem` / `nn::fs` / `nn::hid` | ~370 | ✅ headers |
| `nn::g3d` | 292 | ⚠ nnware headers, no code |
| `nn::ui2d` | 479 | ⚠ nnware headers, no code |
| `nn::atk` | 1,426 | ⚠ nnware headers, no code |
| `nn::vfx` | 396 | ⚠ nnware headers, no code |
| `nn::font` | 230 | ⚠ nnware headers, no code |
| `sead` (non-NX) | 94 in closure | ✅ `open-ead/sead` |
| `sead::*Nx` classes | ~97 | ❌ binary only |
| **`agl`** | **2,852** | ❌ **nothing** |

**The port's graphics problem has narrowed to two things: `agl` (2,852 functions
with no reference at all), and the Switch-specific `sead`/`gfx` glue that has
headers but no implementations.**

---

## 4. Practical recommendations

1. **Read nnware's headers, do not copy its code.** Beyond being stub-only, its
   README explicitly declines support for non-decompilation use.
2. **Validate header layouts against the binary before trusting them.** The same
   address-decode approach used throughout this repo applies: `nn::g3d` and
   `ui2d` construction sites are visible, and `static_assert`s in the headers give
   numbers to test.
3. **Prioritise determining whether `agl` has any reference anywhere.** It is now
   the single largest unknown and the biggest remaining risk. If no reference
   exists, 2,852 functions of rendering abstraction must be reconstructed from the
   binary alone — and that, not the UI toolkit, is the long pole.
4. **Note the provenance chain.** nnware's headers largely descend from
   OdysseyReversed (Super Mario Odyssey). If that project's structures match a
   Splatoon 2 build, that is strong evidence of a shared NintendoWare version —
   and would let you cross-check layouts between two independent decompilations
   rather than trusting one.

## Unknowns

- Which NintendoWare/SDK version these headers correspond to, and whether it
  matches this 2017-era Splatoon 2 build.
- Whether any `agl` reference implementation exists publicly.
- Whether `nn::vfx` and `nn::font` headers are complete enough to reconstruct
  their classes (both are small: a handful of headers each).
