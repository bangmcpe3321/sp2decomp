# Root cause of the `sdk+30` fault found and fixed

Round 5. The `init_array` hypothesis from round 4 was **wrong**, and testing it found the real cause
immediately. It is fixed, the boot advanced past it, and it now fails deeper.

---

## 1. The hypothesis was wrong — and that was cheap to learn

Round 4 proposed that `init_module()` was calling a bad `init_array` entry. **It was not.**
Instrumenting each entry produced **no `init[...]` log lines at all**, which localised the fault to
the line *before* the loop:

```cpp
static void init_module(CPU& c, const ModuleInfo& m) {
    call_preserving(c, m.base + kDtInit);      // <-- HERE
    uint32_t status = ld<uint32_t>(init_status_addr(m));
    if (status == 1)
        for (size_t k = 0; k < m.init_count; k++) call_preserving(c, m.base + m.init_array[k]);
```

**A diagnostic that prints nothing is still a result** — it eliminated the hypothesis in one run.

## 2. The actual root cause

```cpp
constexpr uint64_t kDtInit = 0x30;   // main.cpp:58
```

**`_init` was assumed to live at `+0x30` in *every* module.** That holds for Wonder's modules. In
Splatoon 2's `sdk`, `_init` is at **`+0x24`** — so `init_module(sdk)` called `sdk+0x30`, which is
`_init+0xc`, and the runtime correctly reported:

```
FATAL: call into the middle of a function: sdk+30 (_init+c)
```

**This is the third instance of the same defect class in this project:** a constant that is valid
for Wonder and not for Splatoon 2.

| # | Constant | Where | Consequence for Splatoon 2 |
|---|---|---|---|
| 1 | `g_fast[4]` | module table size | six modules, two silently dropped |
| 2 | 16 MB module stride | generation bases | `sdk` mapped over `main` |
| 3 | **`kDtInit = 0x30`** | `_init` offset | called `_init+0xc` |

## 3. The fix

`_init` is now resolved **from each module's own symbol table**, with `0x30` kept only as a
last-resort fallback:

```cpp
static bool find_func_offset(const ModuleInfo& m, const char* want, uint64_t& out) {
    for (size_t k = 0; k < m.symbol_count; k++) {
        const Symbol& s = m.symbols[k];
        if (s.imported || !s.name[0]) continue;
        if (std::string(s.name) == want) { out = s.value; return true; }
    }
    return false;
}
```

and the log confirms it took effect:

```
sdk: _init at +0x24
```

**The `sdk+30` fault is gone.** The boot advanced past module initialisation for the first time.

## 4. The new failure: a host segmentation fault

With `_init` resolving correctly, the run proceeds further and then dies with a **SIGSEGV** — a host
fault, not the runtime's fail-loudly check.

That is a different *kind* of failure from everything so far: the previous ones were all
`FATAL: <named condition>` from the runtime's own guards, which name what went wrong. A bare SIGSEGV
means the fault happened somewhere the runtime has no check — most likely inside recompiled guest
code that dereferenced a host pointer which is not mapped.

**Why this is progress:** every earlier stop was the runtime refusing to go on. This is the guest
code actually running far enough to work with a bad pointer.

**Why it is not yet diagnosable:** no address, no guest PC, no symbol was captured. That needs a
signal handler in `platform_linux.cpp` that reports `si_addr` plus the current guest `pc`/`lr` — the
same technique the round-1 harness used successfully.

## 5. What this round establishes

| Item | State |
|---|---|
| `init_array` hypothesis | ❌ **disproved** — no entries were reached |
| Real root cause of `sdk+30` | ✅ **found**: hardcoded `kDtInit = 0x30` |
| Fix | ✅ `_init` resolved from the symbol table; `sdk: _init at +0x24` confirmed |
| `sdk+30` fault | ✅ **gone** |
| Boot past module init | ✅ **achieved for the first time** |
| Next failure | ❌ host SIGSEGV, **undiagnosed** |

## 6. What this does NOT establish

- **The SIGSEGV is not diagnosed.** No fault address, no guest PC, no symbol.
- **No game initialisation has completed.** The boot has advanced past `_init` but not to a running
  game loop.
- **`main`'s and the subsdks' `_init` offsets were logged but not verified** to be function starts —
  only `sdk`'s was reached.
- **The HLE remains unexercised.**
- **No NVN, no window, no render** — display and audio are stubs, shaders out of scope.
- **The fallback path (`kDtInit`) was not exercised**, so it is untested.

## 7. Next increment

Add a SIGSEGV/SIGILL/SIGBUS handler to `platform_linux.cpp` that reports **`si_addr` plus the guest
`pc` and `lr`**, resolved through the runtime's `describe()` so the faulting function is named. That
is the same technique the round-1 harness used, and it turns an anonymous crash into a located one.
