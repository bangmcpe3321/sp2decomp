# The `open-ead` ecosystem: complete assessment

Full survey of [github.com/orgs/open-ead/repositories](https://github.com/orgs/open-ead/repositories)
— **16 repositories** — and what each is worth to this port.

---

## 1. Complete inventory

Repositories, with the relevance verified against `main`'s symbol table where
applicable:

| Repository | Language | Stars | Functions in `main` | Verdict |
|---|---|---:|---:|---|
| [sead](https://github.com/open-ead/sead) | C++ | 252 | 4,022 | ✅ **core dependency** |
| [agl](https://github.com/open-ead/agl) | C++ | 46 | 2,852 | ✅ **core dependency** |
| [nnheaders](https://github.com/open-ead/nnheaders) | C++ | 50 | — | ✅ nnSdk headers (superseded by `nnsdk`) |
| [nx-decomp-tools](https://github.com/open-ead/nx-decomp-tools) | **Rust** | 27 | — | ✅ **tooling; MIT-licensed** |
| [EventFlow](https://github.com/open-ead/EventFlow) | C++ | 16 | **0** | ❌ not in this title |
| [eui](https://github.com/open-ead/eui) | C++ | 8 | **803** | ✅ **UI layer, previously missed** |
| [nnsdk](https://github.com/open-ead/nnsdk) | C++ | 4 | — | ✅ nnSdk + NVN + `nn::gfx` |
| [nnware](https://github.com/open-ead/nnware) | C++ | 3 | 2,823 | ✅ `g3d`/`ui2d`/`atk`/`vfx`/`font` |
| [NintendoSDK-NEX](https://github.com/open-ead/NintendoSDK-NEX) | C++ | 3 | **6,815** | ❌ **online — not needed offline** |
| [botw-lib-musl](https://github.com/open-ead/botw-lib-musl) | C | 2 | — | ⚠ musl libc reference |
| [containers](https://github.com/open-ead/containers) | C++ | — | 0 (`ttl::`) | ⚠ not matched by namespace |
| [NW4F-Eft](https://github.com/open-ead/NW4F-Eft) | C++ | — | 10 (`nw4f`) | ⚠ mostly not present |
| [uking](https://github.com/open-ead/uking) | C++ | — | — | TotK decomp, not this engine era |
| [curl](https://github.com/open-ead/curl) | C | — | 24 | ⚠ third-party vendored |
| [nx-decomp-tools-binaries](https://github.com/open-ead/nx-decomp-tools-binaries) | — | — | — | ⚠ tool binaries |
| [botw-decomp-www](https://github.com/open-ead/botw-decomp-www) | — | — | — | ❌ unrelated |

### The one repository previously missed

**[open-ead/eui](https://github.com/open-ead/eui)** — `eui` is the extended UI
layer, and `main` has **803 `eui::` functions**. It is small (18 KB) but it is a
real layer that
[subsystem-map.txt](subsystem-map.txt) lists and that the earlier per-repository
assessments did not cover. It should be treated alongside `nnware`'s UI modules.

---

## 2. `nx-decomp-tools`: the tooling, and it is MIT-licensed

This is the most consequential find besides the libraries, and it is
**the only repository in the organization with a recognized license**
(`MIT`; `botw-lib-musl` has `NOASSERTION`).

Contents:

```
viking/                     Rust matching-verification tool
  src/elf.rs                14 KB   ELF parsing
  src/functions.rs           9 KB   function extraction
  src/checks.rs             22 KB   match checking
  src/tools/check.rs        26 KB   the check driver
  src/tools/decompme.rs     20 KB   decomp.me integration
  src/tools/list_symbols.rs  3 KB   symbol listing
ghidra_scripts/DWARF.java
ghidra_scripts/RenameFunctionsInGhidra.java
ida_scripts/rename_functions_in_ida.py
ida_scripts/ida_remove_function_tails.py
progress.py, setup_venv.py, util/
asm-differ/                 (git submodule)
```

**What it is for:** *matching decompilation* — building reconstructed source and
verifying the compiled object matches the original binary function by function. It
has the standard decomp-project components: `config.py`/`tools.py` setup helpers, a
`progress.py` completion tracker, and `asm-differ` for assembly diffs. The IDA
script name `ida_remove_function_tails.py` is a strong hint that the tooling
already confronts the same **function-extent problem** documented in
[BOOT_CALLGRAPH.md](BOOT_CALLGRAPH.md).

**A strategic caution.** This tooling assumes the *matching-decompilation*
workflow. It is not usable as-is for the **patch-don't-rewrite** strategy
recommended in [BOOT_MILESTONE.md](BOOT_MILESTONE.md), because that strategy never
produces a rebuilt binary to match against.

So the ecosystem pulls in two directions:

- **The repositories are for matching decompilation.** `sead`, `agl`, `nnware`,
  `nnsdk` are all built to enable reconstruction to a byte-matching standard.
- **The user's stated goal is an offline PC port.** Under patch-don't-rewrite, the
  library repos are still useful as *references*, but `nx-decomp-tools` is not.

This is worth being explicit about rather than presenting both as compatible.

---

## 3. What the ecosystem does not solve

The **Switch-specific `sead` classes** remain the standing gap, unchanged by this
survey:

| Class | Functions | In any repo? |
|---|---:|---|
| `sead::GameFrameworkNx` | 35 | ⚠ `sead` header only |
| `sead::GraphicsNvn` | 47 | ⚠ `sead` header only |
| `sead::PerformanceMgrNx` | 14 | ❌ absent from `sead` |
| `sead::ForegroundBucketMgr` | 1 | ❌ absent from `sead` **and** `agl` |

No repository in the organization fills these. They remain binary-only.

---

## 4. Consolidated dependency picture

| Layer | Functions | Best reference | License |
|---|---:|---|---|
| NVN table | 1 entry | `nnsdk/lib/nvn` (code) | none |
| `nn::gfx` | 289 | `nnsdk/lib/gfx` (code) | none |
| `nn::os`/`mem`/`fs`/`hid`/`vi` | ~382 | `nnsdk` / `nnheaders` (headers) | none |
| `nn::g3d`/`ui2d`/`atk`/`vfx`/`font` | 2,823 | `nnware` (headers, stubs) | none + use restriction |
| `eui` | 803 | `eui` | none |
| `sead` non-NX | ~4,022 | `sead` (decompilation) | none |
| `agl` | 2,852 | `agl` (decompilation) | none |
| musl libc | 4 | `botw-lib-musl` | NOASSERTION |
| `sead::*Nx` | ~97 | — | **nothing** |
| Decomp tooling | — | `nx-decomp-tools` | **MIT** ✅ |

**Every major library layer has a reference. Every one of those references except
the tooling is unlicensed.**

---

## 5. Recommendations

1. **Adopt `nx-decomp-tools` deliberately only if you pursue matching
   decompilation.** It is MIT-licensed and solves a real problem, but it does not
   fit patch-don't-rewrite.
2. **Add `eui` to the reference set.** 803 functions, small repo.
3. **Do not bother with `EventFlow`, `containers`, `NW4F-Eft`, or `uking`** — the
   relevant namespaces are absent from this binary or match zero symbols.
4. **`NintendoSDK-NEX` is irrelevant while the port is offline-only.** It covers
   the 6,815 `nn::nex` functions that the offline decision removed from scope.
   Retain it only if online is ever revisited.
5. **Resolve licensing before incorporating any library code.** Five of the six
   library repositories have no license, and `nnware` additionally disclaims use
   outside matching decompilation. The tooling is the exception.
6. **The remaining unknown is unchanged and specific:** the Switch-specific `sead`
   classes (`GameFrameworkNx`, `GraphicsNvn`, `PerformanceMgrNx`,
   `ForegroundBucketMgr`, ~97 functions) have no reference anywhere in this
   ecosystem.

## 6. Highest-value next step

**Verify one layout, end to end.** Pick a single class that appears in more than
one repository — `sead::GameFrameworkNx` (declared in `sead`, used by `agl`'s
`GraphicsNvn`, instantiated in `main`) — and check that:

1. the header's `static_assert` sizes agree across repositories, and
2. the sizes match the actual construction site in `main`.

If those agree, the references are trustworthy and the port can proceed on them.
If they disagree, the version match is wrong and every layout must be validated
individually — which changes the plan substantially. That single check is the
difference between "I have six repositories" and "I have verified foundations," and
it uses the address-decode method already built in this repository.
