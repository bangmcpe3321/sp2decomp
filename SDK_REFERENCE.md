# `sdk` reference — the filesystem service, and the limits of what it provides

> **Read this first.** This document was opened to decompile `main`'s platform layer out
> of `sdk`. **That premise is false and was falsified during the investigation.**
>
> `sdk` is the **filesystem service module** — its export table holds **233 `nn::fs`
> exports** and **zero `nn::mem` / `nn::init` / `nn::vi` / `nn::time`** exports. The
> platform layer `main` imports is **not in this dump at all**; the system provides it at
> runtime. See [PLATFORM_LAYER_LOCATION.md](PLATFORM_LAYER_LOCATION.md) for the evidence.
>
> **What follows is therefore not a specification of the platform layer.** Section 3
> documents 10 functions inside `sdk` that were genuinely recovered by behavioural
> markers and decompiled — they are real, but they are *not* the implementations behind
> `main`'s imports, and none of them is named.
>
> **For the platform contract, use [PLATFORM_CALL_SITES.md](PLATFORM_CALL_SITES.md)**,
> which observes how `main` calls each of the 41 platform functions it needs.

Observed contracts and decompiled bodies for functions **inside** the `sdk` module.

Companion documents:
[PLATFORM_LAYER_LOCATION.md](PLATFORM_LAYER_LOCATION.md) (where the platform layer is —
and is not), [PLATFORM_CALL_SITES.md](PLATFORM_CALL_SITES.md) (the contracts `main`
calls against), [PLATFORM_REFERENCE.md](PLATFORM_REFERENCE.md) (the 51 imports declared
in `main`) and [ENGINE_REFERENCE.md](ENGINE_REFERENCE.md) (the boot-closure engine).

---

## 1. What the instruction probes established

`main`'s platform functions are 13-byte import thunks that forward through pointers.
Symbol-free instruction probes locate OS-layer code by behaviour:

| Marker | `main` | `sdk` | Meaning |
|---|---:|---:|---|
| `MRS CNTPCT_EL0` | **0** | **33** | physical counter — time-keeping |
| `MRS MPIDR_EL1` | **0** | **2** | core id |
| `SVC` | **0** | **104** | supervisor calls |
| `MRS` total | **0** | 91 | |

**`main` contains no code that could implement `nn::os::GetSystemTick` — not one
counter read.** `sdk` contains 33. Scanned 5,264,410 words in `main`, 735,251 in `sdk`.

## 2. The analysed module

| Step | Result |
|---|---|
| hactool decompressed `sdk` | build id `972CC255…`, `.text` 0x2ce04c (2.9 MB) |
| `nso2elf.mjs` rebuilt it | ELF64 AArch64, 7,113,072 bytes, 5 program headers |
| `validate-elf.mjs` | **VALID — no structural problems found** |
| MOD0 entry | `0x28` — a real entry point, unlike `main` |
| uncapped Ghidra analysis (Linux/WSL) | **exit 0 in 2m51s** |
| inventory | **8,267 functions, 65,055 symbols, 17,854 strings** |

**2m51s for `sdk` versus a far longer run for `main`'s 23 MB.** `sdk` is the practical
working scale.

## 3. Time-keeping and thread-context implementations

These are the functions Ghidra reports as *containing* the marker sites — not
guesses. An earlier attempt scanned `.text` backwards for a prologue and
misattributed sites, because `stp x29,x30,[sp,#-N]!` also opens **secondary stack
frames** inside larger functions; one "16-byte function" supposedly held 104 SVCs.
Ghidra's authoritative boundaries replaced that method.

Recompiled against those boundaries, the 139 marker sites resolve to **10 functions**:

| Function | Size | Sites | Kind |
|---|---:|---:|---|
| `FUN_0007f4bc` | 424 B | 3 | **time / counter** — reads `cntpct_el0` |
| `FUN_0007fd40` | 100 B | 1 | predicate |
| `FUN_00080324` | 312 B | 2 | counter-reading path |
| `FUN_000805b8` | 300 B | 2 | counter-reading path |
| `FUN_0008083c` | 296 B | 2 | counter-reading path |
| `FUN_00080a34` | 228 B | 2 | counter-reading path |
| `FUN_000843cc` | 692 B | 5 | densest counter use |
| `FUN_000863a4` | 232 B | 1 | counter-reading path |
| `FUN_00086734` | 284 B | 1 | counter-reading path |
| `FUN_0027bc0c` | 204 B | 1 | **core-id / context** — reads `tpidr_el0` |

All sizes are Ghidra's own function bodies. Every one is a real function body, not a
thunk — 100 to 692 bytes.

### Observed signatures

```c
undefined4 FUN_0007f4bc(long param_1, long param_2)
bool       FUN_0007fd40(long param_1)
undefined8 FUN_00080324(long param_1, undefined8 param_2, long param_3)
undefined8 FUN_000805b8(long param_1, undefined8 param_2, long param_3)
undefined8 FUN_0008083c(undefined8 *param_1, long param_2, long param_3)
undefined8 FUN_00080a34(undefined8 *param_1, long param_2, long param_3)
undefined8 FUN_000863a4(undefined4 *param_1, long param_2)
undefined8 FUN_00086734(undefined4 param_1, ulong param_2, long param_3)
void       FUN_0027bc0c(/* 9 register args */)
```

### `FUN_0007f4bc` — the clearest time implementation

Decompiled in full; this is genuine time logic, with saturation and atomic state:

