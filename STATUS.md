# Reading order and honest status

This repository grew out of one question: *can Splatoon 2's `main` be decompiled well
enough to port the boot path to PC?* This page says what was answered, what was not, and
what to read first.

---

## The short version

| Question | Answer |
|---|---|
| Can a decompiler be driven against this target? | **Yes** — REA + Ghidra on Linux/WSL. See [DECOMPILATION_UNBLOCKED.md](DECOMPILATION_UNBLOCKED.md) |
| Is the boot path decoded? | **Yes** — 184-function closure, [BOOT_CALLGRAPH.md](BOOT_CALLGRAPH.md) |
| Are real function bodies available? | **Yes** for `main` — 5 decompiled, sizes match hand-decoding exactly ([DECOMPILED_BODIES.md](DECOMPILED_BODIES.md)) |
| Is `main`'s platform layer in the game dump? | **No.** It is imported and resolved by the system at runtime ([PLATFORM_LAYER_LOCATION.md](PLATFORM_LAYER_LOCATION.md)) |
| Can the platform layer be decompiled from `sdk`? | **No.** `sdk` is the filesystem service — 233 `nn::fs` exports, zero `nn::mem`/`nn::init`/`nn::vi`/`nn::time` |
| Is there a vendor source to port from? | **No.** The 51 platform functions must be written |
| Is the contract for them recoverable? | **Yes** — from call sites in `main`. [PLATFORM_IMPLEMENTATION_SPEC.md](PLATFORM_IMPLEMENTATION_SPEC.md) |
| Has the port been started? | **Yes.** `port/` builds a tested `nn::os` subset — 21 contract checks passing |

**The practical consequence:** the port's platform layer is a **fresh implementation of
exactly 51 functions**, not a port of existing code. That is a smaller and better-defined
job than it first appeared, but it is not a decompilation task.

**Status of the port itself:** `port/` implements the 5 hottest imports
(`GetSystemTick`, `GetTlsValue`, `LockMutex`/`UnlockMutex`, `GetCurrentCoreNumber`, plus
`InitializeMutex` and friends) against the call-site spec. It compiles under GCC 15.2,
CMake 4.2 and Ninja in WSL and passes 21 contract checks asserting the properties its
callers require. The remaining ~46 imports are not yet written.

---

## Reading order

### 1. Start here — what the target is

- **[README.md](README.md)** — target identification, memory map, subsystem survey.
- **[subsystem-map.txt](subsystem-map.txt)** — 109-subsystem breakdown (2.7 MB).

### 2. The port plan

- **[PORTING.md](PORTING.md)** — scope and strategy.
- **[BOOT_MILESTONE.md](BOOT_MILESTONE.md)** — the narrowed target: boot to menu.
- **[BOOT_CALLGRAPH.md](BOOT_CALLGRAPH.md)** — the decoded startup chain and the
  184-function closure.
- **[PORT_WORKLIST.md](PORT_WORKLIST.md)** — the 51-function boot implementation list.
  ⚠️ **Its addresses are GOT slots, not code** — see §"Known defects" below.

### 3. Decompilation

- **[DECOMPILATION_UNBLOCKED.md](DECOMPILATION_UNBLOCKED.md)** — the WSL route that
  makes REA's Ghidra provider usable on this target.
- **[DECOMPILED_BODIES.md](DECOMPILED_BODIES.md)** — the first decompiler-verified
  bodies from `main`, and the cross-check that validated the hand-decoded work.
- **[VERIFICATION.md](VERIFICATION.md)**, **[VTABLE_VERIFICATION.md](VTABLE_VERIFICATION.md)**
  — layout and vtable verification against the binary.

### 4. The implementation references

These are the documents a port is actually written against:

| Document | What it gives you |
|---|---|
| **[PLATFORM_CALL_SITES.md](PLATFORM_CALL_SITES.md)** | **How `main` calls each platform function** — 41 callees, 66 call sites. Arity and argument shape. |
| **[PLATFORM_REFERENCE.md](PLATFORM_REFERENCE.md)** | Observed ABI signatures of the 51 imports declared in `main`. |
| **[ENGINE_REFERENCE.md](ENGINE_REFERENCE.md)** | 126 boot-closure engine functions with signatures and roles, banded by depth. |

### 7. Why the platform layer is missing

- **[FIRMWARE_ANALYSIS.md](FIRMWARE_ANALYSIS.md)** � the firmware route: what it provides, and why it did not yield the platform layer.
- **[PLATFORM_LAYER_LOCATION.md](PLATFORM_LAYER_LOCATION.md)** — the decisive finding,
  with evidence.
- **[IMPORT_MAPPING.md](IMPORT_MAPPING.md)** — how `main` resolves imports (PLT
  lazy-binding), and why no static mapping exists.
- **[SDK_ANALYSIS.md](SDK_ANALYSIS.md)** — the `sdk` investigation log, including the
  negative results.
