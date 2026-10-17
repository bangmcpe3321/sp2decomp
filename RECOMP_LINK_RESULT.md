# The link: 31 symbols from a complete binary

`RECOMP_FIRST_EXECUTION.md` proved one guest function runs. This round did steps 2 and 3 of the
goal — compile everything, link, enumerate what is missing — and the answer is remarkably small.

---

## 1. Everything compiles

| Set | Count | Result |
|---|---:|---|
| Generated `main` | 433 | ✅ all compiled |
| Generated `sdk` | 60 | ✅ all compiled |
| Generated `subsdk0..3` | 16 + 2 + 1 + 4 = 23 | ✅ all compiled |
| **Generated total** | **516** | **516 / 516, ZERO failures** |
| Runtime core (no platform, no NVN) | 19 | 18 compiled; 1 fixed |

129 MB of objects. The one runtime failure was a **genuine header-hygiene bug in the MIT
runtime**: `runtime/src/hle_fs.cpp` uses `std::vector` without `#include <vector>`. Patched with a
single line (recorded, with attribution, alongside the `g_fast` patch).

## 2. The symbol analysis: 12 missing, all standard library

Across 516 generated + 18 runtime objects: **142,562 defined symbols**, 30,027 undefined in
generated objects, 205 in runtime objects — and after subtracting everything defined somewhere,
**only 12 symbols are genuinely missing**:

```
__cxa_guard_acquire   __cxa_guard_release   __popcountdi2   __stack_chk_fail
fmaf   nearbyint   nearbyintf   round   roundf   sqrt   sqrtf   truncf
```

**Every one is libc / libm / libgcc.** Not one `nn::*`, not one `nx::*`, not one NVN symbol.

**Important and unexpected:** `nn::*` HLE imports **do not appear as link errors at all**. Wonder's
HLE is a **name registry** (`std::unordered_map<std::string, HleFn>`), not symbol linkage. So
missing HLE implementations would surface at *runtime* as unimplemented-import messages, not at
link time. The goal's step 3 assumed symbol-based HLE; that assumption was wrong and is corrected
here.

## 3. The real link: 31 symbols from a binary

Linking all 516 generated objects + the runtime core + `-lm -lc -lgcc -lpthread -ldl` produced
**31 distinct undefined symbols**:

| Category | Count |
|---|---:|
| **`nx::plat::*` — the platform layer** | **26** |
| Per-game glue (`main`, `nx::game::after_init`, `nx::game::kInfo`, `nx_module_main`, `nx_module_sdk`) | 5 |
| `nn::*` (HLE) | **0** |
| `nvn` / `NVN` | **0** |
| Other | **0** |

### The 26 platform functions — the complete work list

```
nx::plat::commit / reserve / decommit     memory mapping
nx::plat::start_thread / exit_thread / current_thread_id / set_thread_name / yield
nx::plat::sleep_ns / monotonic_ns          timing
nx::plat::create_window / release_window / window_minimized
nx::plat::read_pad(nx::plat::PadState&)    input
nx::plat::audio_open / audio_submit / audio_queued
nx::plat::fopen_utf8 / fseek64 / ftell64 / read_at   file I/O
nx::plat::log_line / exit_process
nx::plat::data_root / setting / profile
```

**This is the `platform_linux.cpp` the MIT README said was missing** — and it is the *only* layer
between this tree and a linked executable.

### The 5 glue symbols

- `main` — the entry point
- `nx::game::after_init()` — per-game post-init hook
- `nx::game::kInfo` — the game info struct (title id, module list)
- `nx_module_main`, `nx_module_sdk` — the generated `ModuleInfo` externs

**`nx_module_main` and `nx_module_sdk` almost certainly already exist** in the generated
`table.cpp` files, but as `static const` — TU-local. Exposing them is **wiring, not work**. That
leaves a genuinely small `game.cpp`.

## 4. Why this is the most important measurement so far

Before this round, "how far from a binary?" was an estimate. It is now a count:

> **31 symbols. 26 are the platform layer. 5 are glue. Zero are HLE. Zero are NVN.**

And the 26 platform functions are **exactly the kind of surface this repository already has
verified work for**: the port under `port/` implements `nn::os`, `nn::fs`, `nn::vi` and timing over
host primitives, cross-verified on x86-64 and aarch64. **That is the reference shape for all 26.**

## 5. What this does NOT establish

- **Nothing was linked into a working binary.** The 31 symbols are precisely why.
- **`nx::plat::*` was not implemented.** Only enumerated.
- **The HLE is untested at runtime.** Since it binds by name, whether Splatoon 2's imports resolve
  is a *runtime* question this link cannot answer.
- **No NVN** — and the link says none is needed *to link*, because NVN is name-registered too.
  Rendering still needs it, and shaders are out of scope.
- **No game glue** — `game.cpp` for Splatoon 2 does not exist.
- **The runtime's `main.cpp` needs the platform layer** (`nx::plat::create_window` etc.), so it
  cannot run yet even in headless form.
- **Only the `main` module's real image was not mapped** — guest memory in the earlier harness was
  zero-filled, not loaded from the NSO, and that is still true.

## 6. The next increment

Write `platform_linux.cpp` implementing the 26 `nx::plat::*` functions — the repository's `port/`
layer is the reference for the semantics, and most of them are thin host wrappers. Then write a
minimal Splatoon 2 `game.cpp` exposing the generated `ModuleInfo` tables, and the tree links.

**That is a bounded, enumerable task — not a research question.**
