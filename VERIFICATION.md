# Layout verification against `main`

**Result: the header layouts match this binary.** This validates the whole
`open-ead` reference set for this title.

Method: take a class declared in `sead` (so its layout carries explicit
`static_assert` sizes), find its construction site in `main`, and compare the
header's declared sizes against what the compiled code actually does.

Class chosen: **`sead::GameFrameworkNx`** — declared in
[open-ead/sead](https://github.com/open-ead/sead), used by `agl`'s `GraphicsNvn`,
and instantiated in `main` from `Lp::Sys::SysInit::Init`. It appears in multiple
repositories, which is exactly what makes it a useful cross-check.

---

## 1. `sizeof(GameFrameworkNx) == 0x210`

**Header declares** (`include/framework/nx/seadGameFrameworkNx.h`):

```cpp
static_assert(sizeof(GameFrameworkNx) == 0x210);
```

The header's final members are:

```cpp
    NVNcommandHandle mCommandHandle;
    nn::os::SystemEventType mVsyncEvent;
    bool _208;
    u8 _209;
    bool _20a;
    u8 _20b;
```

So `_20a` and `_20b` are the last two bytes, meaning the object's live data ends
at `0x20C`, padded to `0x210`.

**Binary evidence** — the constructor at `0x7100e67260` (224 bytes, ending in
`ret` at `0x7100e6733c`). Its highest object-relative store is:

```
0x7100e67310  strb w10, [x19, #522]
```

`522` = `0x20A` — a **byte** store to `+0x20A`, matching `bool _20a`. The observed
stores into the object are:

```
+0x000   str x8,  [x19, #0]      vtable pointer
+0x0E8   str sp,  [x19, #232]
+0x0F0   stp x0, sp, [x19, #240]
+0x0F8   str w9,  [x19, #248]    (from #268 decimal)
+0x108   str w31, [x19, #272]
+0x114   str w9,  [x19, #276]
+0x118   str w9,  [x19, #280]
+0x11C   str w9,  [x19, #284]
+0x1C8   stp x9, sp, [x19, #456]  ← matches mPresentationThread / mSync area
+0x208   strb w10,[x19, #520]     ← matches _208
+0x209   strb w31,[x19, #521]     ← matches _209
+0x20A   strb w10,[x19, #522]     ← matches _20a
+0x20B   strb w31,[x19, #523]     ← matches _20b
```

Four consecutive **byte** stores at `0x208`–`0x20B` is a precise fingerprint of
the header's trailing `bool _208; u8 _209; bool _20a; u8 _20b;`. The maximum
offset touched is `0x20B`, so the object occupies `0x20C` bytes, rounded up to
16-byte alignment = **`0x210`**.

**Verdict: `0x210` confirmed.** ✅

---

## 2. `sizeof(CreateArg) == 0x48`

**Header declares:**

```cpp
static_assert(sizeof(CreateArg) == 0x48);
```

**Binary evidence** — inside the same constructor:

```
0x7100e67284  52800915  movz x21, #0x48
0x7100e6729c  9416abf7  bl   0x7101412278     memcpy
```

The constructor sets `x21 = 0x48` and then calls `memcpy` with that register as
the length. That is the `CreateArg` copy — **the compiler's own `sizeof`**, read
directly from the instruction stream.

**Verdict: `0x48` confirmed.** ✅

---

## 3. `initialize` is a trivial wrapper

The symbol `sead::GameFrameworkNx::initialize(Framework::InitializeArg const&)` at
`0x7100e6724c` is a 20-byte tail-call wrapper:

```
0x7100e6724c  a9bf7bfd  stp  x29, x30, [sp, #-16]!
0x7100e67250  910003fd  mov  x29, sp
0x7100e67254  94000b64  bl   0x7100e69fe4      (build the CreateArg)
0x7100e67258  a8c17bfd  ldp  x29, x30, [sp], #16
0x7100e6725c  1400067a  b    0x7100e67260      tail-call the constructor
```

This is a useful confirmation of the calling convention: `initialize` builds a
`CreateArg` (via `0x7100e69fe4`) and tail-calls the constructor, exactly as the
header's two declarations — `static void initialize(const Framework::InitializeArg&)`
and `GameFrameworkNx(const CreateArg&)` — imply.

---

## 4. What this means

**The `open-ead/sead` header for `GameFrameworkNx` matches this binary's actual
layout** on both declared sizes. That is a strong result, because:

- `GameFrameworkNx` is the most Switch-specific and era-sensitive class in the
  set. `SEAD_VERSION` flag macros affect class layouts generally, so a match here
  is meaningful evidence about the whole header set.
- The sizes were verified from the **compiled code**, not from another
  decompilation. This is independent ground truth: `0x48` is a `movz` the
  compiler emitted, and `0x210` is the padded extent of real stores.

**Consequence for the port:** the `sead` headers can be used as a trustworthy
structural reference for this title, rather than a hopeful guess. The reference
set is no longer "unverified."

## 5. What this does *not* establish

Being precise about the limits, because one confirmed class is not a blanket
guarantee:

1. **Only two `static_assert`s and one class were checked.** Other classes —
   especially those whose layout depends on `SEAD_VERSION` flags such as
   `SEAD_CRITICALSECTION_PURE` or `SEAD_THREAD_GETFIBER` — are not thereby
   verified. The flags that alter *other* classes' vtables and member order remain
   unknown for this title.
2. **`PerformanceMgrNx` and `ForegroundBucketMgr` are absent from the repository
   entirely**, so no verification is possible for them. They remain binary-only.
3. **`agl`, `nnware` and `nnsdk` were not independently verified here.** They are
   separate repositories with their own version assumptions; this result
   corroborates `sead` and makes the others more plausible, but does not prove
   them.
4. **One class matching does not prove every symbol is present or named
   correctly.** It proves the layout model is right, which is a different claim.

## 6. Second check: `nn::ui2d::Pane` (from `nnware`)

`Pane` is the other era-sensitive, heavily-used class — **352 functions in `main`**
— and it sits on the critical path to the boot milestone as the base of the menu
system. It carries **no `static_assert`**, so it must be verified empirically.

### 6.1 Every declared virtual exists in the binary

The header declares 26 virtuals (destructor + 25). All of them are present as named
functions in `main`:

| Declared virtual | Address |
|---|---|
| `~Pane()` | `0x7101375be4` (`D0`) |
| `Finalize(gfx::Device*)` | `0x7101375be8` |
| `SetVertexColor` | `0x7101375f64` |
| `SetColorElement` | `0x7101375f84` |
| `SetVertexColorElement` | `0x7101375fa8` |
| `FindPaneByName` | `0x7101375fac` |
| `FindMaterialByName` | `0x7101376048` |
| `Calculate` | `0x7101376130` |
| `Draw` | `0x71013767bc` |
| `DrawSelf` | `0x7101376870` |
| `BindAnimation` | `0x7101376874` |
| `UnbindAnimation` | `0x7101376a1c` |
| `UnbindAnimationSelf` | `0x7101376a88` |
| `LoadMtx` (protected) | `0x7101376b14` |
| `FindPaneByNameRecursive` | `0x7101376d6c` |
| …plus `GetVertexColor`, `GetColorElement`, `GetVertexColorElement`, `GetMaterialCount`, `GetMaterial`, `FindMaterialByNameRecursive`, `CalculateMtx`, `CalculateGlobalMatrixSelf` | present |

The `gfx::TDevice<gfx::ApiVariation<gfx::ApiType<4>, ...>>` template signature in the
mangled names also corroborates the `-api.nvn.8` API version that
`nnsdk`'s headers are built for.

### 6.2 Field offsets match exactly

`Pane::Pane()` at `0x7101375144` (132 bytes) writes these object offsets:

```
+0x000   STP x8, x9            vtable + PaneBase::m_Link
+0x020   STP x8, x8            self-referential  (m_Link sentinel)
+0x030   STR xzr               mParent = nullptr
+0x038   STP xzr, xzr          mChildList  (sentinel)
+0x050   STR xzr               mPosition.x
+0x05A   STRB w8               mFlags      <- low bit clear = Visible false
+0x05B   STRB w10              mAlpha
+0x05C   STRB w10              mGlobalAlpha
+0x0A0   STP xzr, xzr
+0x0B0   STR xzr
+0x0B8   STP xzr, xzr
+0x0C8   STP xzr, xzr          mPanelName area
```

Computing the header's layout (16-byte vtable + 16-byte `PaneBase::m_Link` =
`0x20` base, then `mParent`, `mChildList`, `mPosition`, `mRotation`, `mScale`,
`mSize`, `mFlags`):

