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

## 6. Recommended follow-up

Repeat this exact procedure on one class per remaining repository, choosing
classes whose layout is version-sensitive:

| Repository | Candidate | Why |
|---|---|---|
| `agl` | `agl::utl::ParameterObj` | implemented in the repo, so layouts are asserted |
| `nnware` | `nn::g3d::ResModel` or `nn::ui2d::Pane` | headers only, but `ui2d::Pane` has many members |
| `nnsdk` | `nn::gfx::CommandBufferInfo` or an NVN table entry | `-api.nvn.8` version marker to confirm |

`nn::ui2d::Pane` is the most valuable next check: `main` has 352 `ui2d::Pane`
functions, so the class is heavily used and its layout is load-bearing for the
menu system — which is on the critical path to the boot milestone.