- **[SDK_REFERENCE.md](SDK_REFERENCE.md)** — 10 genuinely recovered `sdk` functions
  (not the platform layer).

### 8. Ecosystem and graphics

- **[ECOSYSTEM.md](ECOSYSTEM.md)** — all 16 `open-ead` repositories surveyed.
- **[SEAD_COVERAGE.md](SEAD_COVERAGE.md)**, **[AGL_COVERAGE.md](AGL_COVERAGE.md)**,
  **[NNWARE_COVERAGE.md](NNWARE_COVERAGE.md)** — what existing decompilations cover.
- **[GRAPHICS_NVN.md](GRAPHICS_NVN.md)** — why NVN's single dispatch table makes the GPU
  layer tractable.

### 5. The engine reconstruction

- **[PATH_A_DEVICE_API.md](PATH_A_DEVICE_API.md)** - nn::gfx's public device type is a template family with no out-of-line symbols, and a third failed decoder.
- **[DEVICE_INIT_CALLER_SEARCH.md](DEVICE_INIT_CALLER_SEARCH.md)** - the search for DeviceImpl::Initialize's caller, which FAILED, and why scanning beats reading no further.
- **[DEVICE_IMPL_INITIALIZE.md](DEVICE_IMPL_INITIALIZE.md)** - where the NVN device is actually created, and a correction to NVN_BOOT_SUBSET's lower bound.
- **[NNGFX_LAYER.md](NNGFX_LAYER.md)** - what nn::gfx is, its two verified entry points, and a measurement that FAILED (recorded so it is not repeated).
- **[NVN_BOOT_SUBSET.md](NVN_BOOT_SUBSET.md)** - the boot path reaches 30 of NVN's 453 functions (6.6%); every rendering function is untouched.
- **[GRAPHICS_SCOPE.md](GRAPHICS_SCOPE.md)** - the graphics subsystem: a six-function display boundary, and a large partly reference-free renderer behind it.
- **[HEAP_INTERFACE.md](HEAP_INTERFACE.md)** - the sead::Heap vtable (27 virtual functions), which is the interface a host-backed heap must provide.
- **[HEAP_LAYER_SCOPE.md](HEAP_LAYER_SCOPE.md)** - whether the heap layer is a wall, and the interface-over-host-allocator route around it.
- **[GAMEFRAMEWORK_SCOPE.md](GAMEFRAMEWORK_SCOPE.md)** - whether the next engine step is a wall or a tree, with the subtree mapped.
- **[ENGINE_RECONSTRUCTION.md](ENGINE_RECONSTRUCTION.md)** - the engine-layer target: the boot root's 13 direct dependencies, with addresses, and the fail-loudly method.
- **[BOOT_ENGINE_ORDER.md](BOOT_ENGINE_ORDER.md)** - those dependencies in first-appearance order.

### 6. The port

- **[TYPE_SIZES.md](TYPE_SIZES.md)** � what is actually measured about the SDK's opaque types, and what is not.
- **[port/](port/)** - the actual platform layer: CMake project, 
n::os header and
  implementation, and contract tests. Build and test with 	ools/wsl/wsl-build-port.sh.

---

## Known defects in this repository's own artifacts

Recorded because acting on them without knowing would waste time:

1. **`PORT_WORKLIST.md` addresses are GOT slots, not code.** Ghidra promoted them to
   "functions", so they look like code addresses but return `NO THUNK` on lookup. Caller
   discovery by address fails for these entries.
2. **`nso2elf.mjs` reads the wrong MOD0 fields.** It uses `MOD0+0x18`/`+0x1c` as the
   string/symbol table pointers; for `sdk` those are a zeroed struct pointer and garbage.
   It produces a *self-consistent but wrong* `.symtab`. Root cause in
   [NSO2ELF_MOD0_BUG.md](NSO2ELF_MOD0_BUG.md).
3. **`nso2elf.mjs` emits no `.dynsym`/`.rela` sections**, so the converted ELF loses the
   symbol information the original NSO carries.
4. **Platform thunk signatures are misleading.** Ghidra renders many 13-byte imports as
   `f(void)`; use [PLATFORM_CALL_SITES.md](PLATFORM_CALL_SITES.md) for real arity.

## Tooling

- `tools/static/` — Node analysis scripts (layout, xrefs, call graphs, references).
- `tools/ghidra/` — Ghidra scripts. **Java only**: Ghidra 12 headless has no Jython and
  PyGhidra cannot install here (host Python 3.14 vs bundled cp310/cp311 wheels).
- `tools/wsl/` — the Linux-side setup and analysis scripts.
- `tools/nso/` — NSO→ELF conversion and validation.

## What is *not* in this repository

- **No game code.** It holds analysis, tooling and documentation, not Nintendo's source
  or binaries. The `.gitignore` blocks images, keys, NSO/ELF files and inventories.
- **No implementation of the platform layer** — that is the port's work, and this repo
  documents the contract for it rather than doing it.
