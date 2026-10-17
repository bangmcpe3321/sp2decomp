# Splatoon 2 executes its own guest code

Round 3 of the goal. **The milestone is reached**: the recompiled game entered `nnMain` and ran its
own code — including a real engine function — for the first time.

---

## 1. The run

```
loaded main    at 7100000000 (114928 functions, 255796 relocs)
loaded sdk     at 7101000000 ( 19322 functions,  16121 relocs)
loaded subsdk0 at 7102000000 (  5034 functions,  11060 relocs)
loaded subsdk1 at 7104000000 (   582 functions,    542 relocs)
loaded subsdk2 at 7106000000 (   105 functions,     79 relocs)
loaded subsdk3 at 7108000000 (   928 functions,    674 relocs)
linked: 116 to HLE, 23913 across modules, 34 unresolved
nn::init::Start absent -- older SDK; entering through nnMain
  ...registers at the fault...
FATAL: call into the middle of a function: main+1000030
       (_ZN4gsys9ModelUnit14calcDrawArray_ILb1ELb1ELb1ELb1EEEbPNS_16ModelQueueResultEPNS_10ModelSceneEji+434)
       (lr hle:__process_return)
```

**All six modules loaded** (271,917 relocations total), **24,029 symbols linked**, and then
**`nnMain` was entered and Splatoon 2's own code ran** — deep enough to reach
`gsys::ModelUnit::calcDrawArray_`, a real engine function that walks a model queue and emits draw
arrays.

That is the first execution of the actual game's instructions in a host process.

## 2. Three fixes made this possible

**Six modules instead of two.** `boot()` hardcoded `mods[] = {&nx_module_main, &nx_module_sdk}`, so
the four `subsdk` modules were compiled, linked, and never loaded. Now all six are registered —
`116 to HLE, 23913 across modules`, up from `101 / 16802`.

**Splatoon 2's older entry convention.** Splatoon 2's SDK predates `nn::init::Start` and exports no
such symbol, so Wonder's runtime died on it. The boot now falls back to entering through the game's
own **`nnMain`** — which the existing `nnMain` HLE hook already knows how to prepare (run the
modules' constructors, then call the real `nnMain`).

**Global-scope `ModuleInfo` externs.** The generated tables define `nx_module_subsdkN` at **global**
scope, so declaring them inside `namespace nx` named `nx::nx_module_subsdkN` and did not match. The
declarations and references now use explicit `::` scope. Verified with `nm`: the objects export
`D nx_module_subsdk0`, unqualified.

## 3. The next real bug: module bases OVERLAP

```
FATAL: call into the middle of a function: main+1000030
```

`main+0x1000030` is `0x7101000030` — **which is inside `sdk`'s range**, because `sdk` was placed at
`0x7101000000`, only 16 MB above `main`'s base.

**This is not a random fault; it is a layout collision:**

| Module | Base | Text size | Ends at |
|---|---:|---:|---:|
| `main` | `0x7100000000` | `0x1415068` (21 MB) | `0x7101415068` text, `~0x7103699e50` incl. bss |
| `sdk` | `0x7101000000` | — | **starts inside `main`'s span** |

The 16 MB stride used when the modules were generated is **smaller than `main`'s own size**, so
`sdk` and the `subsdk`s are mapped *over* `main`'s text and data. The recompiled code then computes
a target that lands in the wrong module, and `nx::call` correctly reports "call into the middle of a
function" rather than executing garbage.

**Note this is the same class of problem as the `g_fast[4]` limit**: a fixed-size assumption that
happens to hold for Wonder and not for Splatoon 2. It is also *exactly the kind of thing the
fail-loudly check is for* — the runtime caught it and named the function, rather than corrupting
state silently.

**The fix is a regeneration with non-overlapping bases** (a 64 MB stride is ample for `main`'s
21 MB text), then a recompile of the 516 translation units. That is mechanical, and it is the next
increment.

## 4. What this establishes

| Milestone | State |
|---|---|
| All modules recompiled | ✅ 140,899 functions, 0 unhandled |
| All modules compile | ✅ 516/516 |
| All modules **link** | ✅ 140 MB x86-64 executable |
| All modules **load + relocate** | ✅ 271,917 relocations |
| Symbols resolve | ✅ 24,029 linked, 34 unresolved |
| **Guest code EXECUTES** | ✅ **entered `nnMain`, ran `gsys::ModelUnit::calcDrawArray_`** |
| Runs to completion | ❌ stops on the base collision |

## 5. What this does NOT establish

- **It does not run far.** It reached one engine function and hit a layout collision. The game has
  not booted, has not initialised, has not drawn.
- **34 symbols remain unresolved** after module linking; they were not enumerated.
- **The HLE was bound but is largely unexercised** — 116 symbols bound, and the run never reached a
  service call that mattered.
- **No NVN, no window, no shader, no render.** Display and audio are stubs by design, and this goal
  excludes shaders.
- **The base collision was not fixed** — only diagnosed.
- **`gsys::ModelUnit::calcDrawArray_` being reached does not mean rendering works**; it means the
  code path got there and then took a bad indirect branch.
- Register state at the fault is printed but **was not analysed** — the immediate cause could be the
  base collision *or* a data-dependent path through the zeroed/relocated image.

## 6. Next increment

Regenerate all six modules with **non-overlapping bases** (≥ 64 MB stride), recompile, relink, and
re-run. Then report how much further the guest gets. Everything needed is scripted under
`tools/wsl/`.