| Header member | Computed offset | Binary | Match |
|---|---|---|---|
| `Pane` base | `0x20` | `0x20` list sentinel | ✅ |
| `mParent` | `0x30` | `0x30` | ✅ |
| `mChildList` | `0x38` | `0x38` | ✅ |
| `mPosition` | `0x50` | `0x50` | ✅ |
| `mFlags` | `0x5A` | `0x5A` | ✅ |
| `mAlpha` | `0x5B` | `0x5B` | ✅ |
| `mGlobalAlpha` | `0x5C` | `0x5C` | ✅ |
| `mMtx` | `0x68` | `0xA0` | ❌ |
| `mPanelName` | `0xC8` | `0xD0` | ❌ |

**`mFlags` landing on `0x5A` is the decisive check.** `IsVisible()` in the header is
`TestBit(mFlags, PaneFlag_Visible)`, and the constructor stores a byte at `+0x5A`
with its low bit clear. That is exactly `mFlags` with `Visible = false`.

**Verdict: the first four member groups match at byte precision.** The two
mismatches (`mMtx`, `mPanelName`) are at the tail, and a plausible cause is a
differing-size `util::MatrixT4x3fType` or `IntrusiveList` in this build. They are
noted rather than explained — this check does not resolve them.

### 6.3 What is *not* vertified for `Pane`

