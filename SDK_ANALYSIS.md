# `sdk` module analysis

Progress report on the module that holds the real implementations behind `main`'s
49 platform import thunks.

**Status: the module is analysed; naming it is the remaining problem.**

---

## 1. What was established

`main`'s platform layer is not implemented in `main` — 49 of its 51 platform
functions are 13-byte import thunks (see
[DECOMPILED_BODIES.md](DECOMPILED_BODIES.md) and
[PLATFORM_REFERENCE.md](PLATFORM_REFERENCE.md)). The real code lives in the **`sdk`**
module, an ExeFS sibling.

### The module analysed successfully

| Step | Result |
|---|---|
| hactool decompressed `sdk` NSO | 4 sections, build id `972CC255…` |
| `.text` size | 0x2ce04c (2.9 MB) |
| `nso2elf.mjs` rebuilt it | ELF64 AArch64, 7,113,072 bytes, 5 program headers |
| `validate-elf.mjs` | **VALID — no structural problems found** |
| MOD0 entry | `0x28` (a real entry point, unlike `main`) |
| uncapped Ghidra analysis (Linux, WSL) | **exit 0 in 2m51s** |

**Analysis cost is the headline practical result: 2m51s for `sdk` against a run that
took far longer for `main`'s 23 MB.** That makes `sdk` the right scale to work at, and
confirms the sequencing advice in [PORTING.md](PORTING.md).

### Inventory produced

| Metric | Count |
|---|---:|
| Functions | **8,267** |
| Symbols | 65,055 |
| Strings | 17,854 |

Artifacts: `sdk-inventory.txt` (5.3 MB) and the inventory tooling below.

---

## 2. The naming problem, stated precisely

The goal was named functions — `nn::os::QueryMemoryInfo` rather than `FUN_00001234`.
**That was not achieved, and here is exactly why.**

### The names exist, but as text

`sdk` contains **8,579 distinct `_ZN2nn…` mangled strings**, and **1,496** of them are
in the platform namespaces `main` imports:

```
_ZN2nn2os13FinalizeMutexEPNS0_9MutexTypeE
_ZN2nn2os21TryWaitInterruptEvent...
_ZN2nn4util6detail7FloatPiE
```

They live as **plain strings in `.rodata`** (e.g. file offset `0x3c64eb`), not in a
symbol table. A string is not a mapping: nothing in the file ties
`_ZN2nn2os13FinalizeMutex…` to the address of that function.

Most are almost certainly **assertion or logging text** — the tell is that
`_ZN2nn4util6detail7FloatPiE` is a *data* symbol, which cannot be a function
assertion.

### The MOD0 export table is not resolvable from the file

MOD0's `ModuleOffset` (`0x6bf5b8`) points into `.rwdata`, and the struct there is
**zeroed**:

```
bytes at module struct (file 0x6bf6b8):
  +0x00  0x0
  +0x04  0x0
```

This is consistent with the [SwitchBrew MOD specification](https://switchbrew.org/wiki/MOD),
which describes `ModuleOffset` as *"offset to runtime-generated module object,
typically equal to `.bss` base"*. **It is populated by the loader at runtime, so a
static file does not contain it.** Probing four candidate field layouts produced no
valid export entries.

The converter's report of "367 MOD0 function symbols" came from the struct's
`ExceptionInfo` region, not the export table — worth revisiting, but it did not yield
platform names.

### Consequence

**`sdk`'s platform functions cannot be named by reading the static file alone.** The
two remaining routes both need something the analysis does not yet have:

1. **Link `main`'s GOT to `sdk`'s addresses.** Each of `main`'s 49 thunks forwards
   through a pointer (`PTR_GetSystemTick_7102f9a700`). Resolving those pointers to
   `sdk` addresses would map name → `sdk` function by construction. This needs the
   relocation/import resolution between the two modules, which has not been done.
2. **Cross-reference vendor symbol files** for the matching SDK version, which would
   supply name → address directly. Not attempted.

---

## 3. A real tooling fix worth keeping

Ghidra 12's headless analyzer has **no Jython** — a Python postScript fails with
*"Ghidra was not started with PyGhidra. Python is not available."* And PyGhidra
**cannot install on this Linux host**: the bundled `jpype` wheels are cp310/cp311
while the distro ships **Python 3.14**, so `pip install --no-index` fails.

The working route is a **precompiled Java script**. Ghidra's on-demand Java
compilation had been silently failing, and the real reason turned out to be **two
ordinary compile errors** that were never surfaced:

```java
// Ghidra 12 has no DataUtilities.isStringData(Data)
if (DataUtilities.isStringData(d) || d.getValue() instanceof String)   // compile error

// String.replace(char, String) does not exist
sv.replace('\t', ' ').replace('\n', "\\n")                            // compile error
```

Both are fixed in `tools/ghidra/ExportInventory.java`. Compile explicitly against
Ghidra's full jar classpath (195 jars) and place the `.class` beside the source:

```bash
javac -nowarn -cp "$(find $GHIDRA_INSTALL_DIR/Ghidra -name '*.jar' | tr '\n' ':')" \
      -d build ExportInventory.java
cp build/*.class <scriptDir>/
analyzeHeadless <proj> Sp2Sdk -process sdk.elf -noanalysis \
      -scriptPath <scriptDir> -postScript ExportInventory.java <out.txt>
```

That produced the 8,267-function inventory. **This removes a blocker that had affected
every earlier scripting attempt in this project.**

---

## 4. What this means for the port

The original intent of analysing `sdk` was to replace *"implement 51 platform
functions"* with *"port 51 functions you can read."* That is **partly achieved**:

- ✅ `sdk` is analysed; **8,267 function bodies are available** to decompile, and an
  uncapped analysis of a 2.9 MB module takes under three minutes.
- ❌ **Those bodies are not yet tied to the `nn::os` / `nn::mem` names** `main`
  imports, so picking the right 51 out of 8,267 is unresolved.

The gap is a **mapping problem, not an analysis problem** — and it is bounded: 49
thunks, each with exactly one pointer to resolve.

## 5. Next steps, in expected-payoff order

1. **Resolve `main`'s GOT entries to `sdk` addresses.** 49 pointers, mapping name →
   function by construction. This is the direct path and the highest-value action.
2. **Decompile candidate `sdk` functions and identify them by behaviour** — for
   example, `nn::os::GetSystemTick` must read a system counter, `QueryMemoryInfo`
   must fill a `MemoryInfo` struct. Signature matching against the observed platform
   signatures in [PLATFORM_REFERENCE.md](PLATFORM_REFERENCE.md) can confirm.
3. **Search for the matching vendor SDK symbol file** for build `972CC255…`.
4. **Work `sdk`'s 367 module exports** — if those can be resolved, they are a
   name → address map by definition.

## 6. Honest limits

- **No platform function in `sdk` has been named.** The 8,267 functions are
  `FUN_*`/`LAB_*`.
- **The 1,496 platform strings are not proven to be function names.** They are
  strings in `.rodata`; many appear to be assertion text.
- **The MOD0 export probe found nothing**, across four candidate field layouts.
- **`sdk`'s bodies have not been decompiled yet** — only its inventory exists.
- **`main`'s GOT → `sdk` linkage was not attempted.**
