# `sdk` module analysis

Progress report on the module that holds the real implementations behind `main`'s
49 platform import thunks.

---

## 1. The headline finding: the architecture is now proven, not assumed

**`main` does not read the ARM64 system counters or issue syscalls. `sdk` does.**

Symbol-free instruction probes across both modules:

| Instruction marker | `main` | `sdk` | Meaning |
|---|---:|---:|---|
| `MRS CNTPCT_EL0` | **0** | **33** | physical counter — time-keeping |
| `MRS CNTVCT_EL0` | 0 | 0 | virtual counter |
| `MRS MPIDR_EL1` | **0** | **2** | core id — `GetCurrentCoreNumber` |
| `SVC` (syscall) | **0** | **104** | supervisor call — OS services |
| `MRS` total | 0 | 91 | |

`.text` scanned: 735,251 words in `sdk`, 5,264,410 in `main`.

**This independently confirms the import-thunk finding.** `main` contains no code
that could implement `nn::os::GetSystemTick` — no counter reads at all — while `sdk`
contains 33. The platform layer is genuinely implemented in `sdk`, established by
behaviour rather than by symbols.

## 2. What was completed

| Step | Result |
|---|---|
| hactool decompressed `sdk` | build id `972CC255…`, `.text` 0x2ce04c (2.9 MB) |
| `nso2elf.mjs` rebuilt it | ELF64 AArch64, 7,113,072 bytes, 5 program headers |
| `validate-elf.mjs` | **VALID — no structural problems found** |
| MOD0 entry | `0x28` — a real entry point, unlike `main` |
| uncapped Ghidra analysis (Linux/WSL) | **exit 0 in 2m51s**, project saved |
| inventory | **8,267 functions, 65,055 symbols, 17,854 strings** |

**Analysis cost is a practical result in itself: 2m51s for `sdk` against a much longer
run for `main`'s 23 MB.** `sdk` is the right scale to work at, confirming the
sequencing advice in [PORTING.md](PORTING.md).

## 3. A tooling fix that unblocked all scripting

Ghidra 12's headless analyzer has **no Jython** — a Python postScript fails with
*"Ghidra was not started with PyGhidra. Python is not available."* And **PyGhidra
cannot install on this host**: the bundled `jpype` wheels are cp310/cp311 while the
distro ships **Python 3.14**, so `pip install --no-index` fails.

Java scripts are the only route. Ghidra's on-demand Java compilation had been
**silently failing**, and the cause turned out to be two ordinary compile errors that
were never surfaced:

```java
DataUtilities.isStringData(d)          // no such method in Ghidra 12
sv.replace('\n', "\\n")                // String.replace(char, String) does not exist
```

Both fixed in `tools/ghidra/ExportInventory.java`. Compile explicitly against
Ghidra's 195-jar classpath and place the `.class` beside the source:

```bash
CP="$(find "$GHIDRA_INSTALL_DIR/Ghidra" -name '*.jar' | tr '\n' ':')"
javac -nowarn -cp "$CP" -d build ExportInventory.java
cp build/*.class <scriptDir>/
analyzeHeadless <proj> Sp2Sdk -process sdk.elf -noanalysis \
    -scriptPath <scriptDir> -postScript ExportInventory.java <out.txt>
```

`tools/ghidra/ExtractDecompiled.java` is the Java successor to the Python
decompiler, needed for the same reason.

## 4. Why the platform functions still are not named

The goal was `nn::os::QueryMemoryInfo`, not `FUN_0000xxxx`. Three routes were tried.

### Route A — the mangled names are only text

`sdk` contains **8,579 distinct `_ZN2nn…` strings**, **1,496** of them in the platform
namespaces:

```
_ZN2nn2os13FinalizeMutexEPNS0_9MutexTypeE
_ZN2nn2os21TryWaitInterruptEvent...
_ZN2nn4util6detail7FloatPiE
```

They live as **plain strings in `.rodata`**. A string is not a mapping: nothing ties
the text to the function's address. Most are almost certainly **assertion or logging
text** — the tell is that `_ZN2nn4util6detail7FloatPiE` is a *data* symbol and cannot
be a function assertion.

### Route B — MOD0's export table is runtime-generated

