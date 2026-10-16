# `nso2elf.mjs` MOD0 export bug — root cause

Round 4 traced why the converter yields **113,150 real names for `main`** but a
**corrupt `.symtab` for `sdk`**. The cause is identified; the fix is not yet written.

---

## 1. The bug, precisely

`nso2elf.mjs` reads two offsets from the MOD0 header:

```js
const strOff = s32(modOff + 0x18);
const symOff = s32(modOff + 0x1c);
```

For `sdk`, those two 32-bit reads are:

| Field | Value read | What it is |
|---|---|---|
| `MOD0+0x18` → `strOff` | **`0x6bf5b8`** | the **`ModuleOffset`** — a pointer to a **zeroed struct** in `.rwdata` |
| `MOD0+0x1c` → `symOff` | **`0xd10243ff`** | **garbage** (interprets as negative) |

Neither is a string-table or symbol-table pointer. The consequence is fully explained
by the `.symtab` internals:

| Check | Result | Meaning |
|---|---|---|
| `st_name` in range of `.strtab` | **367 / 367** | the converter wrote a self-consistent table |
| `st_name` monotonically increasing | **yes** — `1, 0x19e, 0x19f, 0x1a0, 0x1a2, 0x1c9, 0x1ca, 0x1f0, 0x216…` | it is walking *some* string table correctly |
| `st_value` inside `.text` | **0 / 12** | but the addresses are nonsense |
| Names beginning `_Z` | **0 / 367** | and the strings are fragments |

So the converter is **internally consistent but reading the wrong source**. The
`st_name` offsets are a valid ascending walk of a string table that it found at the
wrong base; the strings at that base are C++ template fragments, not export names.

## 2. Where the real export string table actually is

**Memory `0x3cb086`** (file `0x3cb186`), inside `.rodata`. Measured properly, it is
**56,541 bytes** containing **511 plausibly complete mangled names**, of which **446**
are `_ZN2nn*`. It begins correctly:

```
[0x3cb086] 0x00
[0x3cb087] "_ZN2nn2os13GetSystemTickEv"
[0x3cb0a2] "_ZN2nn2fs3fsa10UnregisterEPKc"
[0x3cb0c0] "_ZN2nn2fs3fsa8RegisterEPKcONSt3__110unique_ptrINS1_11IFileSystem…"
[0x3cb11e] "_ZN2nn2fs6detail8RegisterEONSt3__110unique_ptrINS1_18FileSystemAccessor…"
[0x3cb183] "_ZN2nn2fs13ReadDirectoryEPlPNS0_14DirectoryEntryENS0_15DirectoryHandleEl"
```

Two things stand out:

1. **The first name is `_ZN2nn2os13GetSystemTickEv`** — the exact symbol `main`
   imports (see [IMPORT_MAPPING.md](IMPORT_MAPPING.md)).
2. **The second is `nn::fs::fsa::Unregister`**, then FS functions — an ordering that
   looks like a curated export list, not incidental string data.

This supersedes the earlier under-count of "41 names over 2,110 bytes", which came from
aborting the walk on the first token not starting `_ZN2nn` (it stopped at the libc++
names `_ZNSt3__1…`).

## 3. The likely field mapping

The MOD0 header holds `DynamicOffset`, `BssStartOffset`, `BssEndOffset`,
`ExceptionInfoStartOffset`, `ExceptionInfoEndOffset`, `ModuleOffset` — **and
`main`'s `MOD0+0x18` happens to equal its `DynamicOffset`** (`0x2f9a468`), which is why
the conversion appears to work there: `main`'s dynamic section and the string data the
converter needs happen to align, or the real `strOff` is found by luck.

For `sdk`, `MOD0+0x18` is `ModuleOffset` instead. So the two modules disagree because
**the field the converter assumes at `+0x18` is not `strOff` at all** — it is a
different MOD0 field whose meaning varies by module. The real export-table pointers
must come from a different location: either the export table is described by the
`ModuleObject` (which is runtime-generated and therefore absent), or it is reached via
the `.dynamic`/`DT_*` path.

## 4. What is *not* established

- **The export symbol table's location was not found.** With the string table measured
  correctly (511 names) and a **distinctness requirement** — which eliminated the
  earlier false positive of 88 identical entries — a scan of the whole `.rodata` range
  (`0x2cf000..0x68a0e8`) found **no run of 50 or more distinct valid
  `{address, nameOffset}` pairs**. So the export names are **not** paired with a
  contiguous address array in `.rodata`.
- **The correct MOD0 field for `strOff` was not identified.** Only that `+0x18` is
  wrong for `sdk`.
- **Whether the 511-name table covers `main`'s 49 imports is unverified.** Individual
  spot checks succeed (`_ZN2nn2os13GetSystemTickEv` is present and is the first entry),
  but a systematic comparison was not completed — a shell-quoting error corrupted the
  final check and it was not re-run.
- **The mapping from `main`'s 49 imports to `sdk` addresses remains unknown.**

## 5. The concrete fix to attempt next

1. **Re-read the MOD0 struct against the SwitchBrew field list**, confirming which
   offset holds the module's export pointers rather than assuming `+0x18`/`+0x1c`. The
   reader should *validate* what it finds — a string table must start with a NUL
   followed by printable text — instead of trusting the offset.
2. **Point `strOff` at `0x3cb086`** and confirm the resulting `.strtab` contains
   `_ZN2nn2os13GetSystemTickEv` first.
3. **Search for the address array outside `.rodata`** — it may live in `.rwdata`, be
   split into separate name/address arrays (as Mach-O export tries do), or be derived
   from the ModuleObject that is runtime-generated.
4. **Regression-check against `main`**: any corrected parser must still produce
   `main`'s 113,150 names. That check is what makes the fix trustworthy.

## 6. Why this matters

`main` resolves its platform imports **by name** at load time through a dynamic linker
(proven in [IMPORT_MAPPING.md](IMPORT_MAPPING.md)), and `sdk`'s export string table
**begins with `_ZN2nn2os13GetSystemTickEv`** — the first symbol `main` needs. If the
paired address data can be found, the 49 imports resolve to concrete `sdk` addresses,
which is the step the goal is blocked on.

This remains the highest-value open lead: the tooling demonstrably works for one module
and not the other, and the failure is now reduced to two specific wrong field reads
plus one missing address array.
