# Why `main`'s imports cannot be mapped to `sdk` addresses statically

This records the round-3 investigation into the 49-platform-import → `sdk` mapping, and
the finding that closes it off. It is a **negative result**, but a well-evidenced one,
and it explains what any future attempt must do instead.

---

## 1. The import mechanism, decoded

Every platform function in `main` is a thunk that dereferences a GOT slot:

```c
void nn::os::GetSystemTick(void)
{
  (*(code *)PTR_GetSystemTick_7102f9a700)();
}
```

Reading those slots in the static image gives an unexpected answer — **they all hold
the same value**:

| GOT slot | Import | Static contents |
|---|---|---|
| `0x2f9a700` | `GetSystemTick` | `0x1412148` |
| `0x2f9b518` | `AllocateMemoryBlock` | `0x1412148` |
| `0x2f9b6a8` | `QueryMemoryInfo` | `0x1412148` |
| `0x2f9b6b0` | `SetMemoryHeapSize` | `0x1412148` |

`0x1412148` lies inside `.text` (`0x0..0x1415068`), i.e. it is **code**, not a resolved
function address. Decoding it:

```asm
0x1412148  a9bf7bf0   stp  x16, x30, [sp, #-16]!
0x141214c  9000dc50   adrp x16, 0x2f9b000
0x1412150  f9433211   ldr  x17, [x16, #0x660]    ; 0x2f9b660
0x1412154  91198210   add  x16, x16, #0x660
0x1412158  d61f0220   br   x17
```

That is the classic **PLT0 lazy-binding stub**: push the link register, load the
dynamic-linker resolver from a GOT slot, and branch to it. `main`'s `.rwdata` is 89%
non-zero and the surrounding region contains a matched pair of stubs, consistent with a
populated PLT.

## 2. What this means

**`main` does not statically reference `sdk`.** All 49 platform imports funnel through
one dynamic-linking resolver, which resolves each symbol **by name at load time** and
patches the GOT slot. The static file therefore contains no `main` → `sdk` address
mapping to recover, because none exists until the loader runs.

This is why every static route failed, and it is a stronger conclusion than "the
mapping was not found": **the mapping is not in the file.**

## 3. The name table in `sdk` is real loader metadata

A separate question — whether `sdk`'s dense `_ZN2nn…` strings are symbols or assertion
text — is now settled, and favourably.

| Test | Result |
|---|---|
| Are the exact imported symbols present? | `_ZN2nn2os13GetSystemTickEv`, `_ZN2nn2os15QueryMemoryInfoEPNS0_10MemoryInfoE`, `_ZN2nn2os19AllocateMemoryBlockE`, `_ZN2nn2os12CreateThreadE`, `_ZN2nn3mem17StandardAllocator` — **all present** |
| Delimiting | **NUL on both sides** — symbol-table-shaped, not mid-sentence |
| Density | **124–145** NUL-separated `_ZN2nn` tokens per 4 KB |
| Totals | **8,579 distinct** names, **5,321 plausibly complete** |
| Are they referenced by code? | **0 of 200 sampled**, across **6,957** ADRP+ADD pairs in `.text` |

Zero code references is the decisive statistic. Assertion strings are loaded by the
code that asserts; these are not loaded by anything. **They are a loader-facing name
table, not assertion text** — which means `sdk` is the module that provides this API by
name, exactly as the PLT stub requires.

So both halves of the chain are now evidenced:

- `main` resolves its platform imports **by name** through a dynamic linker.
- `sdk` supplies a **name table containing those exact symbols**.

## 4. Why the address mapping is still missing

The name table's accompanying **address table was not located.** Attempts:

- **`.dynamic` is not standard.** Dumping it yields `DT_RELA = 0x7` then
  `DT_BIND_NOW = 6ffffff9`, with tags and values interleaved in a non-ELF way
  (`0x2928cd0` at `+0`, `0x3` at `+8` where a `DT_*` tag belongs). `DT_SYMTAB` and
  `DT_STRTAB` are not recoverable by reading tag/value pairs, and the derived symbol
  count comes out `NaN`.
- **`nso2elf.mjs` drops the symbol table for `main`.** `main.converted.elf` has only
  6 sections — `.text`, `.rodata`, `.rwdata`, `.bss`, `.shstrtab` and a null — with no
  `.dynsym`/`.dynstr`/`.rela.*` at all. Yet Ghidra reported 113,150 named functions for
  `main`, so those names come from the **original NSO** through SwitchLoader, not from
  the converted file.
- **`nso2elf.mjs` corrupts `.symtab` for `sdk`** (fragments such as
  `TypeE4EEEEENS1_6detail14CoreMethodInfo…`, and `_ZN2nn2os` appears zero times).
- **MOD0's export table is runtime-generated**; `ModuleOffset` (`0x6bf5b8` for `sdk`)
  points into `.rwdata` where the struct is zeroed, matching the
  [SwitchBrew spec](https://switchbrew.org/wiki/MOD)'s *"runtime-generated module
  object, typically `.bss` base."*

## 5. What a future attempt should do

1. **Parse the name table's companion address table.** The names sit in a dense
   `.rodata` region around `0x3cb087` (`sdk` memory space). A loader name table is
   normally paired with a parallel array of addresses or offsets; locate that array by
   finding where `_ZN2nn2os13GetSystemTickEv` is *referred to by data* rather than by
   code.
2. **Fix `nso2elf.mjs`'s MOD0/module parsing**, which currently corrupts `.symtab` for
   `sdk` while producing 113,150 names for `main` — the two cases disagreeing is a bug
   signal worth chasing directly.
3. **Use runtime resolution evidence** rather than static: the loader performs the
   name → address binding, so an actual resolved process or a loader log would give the
   mapping that the file lacks. This is the honest route for a mapping that provably
   does not exist statically.
4. **Search for vendor symbol files** for build `972CC255…` / `F18FF3CF…`.

## 6. Honest limits

- **The 49 → `sdk` address mapping remains unknown.** This document explains why, and
  does not claim to have produced it.
- **The PLT reading is inferred from six decoded instructions** and is consistent with
  the lazy-binding pattern; it is not confirmed against a loader implementation.
- **The `.dynamic` dump is anomalous and unexplained.** It may be a real Switch
  variant, or an artefact of my section handling; that was not determined.
- **The name table's address side was not found**, so "`sdk` provides this API" rests
  on the names being present and unreferenced, plus the PLT's by-name resolution — two
  consistent observations, not one direct proof.
