# Firmware: what it provides, and the wall I hit

Extends [PLATFORM_LAYER_LOCATION.md](PLATFORM_LAYER_LOCATION.md). That document established
that the platform layer is **not in the game dump**. This one records the attempt to get it
from **firmware** instead.

**Outcome: the firmware is now fully accessible and flows through the existing pipeline, but
its system modules are stripped, so there is no symbol-based route to identify `nn::os`.**

---

## 1. What now works

| Step | Result |
|---|---|
| Firmware download | `Firmware.23.0.0.zip`, 324.7 MB → **238 NCAs** |
| hactool **1.5.4** (prebuilt) | `Master Key Revision: 0x16 (23.0.0-)` — **recognized** |
| Bundled hactool 1.4.0 | failed: `Master Key Revision: 0x16 (Unknown)`, `section 0 is corrupted` |
| Program NCA → ExeFS | `--exefsdir`, clean extraction |
| **`-t nso` on a firmware NSO** | **same interface as the game** — no new tooling |
| `nso2elf.mjs` → ELF | VALID, 5 program headers |
| `validate-elf.mjs` | `VALID — no structural problems found` |

**The whole existing pipeline works unchanged on firmware.** That is the durable gain: the
tooling blocker is gone.

### Inventory

190 system titles enumerated by title id, SDK version and content type — written to
`fw-sweep-results.json`. The pack is mostly **SDK `23.3.0.0`** with a few older entries.

**Version drift to keep in mind:** the game's `main` was built with an older SDK than this
firmware. Since the intent is to *reimplement* the platform layer rather than link against
it, that is probably tolerable — but any signature differences should be detected and
reported, and **where firmware and call sites disagree, the call sites win**, because they
are evidence from the actual target.

## 2. The wall: firmware system modules are stripped

A sweep of **24 Program NCAs** looked for the markers that would identify a module carrying
the platform layer:

```
_ZN2nn2os     _ZN2nn3mem17StandardAllocator     _ZN2nn4init19InitializeAllocator
_ZN2nn2vi     InitializeMutex                   QueryMemoryInfo
```

**Result: zero modules matched.** The module examined in detail contained just **5 distinct
mangled strings**, all belonging to itself:

```
_ZN2nn2ro6detail15g_pAutoLoadListE
_ZN2nn2ro6detail17g_pManualLoadListE
_ZN2nn2ro6detail14g_pRoDebugFlagE
_ZN2nn2ro6detail34g_pLookupGlobalAutoFunctionPointerE
_ZN2nn2ro6detail36g_pLookupGlobalManualFunctionPointerE
```

Those identify it as the **`ro` (loader) sysmodule** — and reveal the mechanism: the loader
exposes *global function pointers* (`g_pLookupGlobalAutoFunctionPointer`) rather than
exporting named symbols.

**So the firmware sysmodules carry almost no names.** Decompiling one would yield
`FUN_000abcde`, which is the same identification problem that stalled the earlier `sdk`
investigation — I would have code without knowing which function is which.

## 3. Why "just look for the code" is not enough

Behavioural markers do work as a *locator*: the `ro` module showed **9 `MRS CNTPCT_EL0`**
and **41 `SVC`**, so OS-facing code is present. But markers identify a *family*, not a
*specific function* — the exact limitation recorded in
[SDK_ANALYSIS.md](SDK_ANALYSIS.md), where marker-based attribution with a byte-scan for
prologues produced wrappers instead of the intended functions.

## 4. A deeper concern about the whole approach

`nn::os` on Switch is substantially backed by the **kernel**: thread creation, mutexes and
most blocking primitives are kernel services reached through `SVC`. What is statically
linked into a sysmodule may be only the **client-side wrapper**, not the semantics beneath.

That is not necessarily fatal — for a PC port the wrapper boundary is arguably where the
reimplementation belongs anyway, since the host supplies its own threads and mutexes. But it
means a successful extraction might yield less than hoped, and that should be established
before investing further.

## 5. Mistakes made along the way, recorded so they are not repeated

1. **`sdk-nnos-probe.mjs` has a hardcoded `.text` size.** It reported "735,251 words
   scanned" on a 3.6 MB section — a stale constant from the game. Its counts are
   unreliable and a first reading based on them should not have been trusted.
2. **`hactool --info` needs the right working directory.** The `[WARN] prod.keys does not
   exist` line looked like a key failure but was a cwd issue; the keys were valid all along.
3. **I mis-read the NSO header offsets three times** while writing `fw-exports.mjs`. The
   lesson is that `nso2elf.mjs` already parses this correctly and is the reference — the
   independent parse was unnecessary work that produced misleading intermediate output.

## 6. The `.dynsym` route was attempted and stopped

The last untried symbol route was to parse a sysmodule's NSO `.dynsym`. It was attempted
and **not completed**, and the reason is worth recording precisely.

**Attempted:** a standalone parser (`tools/static/nso-dynsym.mjs`) to read the NSO header,
locate MOD0, follow `DynamicOffset`, and walk `DT_SYMTAB` / `DT_STRTAB`.

**Three failed attempts at the header layout.** Each version produced different field
mappings for the same bytes, and the MOD0 lookup landed on zeroed data:

```
=== NSO header fields 0x00..0x40 ===   (raw values, stable across attempts)
  0x10  00000100   0x14  00000000   0x18  00378758
  0x1c  00000100   0x20  00379100   0x24  00379000
  0x28  000f6f98   0x2c  00000000   0x30  00470100
  0x34  00470000   0x38  0006339c   0x3c  0007fc64
```

`MOD0` does exist — a byte scan found it at file `0x379168` — but computing that offset
from the header fields is what I kept getting wrong, and the parse consequently read
zeroed memory and found no `DT_SYMTAB`.

**The lesson, and why this stops here.** `nso2elf.mjs` **already parses this format
correctly**: it converted this very file to a VALID ELF with the right section layout and
`367 MOD0 function symbols` on the game's `sdk`. Writing an independent parser was
unnecessary work. The right move is to **extend the existing converter**, not to
reimplement its header logic alongside it — and that is a bounded, well-scoped task for a
future round rather than something to keep improvising.

## 7. Routes that remain, honestly assessed

| Route | Assessment |
|---|---|
| **Extend `nso2elf.mjs` to emit `.dynsym`** | The correct next step. It already locates MOD0 and walks the export table; exposing the symbols it finds is a small change to code that is known to work. |
| **Behavioural markers + Ghidra containment** | Worked for `main` when Ghidra supplied boundaries. Yields function *families*, not identities. |
| **Vendor SDK symbol files** | Would settle everything directly. Not available here. |
| **Runtime observation** | The only route that would *prove* which function the loader binds. Needs an emulator and is a much larger undertaking. |

## 8. Bottom line

**Gained:** firmware is downloadable, decryptable, extractable, and compatible with the
pipeline built earlier in this project. The blocker that stopped the previous round is
resolved.

**Not gained:** identification of `nn::os` within it. The system modules are stripped, so the
symbol-based approach that named 113,150 functions in the game's `main` does not transfer —
and the `.dynsym` route that might recover names was attempted but stopped, for the reason
recorded above.

**Unchanged:** the port's platform layer remains a reconstruction validated against observed
call sites ([PLATFORM_IMPLEMENTATION_SPEC.md](PLATFORM_IMPLEMENTATION_SPEC.md)), not a port of
recovered vendor code. Nothing in this work changes that conclusion yet.

**What I would do differently:** on first seeing that the header fields did not match my
assumptions, the correct response was to read `nso2elf.mjs` and reuse its layout — not to
re-derive the format from raw bytes three times. The converter was working the whole time.
