# `g_fast[4]` — a confirmed, one-line incompatibility

`RECOMP_RESOLVER.md` §7 flagged a module limit in the recompiler runtime and called it "the next
thing to examine". **It is confirmed, and it is real.**

---

## 1. The code

`runtime/src/loader.cpp`:

```cpp
// line 160-161
FastModule g_fast[4];
size_t g_fast_count = 0;

// line 164  -- call() only ever consults this fixed array
void call(CPU& c, uint64_t t) {
    for (size_t k = 0; k < g_fast_count; k++) { ... }
    // ... falls through to the HLE thunk table
}

// line 232  -- registration, SILENTLY SKIPPING anything past the 4th
g_modules.push_back(lm);
if (g_fast_count < 4) g_fast[g_fast_count++] = {lm.base, mi->text_size, lm.table};
```

**Four is a hard limit.** The `if (g_fast_count < 4)` guard means the 5th and 6th modules are
**never registered for indirect-call resolution, with no diagnostic.** `g_modules` (a vector) holds
all of them, but `call()` does not consult it — only `g_fast`.

## 2. Splatoon 2 has six modules

| Module | Size |
|---|---:|
| `main` | 23,717,627 B |
| `sdk` | 3,032,664 B |
| `subsdk0` | 787,508 B |
| `subsdk1` | 67,223 B |
| `subsdk2` | 49,096 B |
| `subsdk3` | 174,009 B |

**6 modules against a limit of 4.** Two would be dropped.

## 3. The precise consequence

- **Direct calls are unaffected.** A direct `bl` is emitted as a direct C++ call
  (`main_00123456(c)`), which needs no table.
- **Indirect calls are affected.** All 77,764 `nx::call` sites resolve through `g_fast`. If the
  *target* lives in an unregistered module, `off < m.text_size` never matches for it, the call falls
  through to the HLE thunk path, and fails — with the runtime's `"call into the middle of a
  function"` fatal or a worse thunk mismatch.

**So the damage depends on whether any `blr` targets a function in modules 5–6.** That is
**statistically likely** for `sdk` (which implements services the game calls through vtables) but is
**not measured** here.

## 4. Which modules get dropped is a choice the PORT makes

`load_modules(const ModuleInfo* const* mods, size_t count, const std::string& data_dir)` takes an
**array of module pointers from the caller** — in Wonder's case the game glue. So the order is a
decision Splatoon 2's glue would make, not something inherent.

That means a port could **order the array to put `main` and `sdk` first**, keeping the two most
important modules in the fast path. **That is a workaround, not a fix** — it buys functionality at
the cost of silently losing indirect calls into two small `subsdk` modules, which is exactly the
kind of silent gap this project has been careful to avoid.

## 5. The fix is one line

```cpp
FastModule g_fast[8];          // or 16; or make it a std::vector
...
if (g_fast_count < 8) g_fast[g_fast_count++] = ...
```

`FastModule` is `{uint64_t base, text_size; const Fn* table;}` — 24 bytes. Raising the bound from
4 to 8 costs **96 additional bytes** and removes the limitation entirely.

**It is MIT-licensed code**, so this is legally a trivial patch with attribution. But it *is* a
modification to a third-party project, which should be recorded as a patch rather than assumed —
and it may already be fixed upstream or in the sibling `SwitchGamesRecomp` repository where the
shared runtime lives.

## 6. What this means for the overall assessment

This is the **first genuine incompatibility found** in the whole recompilation path, and it is:

- **confirmed by reading the code**, not suspected
- **narrow** — one array bound
- **cheap to fix** — 96 bytes
- **not architectural**

Contrast with what has been ruled out:

| Concern | Status |
|---|---|
| Recompiler handles Splatoon 2's instructions | **No gaps** — 0 unhandled in 6 modules |
| Generated C++ validity | **Compiles** |
| External surface size | **~35 helpers + `memcpy`** |
| Resolver game-specific | **No** — table generated per game |
| Splatoon 2's function table | **Complete** — 114,928/114,928 |
| Module count | **Fails at 6 > 4** — but a one-line fix |

**Every remaining blocker found so far is small and local.**

## 7. Limits

- **Whether an indirect call actually targets modules 5–6 was NOT measured.** That requires a link
  and a run, or a static analysis of `blr` targets across modules, neither of which was done.
- **The `mods[]` order for Splatoon 2 was not established** — the game glue that would supply it
  does not exist yet.
- **`SwitchGamesRecomp`'s shared runtime was not checked** for a newer version of this array.
- **`Reloc`, `init_array`/`fini_array` and the symbol binding were not examined** — the module
  machinery has more surface than `g_fast`, and only `g_fast` was inspected.
- **No code was changed**, in this repository or in the cloned one. The patch in §5 is proposed, not
  applied.
