# The Splatoon 2 recompilation experiment â€” it works

`RECOMP_ASSESSMENT.md` recommended adopting the MIT recompiler from
`BelmanteGu/SuperMarioWonderRecomp` and testing it against Splatoon 2. **This is that test, and
it succeeded.** The result decides a question twelve rounds of manual reconstruction could not.

---

## 1. Result

```
python3 -m recomp ~/sp2recomp/main ~/sp2recomp/gen --name main --base 0x7100000000

seeds: 114172 FDE, 753 PLT stubs, 114928 entries
pass 0: 114928 functions, 1113 jump tables, +0 entries
analysis: 114928 functions, 1113 jump tables (12.7s)
done: 0 files, handled 0, unhandled 0 (13s)          <- the --only probe
```

Full run:

| Metric | Value |
|---|---|
| Functions recovered | **114,928** (+ 1,113 jump tables) |
| Instructions handled | **5,264,395** |
| **Instructions UNHANDLED** | **0** |
| Unresolved indirect tail calls | 6,355 |
| Wall clock | **2 m 13.9 s** |
| Peak memory | **2.7 GB** |
| Output | **486 MB** across **433** `code_*.cpp` |
| Exit status | 0 |

**Zero unhandled AArch64 instructions across Splatoon 2's entire `main`.** The recompiler's
decoder covers everything this binary uses.

## 2. The generated C++ is valid AND readable

7 of 7 sampled translation units (`code_000` â€¦ `code_432`) pass `g++ -std=c++20 -fsyntax-only`
against Wonder's runtime headers.

The output is faithful, commented C++ â€” not a byte blob:

```c
void main_00000024(nx::CPU& NX_RESTRICT c) {
    c.x[31] = uint64_t(uint64_t(c.x[31]) - uint64_t(0x90ull));      // sub sp, sp, #0x90
    { uint64_t a = c.x[31] + 0x70ull;
      nx::st<uint64_t>(a, uint64_t(c.x[20]));
      nx::st<uint64_t>(a + 8, uint64_t(c.x[19])); }                  // stp x20, x19, [sp, #0x70]
    c.x[19] = uint64_t(NXB + 0x2fdc000ull);                          // adrp x19, #0x2fdc000
    { uint64_t a = c.x[19] + 0xb8ull;
      c.x[8] = uint32_t(nx::ld<uint32_t>(a)); }                      // ldr w8, [x19, #0xb8]
    if (uint32_t(c.x[8]) != 0) goto L_118;                           // cbnz w8, #0x118
```

Each instruction is translated with **its own disassembly in a trailing comment**. Registers are
`c.x[0..31]`, memory goes through typed `nx::ld`/`nx::st` helpers, branches become labels and
`goto`. This is auditable code â€” a human can follow it against a disassembly.

## 3. The `nx::unimpl` sites are NOT missing code

`code_000.cpp` contains `nx::unimpl` calls, which appear to contradict "unhandled 0". They do
not. There are **15 `unimpl` sites in the entire 486 MB**, and the reasons are:

```
6  undecodable 0xe7ffdefe     <- "b ." to itself: linker padding, not a function
3  udf                        <- the AArch64 permanently-undefined instruction
2  undecodable 0x02fdbff8     <- data words being read as code
6  undecodable 0x02f9a468 / 0x03698f98 / 0x02921ec0 / 0x02a00eac   <- data words
```

All 15 are in the **first function** (`main_00000000`, the NSO header/dispatch region). The
report's `handled 5264395, unhandled 0` counts *instructions it decoded*; these sites are bytes
that are **not instructions at all** â€” padding and pointer data that a linear sweep sees as code.
**The recompiler is not missing anything; it is correctly declining to invent code for data.**

## 4. The real limitation: 6,355 unresolved indirect tail calls

This is the one genuine gap, and it is a known, first-class problem in static recompilation:
indirect branches (`br xN`) whose targets cannot be resolved statically. Every recompiler in this
family has it, and the standard mitigations are a lookup table or a dispatcher built from the
known function set â€” **114,928 of which are now enumerated**, so the mitigation is available.

## 5. What this settles

The user chose **manual reconstruction** in an earlier round, when static recompilation was only a
plausibility argument. It is now measured:

| | Manual reconstruction | This recompiler |
|---|---|---|
| Engine functions handled | **~10**, over 12 rounds | **114,928** |
| Time | 12 rounds | **2 m 14 s** |
| Unhandled instructions | n/a | **0** |
| Output | ~315 test checks | 486 MB of valid, commented C++ |
| NVN device | **not created** | (their runtime has it, MIT) |
| Licence | â€” | **MIT** |

