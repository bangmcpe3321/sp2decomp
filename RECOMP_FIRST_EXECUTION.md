# First execution: recompiled Splatoon 2 guest code runs on the host

This is the first **executable** result of the whole effort. Everything before it was static
measurement — translation, compilation, symbol counting. This is the first time generated
Splatoon 2 code has actually *run*.

---

## 1. The result

```
=== Splatoon 2 recompiled-code execution harness ===

guest memory mapped at 0x7100000000 (64 MB)
SP = 0x7103000000   LR = ... (return trap)
calling main_00000024 ...

    guest function returned normally (C++ return for `ret`)

--- guest state after the call ---
  SP   = 0x7103000000 (initial 0x7103000000)
  x19  = 0x0
  x8   = 0x0
  nzcv = n0 z1 c1 v0
  nx::call invocations: 0

*** GENERATED GUEST CODE EXECUTED ON THE HOST ***
```

**`main_00000024` — a real Splatoon 2 function, translated from AArch64 — executed on x86-64, ran to
completion, and returned.**

## 2. Why this is real execution and not a no-op

The evidence is in the post-call state:

| Observation | What it proves |
|---|---|
| `nzcv = n0 z1 c1 v0` (was `0 0 0 0`) | **the flag-setting instructions actually ran** — `nzcv` starts zeroed and is only written by `subs`/`cmp`-class ops |
| `SP` restored to `0x7103000000` | the **prologue ran** (`sub sp, sp, #0x90`) **and the epilogue ran** (`add sp, sp, #0x90`) |
| `x19` back to `0` | the epilogue **restored it from the stack** — i.e. the `stp x20,x19,[sp,#0x70]` / `ldp` pair worked, and memory access works |
| `returned normally` | the `ret` was lowered to a C++ `return` and control came back to the host correctly |

A no-op would have left `nzcv` at zero and could not have restored `SP`/`x19` through a memory
round-trip. **This is a genuine prologue → body → epilogue execution.**

## 3. What the harness deliberately bypasses

The milestone was defined as CPU/runtime only, and the harness enforces that by **not linking the
loader, the HLE, NVN or any platform layer**:

- it provides its own implementations of the **six out-of-line `nx::` entry points**
  (`call`, `unimpl`, `svc`, `mrs`, `msr`, `trace_sp`) — all the rest are header-inline in
  `nx/cpu.h`;
- it maps guest memory itself with `mmap` at `0x7100000000` (`MAP_FIXED_NOREPLACE`), mirroring what
  the real loader's `commit()` does;
- one generated translation unit (`code_000.cpp`, 346 functions), linked with `--gc-sections` so
  only what is reached is kept.

**So a failure here could only be the generated code or the CPU model — and there was none.**

## 4. Two bugs the harness caught in itself, both real

**Bug 1 — wrong linkage.** The first version declared the guest function `extern "C"`. The
generated functions are **C++** (`void main_00000024(nx::CPU&)`), so they are name-mangled;
`extern "C"` left the symbol undefined, and `--unresolved-symbols=ignore-all` resolved it to
**address 0**. The harness then reported `SIGSEGV at address (nil)` with `SP` unchanged — jumping
to 0 before any instruction ran. Fixed by declaring it as C++, confirmed with
`nm -C code_000.o` showing `T main_00000024(nx::CPU&)`.

**Bug 2 — `ret` goes somewhere.** A guest `ret` is `br x30`, so `LR` must point at real memory. The
first version pointed it at the (zeroed) guest image, which would execute zeros and fault. Fixed
with a **return trap**: `LR` points at a C function that `siglongjmp`s back into the harness,
turning "the function returned" into a clean event. (In the event, `ret` was lowered to C++
`return`, so the trap was not needed for this function — but it is needed for the indirect case,
and the distinction is now documented in the harness.)

Both were caught by **building and running**, not by reading — the fifth time in this project that
execution or reading beat static analysis.

## 5. What this does NOT establish

- **It runs ONE function.** 140,899 were translated; **one** has been executed.
- **No game entry point was reached.** `main_00000024` is the module's second function, called
  directly with a hand-built `CPU`. Splatoon 2 has not been started.
- **No `nx::call` occurred** in this run (`nx::call invocations: 0`), so the indirect-branch path —
  the thing `RECOMP_MODULE_LIMIT.md` is about — was **not exercised**.
- **No HLE import was invoked.** No `nn::*` service was called.
- **No NVN, no GPU, no window, no shader.** By design, but it means nothing rendered.
- **The loader was not used**, so module mapping, relocation and symbol binding are all untested.
- **Only `code_000.cpp` was compiled.** 432 other `main` units and all 83 other-module units were not.
- Guest memory was **zero-filled**, not populated with the real NSO image, so any code reading real
  globals would see zeros.

## 6. Reproduction

```
tools/wsl/wsl-setup-sp2port.sh        # stage runtime + 516 generated TUs
tools/wsl/wsl-apply-gfast-patch.sh    # the 4 -> 8 module-limit patch, with a recorded diff
tools/wsl/wsl-harness.sh              # compile one TU + the harness, link, run
```

The harness source is `harness/harness.cpp`. Total runtime: seconds.
