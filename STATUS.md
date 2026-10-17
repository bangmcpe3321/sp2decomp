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

- **[RECOMP_PROTO_NOT_BETTER.md](RECOMP_PROTO_NOT_BETTER.md)** - **decisive negative**: the proto's static-init graph is IDENTICAL to retail (202 vs 202 PGV types, 121 vs 121 
nos*). Switching builds buys nothing.
- **[RECOMP_PROTO_AND_HEAP.md](RECOMP_PROTO_AND_HEAP.md)** - March-2017 proto extracted (SDK 0.12.17.0, 7 modules, shifted numbering, debug menu); NPDM shows `svcSetHeapSize` is the real memory mechanism and it is **never called** (0x). Heap moved into guest space -- **principled, but the hang is unchanged**.
- **[RECOMP_FINAL_R12.md](RECOMP_FINAL_R12.md)** - **FINAL**: the recompilation-defect hypothesis is **REFUTED** (cursor != x19); cmp x0,x19 is a **duplicate-registration check**; the recompiler is **cleared** at this site. Full 12-round summary + the one open question.
- **[RECOMP_MISSING_CMP.md](RECOMP_MISSING_CMP.md)** - **MEASURED DISCREPANCY**: the guest AddVariable has 2 register compares; the recompiled one has only 2 compares, both against zero. Possible **recompilation defect** -- falsifiable by one register read.
- **[RECOMP_TWO_EXIT_TESTS.md](RECOMP_TWO_EXIT_TESTS.md)** - **the guest has TWO exit tests** (cmp x0,x19 + cbz x0); the recompiled loop shows only the zero test. Either a **recompilation defect** or my mapping is incomplete -- NOT yet distinguished.
- **[RECOMP_AARCH64_EXIT.md](RECOMP_AARCH64_EXIT.md)** - real guest code read: `SetNext(node, nullptr)` is explicit, so the list is **NULL-TERMINATED**; the circular reading is WEAKENED and the recompilation-defect hypothesis DISPROVED. Also: `exefs/main` is LZ4 -- never read it at computed offsets.
- **[RECOMP_SECOND_REG_CTOR.md](RECOMP_SECOND_REG_CTOR.md)** - backtrace: the second registration comes from a LEGITIMATE `init_array` ctor (#1364). Port does not double-run. **Promotes the CIRCULAR-LIST reading to leading** -- the exit test compares to literal 0.
- **[RECOMP_DUPLICATE_PROVEN.md](RECOMP_DUPLICATE_PROVEN.md)** - **duplicate registration PROVEN by gdb**: 0x710304fb90 registered TWICE (second one closes the chain into a cycle). init_array is CLEAN (1604 entries, 0 dups), so the cause is elsewhere. Also retracts round 5's broken-chain claim.
- **[RECOMP_CURSOR_RESOLVED.md](RECOMP_CURSOR_RESOLVED.md)** - RESOLVED: the cursor is guest x20 = 0x710304fb90, so **round 2 STANDS** and round 5's head claim is retracted. New fact: the object being registered is a DIFFERENT one (0x7103650210), so the self-link PRE-EXISTED this call.
- **[RECOMP_CHAIN_BROKEN.md](RECOMP_CHAIN_BROKEN.md)** - the chain does NOT walk (`next = 0x3d`, not a pointer); the real PGV list head is not located and round 2's pointer path is put IN DOUBT.
- **[RECOMP_CHAIN_CORRECTION.md](RECOMP_CHAIN_CORRECTION.md)** - CORRECTIONS: the list head is NOT the node (round 3 retracted); `call_preserving` hooks MISS direct recompiled calls; `+0x2fc75b0` is not a count.
- **[RECOMP_DUPLICATE_REGISTRATION.md](RECOMP_DUPLICATE_REGISTRATION.md)** - root cause hypothesis: DUPLICATE REGISTRATION makes `tail->SetNext(new_node)` link a node to itself. `SetNext` writes +8, confirmed. Also retracts my round-2 overlap worry.
- **[RECOMP_GETNEXT_PROVEN.md](RECOMP_GETNEXT_PROVEN.md)** - mechanism FULLY PROVEN: vtable slot +0x28 resolves to `GetNext()`, which is literally `return *(this+8)`, and that field is the node itself. Bad node is `PseudoGlobalVariable<SendMultiParameter>`.
- **[RECOMP_GETNEXT_MECHANISM.md](RECOMP_GETNEXT_MECHANISM.md)** - mechanism identified: the node is in **.bss** (zero at load) so its self-pointer was WRITTEN AT RUNTIME; `GetNext()`/`SetNext()` exist and the walk advances on `GetNext()`.
- **[RECOMP_PGV_CTOR.md](RECOMP_PGV_CTOR.md)** - the ctor DOES initialise the node; BOTH round-13 candidates eliminated. The bad node predates this call and is a different object.
- **[RECOMP_ADDVARIABLE.md](RECOMP_ADDVARIABLE.md)** - `AddVariable` IS the spinning function; its empty-list branch is CORRECT, eliminating self-linking. Defect narrowed to node initialisation.
- **[RECOMP_EXIT_CONDITION.md](RECOMP_EXIT_CONDITION.md)** - the EXIT CONDITION read: the walk stops when a callee returns null; the node's `next` is itself, so null never comes. Resolves round 12's fork.
- **[RECOMP_LIST_CYCLE.md](RECOMP_LIST_CYCLE.md)** - the cycle CONFIRMED by memory: a list node whose 
ext points to itself; the loop re-reads an unchanging pointer.
- **[RECOMP_SPIN_NAMED.md](RECOMP_SPIN_NAMED.md)** - with gdb installed, the spin is NAMED: 
n::nex::PseudoGlobalVariableList::AddVariable looping on a list.
- **[RECOMP_SPIN_DIAGNOSED.md](RECOMP_SPIN_DIAGNOSED.md)** - the hang is a SPIN (state R, wchan 0); allocator exhaustion DISPROVED at 512 MB; two worker threads asleep.
- **[RECOMP_HANG_LOCATED.md](RECOMP_HANG_LOCATED.md)** - a 10-minute run proves round 9 was a HANG, not slowness, and locates it: 
n::nex::PseudoGlobalVariable<StreamSettings> ctor, main's #1367.
- **[RECOMP_ALLOCATOR.md](RECOMP_ALLOCATOR.md)** - **the allocator was never installed**; every 
ew returned null. Fixed: 1,368 main constructors now run and the process NO LONGER CRASHES.
- **[RECOMP_INIT_STATUS.md](RECOMP_INIT_STATUS.md)** - 74 SDK constructors were being SILENTLY SKIPPED (init_status 2 vs 1). Fixed; all 74 run. Fourth Wonder-vs-Splatoon-2 constant.
- **[RECOMP_NNOS_INITIALIZE.md](RECOMP_NNOS_INITIALIZE.md)** - SDK init FOUND and running: Splatoon 2 is the old nnos* era, 
nosInitialize was the missing piece. Boot advances far past _init.
- **[RECOMP_FAULT_LOCATED.md](RECOMP_FAULT_LOCATED.md)** - the SIGSEGV LOCATED: 
n::os::LockMutex+0x48 on uninitialised state. The entry bypasses SDK system init.
- **[RECOMP_INIT_OFFSET.md](RECOMP_INIT_OFFSET.md)** - the sdk+30 fault ROOT CAUSED and fixed: hardcoded kDtInit=0x30 vs Splatoon 2's _init+0x24. Boot now advances past module init.
- **[RECOMP_BASES_FIXED.md](RECOMP_BASES_FIXED.md)** - base collision fixed (64 MB stride); all 34 unresolved imports enumerated (24 are harmless ELF markers, 9 are glslc*).
- **[RECOMP_GUEST_EXECUTES.md](RECOMP_GUEST_EXECUTES.md)** - **THE MILESTONE**: Splatoon 2 entered nnMain and executed its own engine code. Then hit a module base collision.
- **[RECOMP_RUNS.md](RECOMP_RUNS.md)** - **it LINKS and RUNS**: 140 MB binary, 271,917 relocations applied, 16,903 symbols linked, stops on ONE missing entry point.
- **[RECOMP_LINK_RESULT.md](RECOMP_LINK_RESULT.md)** - **31 symbols from a binary**: 516/516 TUs compile, and only 26 platform functions + 5 glue are missing. Zero HLE, zero NVN.
- **[RECOMP_FIRST_EXECUTION.md](RECOMP_FIRST_EXECUTION.md)** - **first EXECUTION**: recompiled Splatoon 2 guest code runs on the host (nzcv/SP/x19 prove real work).
- **[RECOMP_MODULE_LIMIT.md](RECOMP_MODULE_LIMIT.md)** - the first genuine incompatibility found: g_fast[4] vs Splatoon 2's 6 modules. Confirmed, narrow, one line to fix.
- **[RECOMP_RESOLVER.md](RECOMP_RESOLVER.md)** - the deciding question answered: the indirect-branch table is GENERATED per game, and Splatoon 2's is complete (114,928/114,928).
- **[RECOMP_EXTERNALS.md](RECOMP_EXTERNALS.md)** - the generated code needs ~40 nx:: helpers and memcpy. Nothing else. (Also corrects the indirect-branch worry.)
- **[RECOMP_EXPERIMENT.md](RECOMP_EXPERIMENT.md)** - **the decisive result**: the MIT recompiler recovered Splatoon 2's 114,928 functions with ZERO unhandled instructions in 2m14s.
- **[RECOMP_ASSESSMENT.md](RECOMP_ASSESSMENT.md)** - a WORKING MIT-licensed static recompiler and NVN-over-Vulkan runtime for a Switch game. The strategic comparison this port has been missing.
- **[IMGUI_NVN_ASSESSMENT.md](IMGUI_NVN_ASSESSMENT.md)** - an external NVN overlay assessed: GPL-2.0, ships its NVN renderer as a BINARY, and hooks an already-created device.
- **[NVN_DEVICE_CREATION.md](NVN_DEVICE_CREATION.md)** - the device-creation path FINALLY located: nvnBootstrapLoader resolves NVN by NAME, which is why every static scan failed.
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
