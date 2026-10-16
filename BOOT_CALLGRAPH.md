# Boot call graph: `SysInit::Init` and the startup path

Decompiled/decoded boot sequence for the framework entry point, recovered statically
from `main`. This is the ordered implementation checklist for the
[boot-to-menu milestone](BOOT_MILESTONE.md).

---

## Method, and its limits

Ghidra's decompiler produced only *"Removing unreachable block"* warnings and
variable declarations for these functions, because whole-program auto-analysis
never completes on this binary (113,150 functions) and so `.text` is never
disassembled into a Listing. There were no instructions for it to decompile.

The call graph below was therefore recovered by **decoding ARM64 branch
instructions directly from the binary**:

- `BL` (`1001 01 | imm26`) and `B` (`0001 01 | imm26`) carry a PC-relative
  immediate, so call targets are exact and require only a decode — no
  disassembler and no analysis.
- Function extents are bounded by the **next symbol address** from the module's
  own symbol table. This is sound here precisely because the binary is not
  stripped: 112,398 of the 113,150 symbols fall inside `.text`.

**Confidence.** Every decoded target that resolved landed on a genuine exported
symbol from an independent source (`.dynsym`), which is strong evidence the
decode is correct. The *ordering* within a function is exact. Two caveats:

1. **Body extents are approximate.** A boundary is the next symbol, which can
   truncate a function when a smaller symbol sits inside a larger one. Treat
   reported sizes as upper bounds, never as fact.
2. **Indirect calls are unresolved.** `BLR` targets come from registers and do
   not appear. Every virtual dispatch in this code is invisible here.

---

## The startup chain

### 1. `nn::init` — memory foundation (`0x71011f5ab4`, 108 bytes)

`Lp::Sys::SysInit::nninitStartup` is the first thing that runs, and it is purely
about establishing memory:

```
bl  nn::os::QueryMemoryInfo        (0x71014141e8)
bl  nn::os::SetMemoryHeapSize      (0x71014141f8)
bl  nn::os::AllocateMemoryBlock    (0x7101413ec8)
bl  nn::init::InitializeAllocator  (0x7100dda018)
```

**This is the first thing to port.** Four functions, all `nn::os`/`nn::init`. If
these do not work, nothing else can allocate and the binary dies immediately.

### 2. `Lp::Sys::SysInit::Init` — framework bring-up (`0x71011f5b20`, 1308 bytes)

The real entry point. 37 branch instructions, in this order:

| Order | Target | Purpose |
|---:|---|---|
| 1 | `Lp::Utl::dumpDateTime` | startup timestamp |
| 2 | `nn::os::GetSystemTick` | timing |
| 3 | `Lp::Sys::getCpCallbackSeadAssert` | assert plumbing |
| 4 | `sead::AssertConfig::registerCallback` | route sead asserts |
| 5 | `sead::Framework::InitializeArg` | **framework init args** |
| 6 | `nn::os::QueryMemoryInfo` | memory topology |
| 7 | `sead::GameFrameworkNx::initialize` | **framework construction** |
| 8 | `Lp::Utl::dumpMemoryInfo` | heap report |
| 9 | `sead::ForegroundBucketMgr::initialize` | **render buckets** |
| 10 | `Lp::Sys::HeapGroup::createInstance` | heap group |
| 11 | `operator new[] / delete[]` | allocation |
| 12 | `Lp::Sys::HeapGroup::createHeap` | game heaps |
| 13 | `sead::ExpHeap::create` | sead heaps |
| 14 | `Lp::Sys::Framework` (ctor) | game framework object |
| 15 | `sead::GameFrameworkNx::initializeGraphicsSystem` | **graphics bring-up** |

The shape is clear: **asserts → memory → framework → heaps → graphics.** Graphics
initialisation is the last step, which is why the graphics device is the hardest
blocker and the natural place to expect the first hard wall.

### 3. Parallel subsystem init

Once the framework exists, subsystem initialisation fans out across worker
threads:

```
RootTask::createParallelInitThread   (0x71011fcadc, 104 bytes)
    bl  Lp::Sys::WorkerThreadMgr::createWorker   (0x710123d4a0)

RootTask::runParallelInitThread      (0x71011fcb44, 96 bytes)
    bl  Lp::Sys::WorkerThreadMgr::enqueue        (0x710123d1a8)
    b   Lp::Sys::WorkerThreadMgr::run            (0x710123d8c0)

RootTask::parallelInitThreadFunc     (0x71011fca28, 180 bytes)
    bl  sead::FormatFixedSafeString
    bl  Lp::Sys::SysInit::printFromStartTime      (progress log)
    blr <indirect>                                (the actual task dispatch)

RootTask::waitDoneParallelInitThread (0x71011fcba4, 56 bytes)
    bl  Lp::Utl::sleepCurThreadMilliSec  (0x71012cdf50)
```

Two consequences that shape the port:

- **`WorkerThreadMgr` is on the critical path.** `enqueue` / `run` /
  `createWorker` must be real, not stubs — the framework's own initialisation is
  dispatched through them. A `return 0` stub here hangs startup rather than
  failing cleanly.
- **`waitDoneParallelInitThread` spin-waits with a sleep.** If subsystem init
  never reports completion, boot blocks here forever. This is the most likely
  place to see an infinite hang, and the first place to attach a debugger.

---

## Implementation checklist

Derived directly from the chain above. Ordered by when boot needs it.

| # | Function | Namespace | Address |
|---:|---|---|---|
| 1 | `nn::os::QueryMemoryInfo` | `nn::os` | `0x71014141e8` |
| 2 | `nn::os::SetMemoryHeapSize` | `nn::os` | `0x71014141f8` |
| 3 | `nn::os::AllocateMemoryBlock` | `nn::os` | `0x7101413ec8` |
| 4 | `nn::init::InitializeAllocator` | `nn::init` | `0x7100dda018` |
| 5 | `nn::os::GetSystemTick` | `nn::os` | `0x7101412298` |
| 6 | `sead::AssertConfig::registerCallback` | `sead` | `0x7101397fac` |
| 7 | `sead::Framework::InitializeArg` | `sead` | `0x7100e69894` |
| 8 | `sead::GameFrameworkNx::initialize` | `sead` | `0x7100e6724c` |
| 9 | `sead::ExpHeap::create` | `sead` | `0x7100e76784` |
| 10 | `sead::GameFrameworkNx::initializeGraphicsSystem` | `sead` | `0x7100e6738c` |
| 11 | `sead::ForegroundBucketMgr::initialize` | `sead` | `0x710139fb3c` |
| 12 | `Lp::Sys::HeapGroup::createInstance` | `Lp::Sys` | `0x71011f4ffc` |
| 13 | `Lp::Sys::HeapGroup::createHeap` | `Lp::Sys` | `0x71011f5130` |
| 14 | `Lp::Sys::WorkerThreadMgr::createWorker` | `Lp::Sys` | `0x710123d4a0` |
| 15 | `Lp::Sys::WorkerThreadMgr::enqueue` | `Lp::Sys` | `0x710123d1a8` |
| 16 | `Lp::Sys::WorkerThreadMgr::run` | `Lp::Sys` | `0x710123d8c0` |

Items 1–5 are the true foundation and belong to `nn::os` / `nn::init`. Note that
items 6–11 are **`sead`**, not `nn::` — the engine layer is reached before the
game framework, so `sead` must work early (it has public prior art, which helps).

## Next step

Repeat this same decode one level deeper — take the 16 functions above and decode
*their* callees — to grow the checklist down to the first frame. The method
scales: each pass is a bounded read of specific function bodies, and needs no
whole-program analysis.
