# The resolver question — answered: the function table is GENERATED per game

`RECOMP_EXTERNALS.md` closed by calling this "the single most important open question": whether
`nx::call`'s indirect-branch resolver is hardcoded to Wonder, or generic enough for a foreign game.
If hardcoded, the recompilation path stops one layer short of running.

**It is generic. The table is generated per game, and Splatoon 2 already has one.**

---

## 1. How `nx::call` resolves a target

`runtime/src/loader.cpp`:

```cpp
struct FastModule {
    uint64_t base, text_size;
    const Fn* table;
};
FastModule g_fast[4];

void call(CPU& c, uint64_t t) {
    for (size_t k = 0; k < g_fast_count; k++) {
        const FastModule& m = g_fast[k];
        uint64_t off = t - m.base;
        if (off < m.text_size) [[likely]] {
            Fn fn = m.table[off >> 2];          // <-- indexed by (target - base) / 4
            if (!fn) { ...fatal("call into the middle of a function")... }
            fn(c);
            return;
        }
    }
    // ... falls through to the HLE thunk table (imported nn::* functions)
}
```

`table[]` is a **flat array indexed by `(target - base) / 4`** — one `Fn` per 4-byte slot of the
module's `.text`. No hashing, no symbol names, no per-game special-casing.

## 2. Where the table comes from — generated, not hardcoded

```cpp
LoadedModule lm{mi, mi->base, size, new Fn[mi->text_size / 4]()};
for (size_t k = 0; k < mi->func_count; k++)
    lm.table[mi->funcs[k].offset / 4] = mi->funcs[k].fn;
g_modules.push_back(lm);
if (g_fast_count < 4) g_fast[g_fast_count++] = {lm.base, mi->text_size, lm.table};
```

The table is filled from `mi->funcs[]` — **the recompiler's generated per-module data.** It is not
a Wonder-specific list.

## 3. And Splatoon 2's table was already generated

The recompiler emitted it in the run recorded in `RECOMP_EXPERIMENT.md`:

```
/home/hexa/sp2recomp/gen/table.cpp    26,602,991 bytes    517,370 lines
```

```
#include "funcs.h"
#include <nx/module.h>

static const nx::FuncEntry funcs[] = {
    {0x0, main_00000000},
    {0x24, main_00000024},
    {0x160, main_00000160},
    {0x194, main_00000194},
    ...
```

| Property | Value |
|---|---:|
| Entries naming a `main_*` function | **114,928** |
| Distinct `main_*` referenced | **114,928** |
| Module function count (report) | **114,928** |

**The counts match exactly — one table entry per function, no gaps.** The generated type is
`nx::FuncEntry` from `nx/module.h`, i.e. the framework's own structure, which is what the loader
expects. This is not a coincidence; it is the design.

## 4. Conclusion

**The indirect-branch resolver is generic and Splatoon 2's table is complete.**

That removes what was described as the decisive blocker. Combined with the earlier results:

| Question | Answer |
|---|---|
| Does the recompiler handle Splatoon 2's code? | **Yes** — 140,899 functions, 0 unhandled |
| Is the output valid C++? | **Yes** — sampled units compile |
| Is the external surface small? | **Yes** — ~35 helpers + `memcpy` |
| Is the resolver game-specific? | **No** — table generated per game |
| Is Splatoon 2's table complete? | **Yes** — 114,928/114,928 entries |

**Nothing found so far blocks Splatoon 2 on this path.**

## 5. What is still genuinely unknown

The resolver was the biggest question; it is now answered. What remains is real but of a different
character — **work, not unknowns**:

- **The HLE layer.** `call()` falls through to a thunk table of imported `nn::*` functions.
  Splatoon 2's imports differ from Wonder's, and its `sdk` module's service set is unexamined.
- **NVN.** `runtime/src/nvn/` is Wonder-shaped; whether it serves Splatoon 2's NVN usage is
  untested. `NVN_BOOT_SUBSET.md` says ~33 functions on the boot path, which is encouraging.
- **Shaders.** Splatoon 2's Maxwell shaders are its own. Wonder's 12,717-block translation does not
  apply. **This is the largest untouched area.**
- **The game glue.** `games/wonder/game.cpp` is per-game; Splatoon 2 would need its own.
- **`nx::CPU` layout** was never compared field-by-field against what the generated code assumes.
- **Nothing has been linked or executed.** These remain static measurements.

## 6. Method note

This took **one read of one function** to answer. It was not answered by scanning, cross-referencing
or instrumentation — the same lesson as `NVN_DEVICE_CREATION.md`, and now the **fifth** time in this
project that reading beat scanning.

The question was also well-posed *because* the previous measurement had narrowed it to a single
symbol: `RECOMP_EXTERNALS.md` did not ask "does the runtime work?" but "is `nx::call`'s table
per-game?" That specificity is what made it a five-minute answer instead of another failed scan.

## 7. Limits

- **`nx::FuncEntry`'s exact definition was not read** — only its use. The `offset / 4` indexing is
  confirmed at the consumer side (`loader.cpp`), not the producer side.
- **4 modules maximum** (`g_fast[4]`). Splatoon 2 has **6** (`main`, `sdk`, `subsdk0..3`), which
  would exceed that array. **This is a concrete, checkable incompatibility** and the next thing to
  examine.
- **The HLE thunk path was not examined**, so how imports are bound for a foreign game is unknown.
- **No link, no run.** Everything here is static.