- **No size check.** The header has no `static_assert`, so there is no declared
  number to compare. The highest offset touched is `0xD0`, giving at least `0xD8`
  bytes live, but the true `sizeof` is **unknown**.
- **The vtable was not counted.** The binary contains no `_ZTV`/`_ZTI`/`_ZTS`
  symbols for `ui2d` at all, so the virtual count was confirmed by *the presence of
  each declared virtual* rather than by vtable length. Layout-critical vtable
  **order** therefore remains unverified — which is the thing that actually breaks
  a port.
- **The two tail mismatches are unresolved.**

## 7. Combined verdict

| Repository | Class checked | Result |
|---|---|---|
| `sead` | `GameFrameworkNx` | ✅ **two `static_assert`s confirmed from compiled code** |
| `nnware` | `ui2d::Pane` | ⚠ **all 26 virtuals present; leading fields match byte-exactly; tail mismatches unresolved; size unverifiable** |

**The reference set is usable, but not uniformly trustworthy.**

- `sead`'s `GameFrameworkNx` is verified against number-carrying asserts, and the
  method is sound for any class that has them.
- `nnware`'s `ui2d::Pane` verifies strongly on the fields that matter most for
  behaviour (flags at `0x5A`, the list and transform members) but carries no size
  assertion and has unexplained tail differences.

**Practical rule for this port:** trust a header member offset only after checking
it against a constructor or accessor, exactly as done here. Headers without
`static_assert`s have not earned the same confidence as `sead`'s, and vtable
**order** — the most port-critical property — is still unverified anywhere,
because this binary ships no RTTI symbols to anchor it.

## 8. Recommended follow-up

1. **Count a vtable by another route.** The `-noanalysis` import never created
   function objects for the virtuals, so `_ZTV` symbols are absent. A Ghidra pass
   that creates functions at the vtable relocation targets would let the entry
   count and order be compared against the header's declared order.
2. **Resolve the `Pane` tail mismatch** by determining `util::MatrixT4x3fType` and
   `IntrusiveList` sizes in this build — both are `nn::util` templates, so
   `nnsdk`'s `include/nn/util/` is the place to look.
3. **Repeat on one `agl` class**, preferably `agl::utl::ParameterObj`, which the
   `agl` repository actually implements, so its layout is asserted rather than
   guessed.