MOD0's `ModuleOffset` (`0x6bf5b8`) points into `.rwdata` where the struct is
**zeroed**. This matches the [SwitchBrew MOD specification](https://switchbrew.org/wiki/MOD),
which describes `ModuleOffset` as *"offset to runtime-generated module object,
typically equal to `.bss` base"*. Four candidate field layouts produced no export
entries.

### Route C — the converter's `.symtab` is corrupted for `sdk`

`sdk.elf` has a `.symtab` (8,832 bytes = 368 entries) and `.strtab` (20,204 bytes),
but the contents are **fragments**, not names:

```
TypeE4EEEEENS1_6detail14CoreMethodInfoINSt3__15tupleIJNSC_18OutRawArgumentInfo…
s6detail25virtual_socket_collection5CloseEiRi
```

`_ZN2nn2os` and `GetSystemTick` appear **zero** times in `.strtab`. So the export
table `nso2elf.mjs` emitted is misaligned or mis-sourced for this module — it worked
for `main` (which yielded 113,150 real names through Ghidra) but not here.

## 5. The marker-based route works, but my boundary attribution does not

The promising approach: find `nn::os` implementations by **behaviour**. `GetSystemTick`
must read the counter, so a `MRS CNTPCT_EL0` site *is* part of a time function.

Scanning `.text` for the markers and scanning *backwards* for a prologue
(`stp x29,x30,[sp,#-N]!`) produced plausible function addresses:

| Marker | Sites | Distinct functions found |
|---|---:|---:|
| `MRS CNTPCT_EL0` | 33 | 8 (at `0x7ee80`–`0x85e3c`) |
| `MRS MPIDR_EL1` | 2 | 2 (`0x27b994`, `0x27bc0c`) |
| `SVC` | 104 | **1** — a single 16-byte function at `0x9e648` |

**But the attribution is unreliable.** Decompiling those 11 candidates produced
functions of 20–80 bytes that are **thin wrappers**, not counter readers:

```c
void FUN_0007f8e4(void)
{
  thunk_FUN_002bb75c(&DAT_005af33b, &DAT_005af33b, &DAT_005af33b, 0);
  return;
}
```

The reason is now clear: **`stp x29,x30,[sp,#-N]!` is not a reliable function-entry
marker.** It also appears for secondary stack frames inside larger functions, so
scanning backwards lands mid-function. The `SVC` result makes this obvious — a
16-byte function cannot contain 104 syscalls, and a single-dispatcher reading is
implausible. The marker *sites* are real; the *enclosing-function* attribution is not.

**One thing the anchors did establish correctly:** function sizes reported by the
scan (32, 32, 28, 32, 32, 80, 64, 676, 264, 204, 20 bytes) differ from Ghidra's
boundaries for the same addresses, which is further evidence the scan's boundaries are
wrong rather than Ghidra's.

## 6. What this means for the port

The original intent was to replace *"implement 51 platform functions"* with *"port 51
functions you can read."* That is **half achieved**:

- ✅ **`sdk` is analysed.** 8,267 bodies are available, an uncapped analysis of the
  2.9 MB module takes under three minutes, and the OS layer is **proven** to live
  there by instruction evidence.
- ✅ **The tooling works.** Java scripting is fixed and reproducible.
- ❌ **The 51 are not yet identified by name.** The mapping problem is unsolved.

The gap remains **a mapping problem, not an analysis problem**, and it is bounded to
49 pointers.

## 7. Next steps, in expected-payoff order

1. **Fix the boundary detection.** Use Ghidra's own function list (8,267 entries,
  now exported) and query *which function contains address X* through Ghidra rather
   than scanning raw bytes for prologues. This is a small change to a Java script and
   would immediately give correct attribution for all 139 marker sites.
2. **Resolve `main`'s GOT entries to `sdk` addresses.** Each thunk forwards through
   exactly one pointer; mapping name → function by construction. Needs the
   inter-module relocation resolution.
3. **Fix or bypass the `.symtab` corruption** in `nso2elf.mjs` for `sdk`, which would
   restore 367 real export names.
4. **Find the matching vendor SDK symbol file** for build `972CC255…`.

## 8. Honest limits

- **No `sdk` platform function is named.** All 8,267 are `FUN_*`/`LAB_*`.
- **The 11 decompiled candidates are the wrong functions** — wrappers, not the marker
  sites. Cause identified (unreliable prologue scanning); not yet fixed.
- **`nso2elf.mjs`'s `.symtab` for `sdk` is corrupt**; the 264 extracted names are
  fragments.
- **The 1,496 platform strings are not proven to be function names.**
- **`main`'s GOT → `sdk` linkage was not attempted.**
