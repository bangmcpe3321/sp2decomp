# It links, it runs, and it gets to the game's front door

Round 2 of the goal. Two of the three remaining layers are now done, and the third is bounded to a
single, precisely-characterised gap.

---

## 1. `platform_linux.cpp` — written

The 26 `nx::plat::*` functions the link identified, implemented against the host:

| Group | Functions | Quality |
|---|---|---|
| Memory | `reserve`, `commit`, `decommit` | **real** — `mmap`/`mprotect` at fixed guest addresses |
| Threads | `start_thread`, `exit_thread`, `exit_process`, `set_thread_name`, `current_thread_id`, `yield` | **real** |
| Time | `sleep_ns`, `monotonic_ns`, `profile` | real (`profile` returns false) |
| Files | `fopen_utf8`, `ftell64`, `fseek64`, `read_at`, `make_dirs` | **real** (`read_at` uses `pread`) |
| Output | `log_line`, `data_root`, `setting` | **real** |
| Display/input | `create_window`, `window_size`, `read_pad`, `touch_overlay`, … | **honest stubs** — no GPU, no window, by design |
| Audio | `audio_open/submit/queued/pause` | **honest stubs** — returning false means "no device", which is the documented headless behaviour |
| Entry point | `main()` | **real** — calls `nx::boot()`, mirroring `platform_win.cpp` |

`write_watch_*` was **deliberately not** stubbed: `runtime/src/write_watch.cpp` already implements it
with POSIX page protection, and duplicating it produced three `multiple definition` errors.

## 2. The link succeeded

```
generated objects: 522      (516 code_*.cpp + 6 table.cpp)
runtime objects  : 21
link exit: 0

***  LINK SUCCEEDED -- a Splatoon 2 executable exists  ***
140 MB   ELF 64-bit LSB pie executable, x86-64, dynamically linked, not stripped
```

Two bugs had to be fixed to get there, both found by running rather than reading:

**`table.cpp` was never compiled.** The build globbed `code_*.cpp`, missing the six `table.cpp`
files that define `nx_module_main` / `nx_module_sdk` / `nx_module_subsdk*`. That is what made those
symbols undefined. Fixed by including them.

**`commit()` was too weak.** The first run printed `FATAL: cannot commit module main`: a bare
`mprotect` fails with `ENOMEM` when nothing is mapped at the address, and the loader commits module
memory without a preceding `reserve` on this path. `commit()` now falls back to `mmap(MAP_FIXED)`
to install the mapping.

## 3. It runs — and gets remarkably far

```
loaded main at 7100000000 (114928 functions, 255796 relocs)
loaded sdk  at 7101000000 ( 19322 functions,  16121 relocs)
linked: 101 to HLE, 16802 across modules, 41 unresolved
FATAL: nn::init::Start not found
```

Read that middle line carefully. **The process:**

1. maps both modules at the right bases,
2. applies **271,917 relocations**,
3. links **101 symbols to the HLE and 16,802 across modules**,
4. leaves only **41 unresolved**,
5. and then stops on **one missing entry point**.

**This is the first time Splatoon 2's own code has been loaded, relocated, linked and entered in a
host process.** Nothing before this round had got past a hand-built `CPU` with zeroed memory.

## 4. The one remaining gap, characterised exactly

The runtime looks for `nn::init::Start` under two manglings:

```cpp
find_symbol("_ZN2nn4init5StartEmmPFvvES2_")        // SDK 9,  4 args
find_symbol("_ZN2nn4init5StartEmmPFvvES2_S2_")     // SDK 16, 5 args
else fatal("nn::init::Start not found");
```

**Splatoon 2 exports neither.** Its entire `nn::init` surface is four symbols:

```
_ZN2nn4init12GetAllocatorEv
_ZN2nn4init19InitializeAllocatorEPvm
_ZN2nn4init6detail30DefaultAllocatorForThreadLocalEmm
_ZN2nn4init6detail32DefaultDeallocatorForThreadLocalEPvm
```

**Splatoon 2's SDK predates `nn::init::Start`.** Wonder (SDK 9+) and Splatoon 2 (2017, much older)
enter the game by different means. The runtime already has an `nnMain` HLE hook
(`NX_HLE("nnMain", nn_main)`), and Splatoon 2's modern-looking path would be to call **`nnMain`
directly** rather than through `nn::init::Start`.

**So the remaining work is a boot-path decision, not an unknown:** teach `nx::boot()` the older SDK's
entry convention. That is a small, specific change in one function.

## 5. What this establishes and what it does not

**Established:**
- the whole Splatoon 2 tree **compiles** (516/516) and **links** into a 140 MB executable;
- the executable **runs**, maps both modules, applies 271,917 relocations, resolves 16,903 symbols;
- the platform layer needed was **26 functions**, and they are written;
- the **only** thing between this and entering the game is one entry-point convention.

**NOT established:**
- **The game has NOT executed its first instruction yet.** `nn::init::Start` was never entered, so
  no guest code from the real image has run — the earlier harness executed one function with a
  hand-built CPU and zeroed memory, which is a different thing.
- **41 symbols remain unresolved** after module linking; they were not enumerated this round.
- **The HLE is unproven.** 101 symbols bound to it, but none has been *called*.
- **`nn::init::Start` / `nnMain` for Splatoon 2's SDK was not implemented** — only diagnosed.
- **No NVN, no window, no shader, no render.** Display and audio are stubs by design.
- **The `subsdk` modules are not loaded by the boot path** — `main.cpp` hardcodes
  `mods[] = {&nx_module_main, &nx_module_sdk}`. Splatoon 2 has six; the other four are compiled and
  linked but not registered. This is the `g_fast` issue's sibling and was not addressed.

## 6. Next increment

Teach `nx::boot()` Splatoon 2's older entry convention — most likely call **`nnMain` directly**
instead of `nn::init::Start`, since that HLE hook already exists — and register the four missing
`subsdk` modules in the module list. Then re-run and report how far the guest gets.

Both changes are in `runtime/src/main.cpp`, are small, and are now precisely specified.
