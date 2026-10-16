// nvnLoadCProcs — the NVN dispatch-table entry point.
//
// GRAPHICS_NVN.md §2 established from the binary that NVN has NO per-function surface: the
// only nvn* symbols in `main` are
//
//     nvnBootstrapLoader   0x7101413d48   (.plt thunk)
//     nvnBootstrapLoader   0x7103877000   (EXTERNAL import)
//     nvnLoadCProcs        0x7100ddd6e4
//
// and sead::GameFrameworkNx::initializeGraphicsSystem (0x7100e6738c) calls nvnLoadCProcs
// directly. Every subsequent GPU call goes through the struct of function pointers it returns,
// which is why there are no named nvnDevice*/nvnCommandBuffer* functions to find.
//
// So the port does not reimplement hundreds of nvn* functions. It provides this one entry
// point and fills in a table -- "provide a VTable backed by Vulkan", not "reimplement the
// Switch GPU API". devkitPro/deko3d is the permissively-licensed reference for what the table
// contains (GRAPHICS_NVN.md §4).
//
// WHAT IS AND IS NOT MODELLED HERE
//   Modelled: the loader contract -- the table exists, is stable, and is populated with
//   non-null slots. That is what initializeGraphicsSystem's call needs in order not to fault.
//   NOT modelled: the GPU. No slot performs rendering. Each slot is a stub that reports being
//   unbacked if called, rather than silently returning success and letting the engine believe
//   a frame was drawn.
#pragma once

#include <cstdint>

namespace nvn {

// The table's slot count. The exact number is NOT established in this session -- the
// nnsdk header that enumerates it (nvn_FuncPtrImpl.h) is not in the cloned references, as
// GRAPHICS_SCOPE.md §4 records. This is a placeholder sized generously enough for the
// interface to exist, and it is recorded as a limit rather than presented as the real figure.
constexpr int kProcCount = 256;

using Proc = void (*)();

// The table nvnLoadCProcs returns.
struct ProcTable {
    Proc slots[kProcCount];
};

// 0x7100ddd6e4. Returns the process-wide procedure table. idempotent.
ProcTable *LoadCProcs();

// How many slots have been called that have no implementation. Exposed so a test can assert
// the stubs REPORT rather than silently succeed.
int unbackedCallCount();

// Resets the counter. Not part of the original's API; present for test independence.
void ResetForTesting();

} // namespace nvn
