# Module bases fixed; the 34 unresolved imports named

Round 4. The base collision from round 3 is **fixed**, the failure moved, and the 34 unresolved
imports are now **enumerated**.

---

## 1. The base collision is fixed

Regenerated all six modules with a **64 MB stride** instead of 16 MB, which is larger than `main`'s
own 57 MB span:

| Module | Old base | **New base** | Table encoding |
|---|---|---|---|
| `main` | `0x7100000000` | `0x7100000000` | `NX_BASE + 0x3100000000` |
| `sdk` | `0x7101000000` | `0x7140000000` | `NX_BASE + 0x3140000000` |
| `subsdk0` | `0x7102000000` | `0x7180000000` | `NX_BASE + 0x3180000000` |
| `subsdk1` | `0x7104000000` | `0x71c0000000` | `NX_BASE + 0x31c0000000` |
| `subsdk2` | `0x7106000000` | `0x7200000000` | `NX_BASE + 0x3200000000` |
| `subsdk3` | `0x7108000000` | `0x7240000000` | `NX_BASE + 0x3240000000` |

All six recompiled with **zero unhandled instructions** again (140,899 functions total), all 522
objects rebuilt from scratch with **0 failures**, relinked to 140 MB, and the run now shows:

```
loaded main    at 7100000000
loaded sdk     at 7140000000
loaded subsdk0 at 7180000000
loaded subsdk1 at 71c0000000
loaded subsdk2 at 7200000000
loaded subsdk3 at 7240000000
linked: 116 to HLE, 23913 across modules, 34 unresolved
```

**No overlap.** The round-3 fault (`main+1000030`, which was inside `sdk`) is gone.

## 2. The failure moved — and it moved EARLIER

```
FATAL: call into the middle of a function: sdk+30 (_init+c) (lr hle:__process_return)
```

Round 3 got as far as `gsys::ModelUnit::calcDrawArray_`. Now it stops at `sdk+0x30`, described as
`_init+0xc`.

**This is progress, not regression, and it is worth being precise about why.** In round 3 the modules
*overlapped*, so `sdk` was mapped **over** `main`'s text. The code that ran "successfully" up to
`calcDrawArray_` was running against a corrupted address space; the first bad indirect call happened
to land inside `sdk`'s overlapping range. With correct bases the address space is sound, and the run
dies at the **first genuinely bad indirect call** instead — which is a real bug being surfaced rather
than masked.

## 3. The 34 unresolved imports — enumerated

The runtime reported a count but not names. Patched `loader.cpp` to record and print them. **All 34:**

| Kind | Count | Names |
|---|---:|---|
| **Linker section markers** | **24** | `__rel_dyn_start`, `__rel_dyn_end`, `__rel_plt_start`, `__rel_plt_end` — four per module × six modules |
| **`glslc*` shader compiler** | **9** | `glslcCompile`, `glslcCompilePreSpecialized`, `glslcCompileSpecialized`, `glslcFinalize`, `glslcGetDefaultOptions`, `glslcGetVersion`, `glslcInitialize`, `glslcSetAllocator` |
| **SDK exception stack** | **1** | `nnosGetDefaultUserExceptionStackForApplication` (sdk, reported twice) |

**24 of the 34 are NOT functions** — they are ELF section boundary symbols (`__rel_*`), which no
program calls. Their being unresolved is **expected and harmless**.

**The 9 `glslc*` symbols are a genuine finding.** They are the **GLSL shader compiler** — the tool a
game uses to compile shaders *at runtime*. Splatoon 2's `main` references them. If the game ever
calls `glslcCompile`, it will hit the missing-import stub. Whether Splatoon 2 compiles shaders at
runtime (rather than shipping pre-compiled Maxwell code) is **not established**, and shaders are
explicitly out of scope for this goal — but this is the first *concrete, named* shader-adjacent
dependency the project has found in the binary.

## 4. So the 34 are NOT the cause

They are mostly markers. That means the `sdk+30 (_init+c)` fault has a different cause. The most
likely candidate, from reading `main.cpp`:

```cpp
static void init_module(CPU& c, const ModuleInfo& m) {
    for (size_t k = 0; k < m.init_count; k++) call_preserving(c, m.base + m.init_array[k]);
}
```

`init_module(sdk)` calls **every entry of sdk's `init_array`** as a function. If any entry is not a
function start — or if `_init` itself is not treated as a function boundary by the recompiler — the
call lands mid-function, which is exactly the reported fault (`_init+0xc`).

**This is a hypothesis, not a conclusion.** It was not tested this round.

## 5. What this round establishes

| Item | State |
|---|---|
| Module bases non-overlapping | ✅ fixed, verified in the load lines |
| All modules recompiled with new bases | ✅ 0 unhandled, 522 objects, 0 failures |
| Link still succeeds | ✅ 140 MB |
| Round-3 overlap fault | ✅ gone |
| 34 unresolved imports | ✅ **enumerated and categorised** |
| Real (non-marker) unresolved | ✅ **10**: 9 `glslc*` + 1 `nnos*` |
| `sdk+30` fault | ❌ diagnosed, **not fixed** |

## 6. What this does NOT establish

- **It still does not run past `nnMain`'s module initialisation.** No game initialisation completes.
- **The `init_array` hypothesis was not tested.**
- **The `glslc*` symbols were not investigated** — whether Splatoon 2 compiles shaders at runtime is
  unknown, and shaders are out of scope for this goal.
- **The HLE remains unexercised** — 116 symbols bound, no service call reached.
- **No NVN, no window, no render.**
- **The 24 `__rel_*` markers were not given definitions** — they are believed harmless, not proven so.

## 7. Next increment

Test the `init_array` hypothesis: log each entry `init_module` is about to call, with its offset, for
the `sdk` module. If an entry is not a function start, that is the bug and it is in the generated
`init_array` or in how `_init` is handled. This is a small, targeted diagnostic on the exact code
path that faults.