```c
undefined4 FUN_0007f4bc(long param_1, long param_2)
{
  lVar7 = 0;
  local_38 = 0;
  if (param_2 != 0) {
    lVar5 = cntpct_el0;                              // <-- the hardware counter
    lVar6 = thunk_FUN_002bb75c(DAT_006bf0b8 + 0x368);
    lVar7 = 0x7fffffffffffffff;
    if (lVar5 + lVar6 + 1U < 0x7fffffffffffffff) {   // saturate instead of wrap
      lVar7 = lVar5 + lVar6 + 1;
    }
  }
  pcVar1 = (char *)(param_1 + 1);
  while (true) {
    while (bVar2 = *(byte *)(param_1 + 1), bVar2 < 0xfe) {
      if (bVar2 == 0) {
        while (*pcVar1 == '\0') {
          cVar3 = '\x01';
          bVar4 = (bool)ExclusiveMonitorPass(pcVar1, 0x10);   // atomics
          if (bVar4) {
            *pcVar1 = -1;
            cVar3 = ExclusiveMonitorsStatus();
          }
          ...
```

Two things are worth noting: Ghidra decoded `cntpct_el0` **as a named register**, so
the hardware read is unambiguous; and the `+1` with an `INT64_MAX` clamp is
deliberate **saturation**, not a wrap.

### `FUN_0027bc0c` — thread context

```c
void FUN_0027bc0c(/* 9 args */)
{
  uVar2 = thunk_FUN_002bb75c();
  uVar1 = tpidr_el0;                     // <-- thread-pointer register
  FUN_0027bbfc(..., uVar2, uVar1);
  return;
}
```

It reads `tpidr_el0` and passes it onward — thread-local context handling, consistent
with the `nn::os` thread primitives `main` imports.

## 4. Identification method, and its limits

**Method.** Find behaviour by instruction marker (`MRS <sysreg>`, `SVC`), then ask
Ghidra which function contains each site. This needs no symbols, which matters because
`sdk`'s names are unavailable (see §5).

**What this does *not* do.** It does **not** name these functions. The 10 entries are
`FUN_0007f4bc` and so on. It establishes:

- ✅ these functions are in the time / thread-context family;
- ✅ they perform the hardware access;
- ✅ their real signatures and sizes.

It does **not** establish which of them corresponds to `nn::os::GetSystemTick`
specifically, nor map any of them to the 49 imports in `PLATFORM_REFERENCE.md`.

## 5. Why the platform functions are still unnamed

Three naming routes were tried and all failed. Recording them as negative results:

1. **`.rodata` strings are only text.** `sdk` holds 8,579 distinct `_ZN2nn…` strings,
   1,496 in platform namespaces (e.g. `_ZN2nn2os13FinalizeMutexEPNS0_9MutexTypeE`),
   but they are **plain strings**, and a string is not a mapping. Most are assertion
   text — the tell is that `_ZN2nn4util6detail7FloatPiE` is a *data* symbol and cannot
   be a function assertion.
2. **MOD0's export table is runtime-generated.** `ModuleOffset` (`0x6bf5b8`) points
   into `.rwdata` where the struct is **zeroed**, matching the
   [SwitchBrew MOD spec](https://switchbrew.org/wiki/MOD)'s *"runtime-generated module
   object, typically `.bss` base."* Four candidate field layouts produced nothing.
3. **`nso2elf.mjs`'s `.symtab` is corrupt for `sdk`.** A 368-entry `.symtab` exists,
   but its contents are fragments (`TypeE4EEEEENS1_6detail14CoreMethodInfo…`), and
   `_ZN2nn2os` appears **zero** times. The converter produced 113,150 real names for
   `main`; it does not work here.

## 6. Tooling notes

Ghidra 12's headless analyzer has **no Jython**, and **PyGhidra cannot install on this
host** — bundled `jpype` wheels are cp310/cp311 while the distro ships **Python 3.14**,
so `pip install --no-index` fails. **Java scripts are the only route.**

Ghidra's on-demand Java compilation had been failing silently; the cause was two
ordinary compile errors:

```java
DataUtilities.isStringData(d)     // no such method in Ghidra 12
sv.replace('\n', "\\n")           // String.replace(char, String) does not exist
```

Compile explicitly against Ghidra's 195-jar classpath and place the `.class` beside
the source. See `tools/ghidra/`.

## 7. Next steps, in expected-payoff order

1. **Resolve `main`'s GOT entries to `sdk` addresses.** Each of the 49 thunks forwards
   through exactly one pointer; mapping name → function by construction. This is the
   direct path and the highest-value action, and it is bounded to 49 pointers.
2. **Broaden the marker set.** Many `nn::os` primitives have distinctive shapes —
   `nn::os::CreateThread` must reach `SVC`, `LockMutex` must use exclusives. Extending
   markers past time/context would classify more of the 8,267.
3. **Fix or bypass the `.symtab` corruption** in `nso2elf.mjs` for `sdk`, which would
   restore 367 real export names.
4. **Search for the vendor SDK symbol file** for build `972CC255…`.

## 8. Honest limits

- **No `sdk` function is named.** All 8,267 are `FUN_*`/`LAB_*`, including the 10 here.
- **Nothing is mapped to `main`'s 49 imports.** That linkage was not attempted.
- **10 of 8,267 functions are documented.** This is a method demonstration, not a
  survey.
- **`nn::mem` / `nn::vi` / `nn::fs` were not specifically located.** Only time-keeping
  and thread-context markers were probed.
- **The marker method assumes the marker is necessary for the behaviour.** That holds
  for counter reads and syscalls; it is not general.
- **Pseudocode is not committed** — it is Ghidra's rendering of Nintendo's code. The
  reproducible procedure is committed instead.
