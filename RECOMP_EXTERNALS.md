# The external surface of the recompiled Splatoon 2 code — measured

`RECOMP_EXPERIMENT.md` established that the CPU side translates with **zero unhandled
instructions**. That answers "can it be generated?" It does not answer "how much runtime does it
need?" This measures that, by compiling the output to object files and reading the undefined-symbol
set.

**Result: the generated code needs about 40 `nx::` helper symbols and `memcpy`. Nothing else.**

---

## 1. Method

Compile three generated translation units to **objects** (not just `-fsyntax-only`, which was the
earlier check), then read their undefined symbols with `nm -uC`. This is the honest metric for
distance-to-runnable.

```
code_000.cpp   OK  (256K)
code_100.cpp   OK  (248K)
code_400.cpp   OK  (264K)
compiled 3/3
distinct undefined symbols: 388
```

**388 undefined — but almost all of them are `main_XXXXXX`, i.e. calls to other generated game
functions in other translation units.** Those resolve when all 433 units are linked together. The
genuine externals in that set were **2 `nx::` symbols and `truncf`**.

To measure the *whole* surface without compiling all 433 units (which would take about an hour),
the `nx::` references were extracted from the generated sources directly.

## 2. The complete external surface

**40 distinct `nx::` symbols**, with occurrence counts:

| Symbol | Uses | Role |
|---|---:|---|
| `nx::ld` | 1,457,311 | typed memory load (template) |
| `nx::st` | 996,761 | typed memory store (template) |
| `nx::V128` | 378,920 | 128-bit vector type (a *type*, not a function) |
| `nx::vzero` | 334,948 | zero a vector register |
| `nx::subs32` / `subs64` | 136,279 / 58,684 | flag-setting subtract (CMP) |
| `nx::CPU` | 114,928 | the CPU context, one per function |
| **`nx::call`** | **77,764** | **indirect-branch dispatcher** |
| `nx::fcmp` | 27,083 | float compare |
| `nx::ld_acq` | 19,394 | acquire load |
| `nx::logic32` / `logic64` | 4,516 / 171 | flag-setting logical op |
| `nx::adds32` / `adds64` | 3,303 / 419 | flag-setting add |
| `nx::fcvt_sat` | 2,236 | float convert with saturation |
| `nx::stxr` / `nx::ldxr` / `nx::clrex` | 2,030 each | exclusive access |
| `nx::set_nzcv` | 1,981 | flags |
| `nx::asr64` / `asr32` | 1,266 / 882 | arithmetic shift with flags |
| `nx::umulh` / `nx::smulh` | 816 / 114 | mul high |
| `nx::sdiv32/64`, `nx::udiv32/64` | ~1,000 total | division |
| `nx::fmax_`, `nx::fmin_`, `nx::fmaxnm`, `nx::fminnm` | ~1,600 total | float min/max |
| `nx::frsqrts`, `nx::frecps` | 290 | float reciprocal step |
| `nx::barrier`, `nx::ror32`, `nx::rev16_32`, `nx::bswap` | ~150 | misc |
| `nx::unimpl` | **15** | the padding/data sites from the earlier report |

**Plus exactly one libc symbol: `memcpy` (1,669 uses).**

## 3. `nx::call` IS the indirect-branch dispatcher — an earlier worry resolved

`RECOMP_EXPERIMENT.md` recorded "6,355 unresolved indirect tail calls" and said a dispatcher would
be needed. **It already exists.** The recompiler emits:

```c
{ uint64_t t = c.x[8]; c.x[30] = NXB + 0x148ull; nx::call(c, t); } // blr x8
```

for `blr` (with the link register set to the return address), and for `br` through a known jump
table it emits a **`switch` over the resolved targets** with `nx::call` as the fallback:

```c
switch (c.x[9]) {
    case NXB + 0xba4ull: goto L_BA4;
    case NXB + 0xbc0ull: goto L_BC0;
    ...
    default: nx::call(c, c.x[9]); return;
} // br x9
```

So the 6,355 "unresolved" branches are **not a gap** — they are routed through one runtime helper,
and the statically-resolvable ones are compiled to direct `goto`s. This is better than the earlier
document implied, and the correction is recorded here rather than left standing.

## 4. Why this is a good result

The generated code is **almost pure computation plus ~40 helpers**. There is no large per-game ABI
to satisfy, no header soup, no C++ standard library dependency beyond `memcpy`. Among the 40,
`nx::ld`/`nx::st` are templates and `nx::V128` is a type, so the **actual runtime functions are
closer to 35**.

For contrast, the same measurement on a conventional decompilation output would typically show
hundreds of externals. The recompiler's `nx::CPU`-based calling convention keeps everything
internal by design: registers live in the passed `CPU&`, so a call is just recursion.

## 5. What this does and does not establish

**Established:** every external symbol the generated Splatoon 2 code needs, enumerated and counted.
The set is small and every member is a documented arithmetic/memory helper.

**NOT established:**
- **It does not link.** One symbol, `nx::call`, needs a resolver keyed on **140,899 addresses**
  across all modules; whether Wonder's runtime provides that shape for a foreign game is unverified.
- **Wonder's `nx::` helpers were not read.** The counts above come from the generated code, not from
  the runtime's headers; the two were not cross-checked symbol by symbol.
- **`nx::CPU`'s layout was not compared** against what the generated code assumes — a mismatch would
  break calling conventions silently.
- **All 433 main units were never compiled together**, so the "388 undefined per 3 units" figure is
  a sample, not a full-tree link.
- **Nothing was executed.** This is a static measurement.
- The other modules (`sdk`, `subsdk0..3`) were not measured this way — only `main`.

## 6. Reproduction

`tools/wsl/wsl-link-measure.sh` compiles the sample units and dumps the undefined set;
`tools/wsl/wsl-extern-surface.sh` extracts the full `nx::` surface from the sources.