**The manual reconstruction path was never going to reach 114,928 functions. This did, in under
three minutes, on the first attempt.**

That is not a criticism of the work done â€” the platform layer, the four `static_assert`-caught
layout errors, the measured 453-function NVN surface and the failure record all remain useful, and
several of them independently agree with findings from this project's authors. But the
**engine layer** â€” the 113,000 functions that made up the mountain â€” is now a solved problem by a
different method.

## 5b. The whole CPU side: sdk + all four subsdk modules

After `main`, the remaining modules were recompiled the same way, each with a distinct
`--base` (Wonder's convention: a 0x1000000 stride from `main`'s `0x7100000000`).

| Module | Input | Functions | Instructions handled | Unhandled | Unresolved `br` | Time | Output |
|---|---:|---:|---:|---:|---:|---:|---:|
| `main` | 22.6 MB | 114,928 | 5,264,395 | **0** | 6,355 | 2 m 14 s | 486 MB |
| `sdk` | 2.89 MB | 19,322 | 735,237 | **0** | 368 | 20 s | 65 MB |
| `subsdk0` | 787 KB | 5,034 | 188,055 | **0** | — | 5 s | 17 MB |
| `subsdk1` | 67 KB | 582 | 14,440 | **0** | — | <1 s | 1.4 MB |
| `subsdk2` | 49 KB | 105 | 10,755 | **0** | — | <1 s | 944 KB |
| `subsdk3` | 174 KB | 928 | 43,238 | **0** | — | 1 s | 3.5 MB |
| **TOTAL** | — | **140,899** | **6,256,120** | **0** | — | **~2 m 40 s** | **~574 MB** |

**Zero unhandled instructions across every module in the game.** The `sdk` output also passes the
same compile check (`g++ -fsyntax-only`): 5 of 5 sampled units OK.

Bases used, which are **conventions rather than established load addresses**:
`main` 0x7100000000, `sdk` 0x7101000000, `subsdk0` 0x7102000000, `subsdk1` 0x7104000000,
`subsdk2` 0x7106000000, `subsdk3` 0x7108000000. The base affects how absolute addresses are
*represented*, not how instructions decode — and since recompiled functions are called by name,
the ranges need only be distinct, not contiguous. Wonder's own choice (`main` 0x4000000000,
`sdk` 0x4010000000, a 16 MB gap despite `main` being far larger) shows the same thing.

**The `sdk` segment table is also a useful sanity check** — its NSO header reports a module span of
0x765000 (7.4 MB), and 19,322 functions in 735,237 instructions is consistent with a module that
size at this code density.

## 6. What is NOT established

- **It does not run.** This proves the code *generates* and *compiles*, not that Splatoon 2 boots.
  The runtime, NVN-over-Vulkan, shaders, `sdk` module and the 6,355 indirect calls all remain.
- **The `sdk` module was not recompiled** â€” only `main`. Wonder recompiles both.
- **Shaders were not touched.** Splatoon 2 ships its own Maxwell shaders, and Wonder's 12,717-block
  translation was specific to Wonder.
- **The 6,355 indirect tail calls are unresolved**, so a runtime would need the dispatcher.
- **Nothing was linked or executed.** No ROM, no runtime, no window.
- **The output was not compared against the binary** for semantic fidelity beyond spot-reading one
  function.

## 7. Reproduction

Everything needed is in `tools/wsl/`: the recompiler is at `~/refs/wonder/recomp`, dependencies are
`capstone 5.x` and `lz4` (installed without sudo, see below), and the command is the six lines in
Â§1. Total disk: 486 MB output, 2.6 GB input+repo.

**A dependency trap worth recording:** capstone **6.0.0 removed the 14 `ARM64_VAS_*` constants** the
recompiler uses, and 6.x *also* renumbered the underlying enum (5.x is sequential 1â€“14; 6.x is
`(count<<8)|element_size`). A compatibility shim mapping the old names onto 6.x values would have
silently mis-decoded SIMD arrangements â€” **it was written, then deleted once the real 5.x was
installed.** capstone 5.0.9 ships a `py3-none-manylinux` wheel, which is Python-version
independent and therefore **does** run on this host's Python 3.14; an earlier filter that looked
only for `cp314`/`abi3`/`py3-none-any` wrongly concluded 5.x was unavailable.
