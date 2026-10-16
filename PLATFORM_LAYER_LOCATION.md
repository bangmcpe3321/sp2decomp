# Where the platform layer actually is (and is not)

This document answers the question the `sdk` investigation was opened to answer, and
the answer is that the platform layer **is not in this dump at all**.

It is a decisive negative result, and it changes the port plan for the better.

---

## 1. The finding

**`nn::os`, `nn::mem`, `nn::init`, `nn::vi` and `nn::time` are not implemented in any
module in this ExeFS.** `main` declares them as unresolved imports and the system
provides them at runtime.

### `sdk`'s export table is filesystem-only

Reading `sdk`'s real export string table at memory `0x3cb086` (511 mangled names)
gives a clear namespace profile:

| Namespace | Exports in `sdk` |
|---|---:|
| `nn::fs` | **233** |
| `nn::os` | 8 |
| `nn::mem` | **0** |
| `nn::init` | **0** |
| `nn::vi` | **0** |
| `nn::time` | **0** |

`nn::fs` dominates completely. The table opens with `nn::fs::fsa::Unregister`,
`nn::fs::fsa::Register`, `nn::fs::detail::Register`, `nn::fs::ReadDirectory`,
`nn::fs::CloseDirectory` — `sdk` is the **filesystem service module**.

Of twelve probed platform imports, **only 2 were present** (`nn::os::GetSystemTick`,
`nn::fs::MountRom`). The rest — `QueryMemoryInfo`, `AllocateMemoryBlock`,
`CreateThread`, `LockMutex`, `UnlockMutex`, `SleepThread`,
`nn::mem::StandardAllocator`, `nn::vi::Initialize`, `nn::init::InitializeAllocator` —
are **absent**.

### `sdk` has no `nn::init` or `nn::vi` text at all

Counts of mangled-name occurrences in the decompressed `sdk`:

| Namespace | Occurrences |
|---|---:|
| `_ZN2nn2fs` | 450 |
| `_ZN2nn2os` | 349 |
| `_ZN2nn4util` | 296 |
| `_ZN2nn4nifm` | 185 |
| `_ZN2nn4diag` | 73 |
| `_ZN2nn4time` | 71 |
| `_ZN2nn2oe` | 44 |
| `_ZN2nn3mem` | 33 |
| **`_ZN2nn4init`** | **0** |
| **`_ZN2nn2vi`** | **0** |

`nn::init` and `nn::vi` do not appear in `sdk` in any form.

### `main` declares each platform symbol exactly once

In `main`'s decompressed NSO:

| Symbol | Occurrences |
|---|---:|
| `_ZN2nn2os15QueryMemoryInfo` | 1 |
| `_ZN2nn2os19AllocateMemoryBlock` | 1 |
| `_ZN2nn2os13GetSystemTick` | 1 |
| `_ZN2nn2os11UnlockMutex` | 1 |
| `_ZN2nn2os11SleepThread` | 1 |
| `_ZN2nn4init19InitializeAllocator` | 1 |
| `_ZN2nn2vi10Initialize` | 1 |
| `_ZN2nn2fs8MountRom` | 1 |
| `_ZN2nn2os12CreateThread` | 2 |

Exactly one mention per symbol is the signature of an **import list**: an unresolved
symbol is named once, in the module's dynamic symbol table. The names are scattered
across an 8 MB span of `.rodata`, which is consistent with a large `.dynstr` rather
than a small hand-written table — the string-table *indices* are scattered, not the
declarations.

### The sibling modules are compressed, but the picture is consistent

`rtld`, `main`, `sdk`, `subsdk0`–`subsdk3` are all NSO0 containers with LZ4-compressed
sections, so a raw string search of the on-disk files finds nothing. The decompressed
`main` and `sdk` are the two that were examined, and they agree.

## 2. What this rules out

- **`sdk` is not the provider of `nn::os`/`nn::mem`/`nn::init`/`nn::vi`.** It is the
  filesystem service. This was the premise of the `sdk` investigation, and it is now
  falsified.
- **No module in this ExeFS implements the platform layer.** `main` imports it; nothing
  here defines it.
- **The 49-import → address mapping cannot be recovered from this dump**, because the
  target module is not in the dump. This closes the lead that
  [IMPORT_MAPPING.md](IMPORT_MAPPING.md) and [NSO2ELF_MOD0_BUG.md](NSO2ELF_MOD0_BUG.md)
  were pursuing.

## 3. Where it actually lives

The resolving module is a **system module**, not a game module — the Switch SDK
library (`nnSdk`) shipped in system firmware. It provides `nn::os`, `nn::mem`,
`nn::init`, `nn::vi`, `nn::time` and the rest, and `main`'s PLT binds to it by name at
load time.

Obtaining it is out of scope for a game-dump analysis: it is not part of the title, and
the repository has never had it.

One caveat worth stating: the earlier behaviour probe found 33 `MRS CNTPCT_EL0` sites
**inside `sdk`**. That is not contradicted — `sdk` has 349 `_ZN2nn2os` occurrences and
its own time-keeping and `nn::os` *usage* (and an 8-entry `nn::os` export set), but
that is not the same as implementing the platform API `main` imports.

## 4. Why this is good news for the port

This is the most useful conclusion the `sdk` investigation produced.

**Reimplementing the platform layer was never a shortcut around decompilation — it is
the port's actual scope.**

[PORT_WORKLIST.md](PORT_WORKLIST.md) framed the 51 functions as things to implement.
That framing was right all along; what `sdk` analysis adds is the reason:

- there is **no vendor source to port from**, so a fresh implementation is required;
- the surface is **exactly 51 functions**, documented with observed ABI signatures and
  callers in [PLATFORM_REFERENCE.md](PLATFORM_REFERENCE.md);
- the contract each must satisfy is visible from its **call sites in `main`**, which
  *are* in the dump and are decompilable — as demonstrated by the decompiled boot
  functions in [DECOMPILED_BODIES.md](DECOMPILED_BODIES.md).

So the practical recipe is: read the caller, implement the callee.

## 5. What to do next

1. **Decompile `main`'s call sites** for each of the 51 imports. The arguments passed
   at each call reveal the required semantics — which is more reliable than a signature
   alone, and the wrapper functions are already decompiled.
2. **Treat [PLATFORM_REFERENCE.md](PLATFORM_REFERENCE.md) as the interface spec.** It
   is the best contract available, and it is observed rather than assumed.
3. **Drop the search for a vendor implementation.** It is not in the dump, and chasing
   it further has negative expected value.
4. **Deprioritise `sdk` as a platform source**, but keep it for what it is: the
   filesystem service, with 233 `nn::fs` exports relevant to the mount/read path the
   boot milestone needs.

## 6. Honest limits

- **`subsdk0`–`subsdk3` and `rtld` were not individually decompressed** — they are
  compressed on disk and only `main` and `sdk` were decompressed and examined. The
  conclusion rests on those two plus the fact that `main` lists each symbol once as an
  import.
- **The inference that the resolver is `nnSdk` in system firmware is the standard
  Switch arrangement, not something observed here.** What *is* observed is that the
  symbols are absent from `main` and from `sdk`.
- **`sdk` has 8 `nn::os` exports.** They were not individually identified, so whether
  any overlaps an import `main` needs is unknown.
- **The 8 `nn::os` exports do not include most of the probed imports**, which is what
  the conclusion rests on.
