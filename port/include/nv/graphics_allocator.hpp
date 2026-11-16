// nv::SetGraphicsAllocator / nv::InitializeGraphics / nv::SetGraphicsDevtoolsAllocator and
// nn::mem::StandardAllocator — the allocator and heap-handover calls
// initializeGraphicsSystem makes.
//
// FROM THE DECOMPILED BODY OF sead::GameFrameworkNx::initializeGraphicsSystem (0x7100e6738c):
//
//   nv::SetGraphicsAllocator(
//       (func_ptr_ulong_ulong_void_ptr*)&LAB_7100e67cd0,   // alloc
//       (func_void_void_ptr_void_ptr*)&LAB_7100e67ce0,    // free
//       (func_void_ptr_void_ptr_ulong_void_ptr*)&LAB_7100e67ce4, // realloc
//       (void*)0x0);                                       // user data
//
//   pvVar11 = (**(code **)(*param_1 + 0x30))(param_1, *(u32*)(this + 0xcc), 0x1000);
//
// The symbol is
//   _ZN2nv20SetGraphicsAllocatorEPFPvmmS0_EPFvS0_S0_EPFS0_S0_mS0_ES0_  @ 0x7101413cb8
// which demangles to
//   nv::SetGraphicsAllocator(void* (*)(ulong, ulong, void*),
//                            void  (*)(void*, void*),
//                            void* (*)(void*, void*, ulong, void*),
//                            void*)
// -- FOUR parameters, matching the call site exactly. That is the contract, and it is taken
// from the mangled symbol rather than guessed from the decompile (which shows the function
// pointers as LAB_ addresses because the three callbacks are local lambdas whose bodies were
// emitted as separate blocks).
//
// WHY THIS MATTERS FOR A PORT: these three callbacks are the boundary the GPU allocator crosses.
// A port must supply equivalents backed by host memory, which is what makes this pair the right
// first increment -- it is self-contained, needs no device, and is callable today.
#pragma once

#include <cstddef>
#include <cstdint>

// nn::mem::StandardAllocator ALREADY EXISTS in nn/services.hpp. The first version of this
// header redeclared it and the linker caught the duplicate definition -- a reminder to check
// what the platform layer already provides before adding to it.
#include "nn/services.hpp"

namespace nv {

// The allocator callbacks the engine installs, as the mangled signature specifies.
using AllocFn = void *(*)(std::uint64_t size, std::uint64_t alignment, void *user);
using FreeFn = void (*)(void *ptr, void *user);
using ReallocFn = void *(*)(void *ptr, std::uint64_t size, std::uint64_t alignment, void *user);

// 0x7101413cb8. Installs the process-wide graphics allocator.
void SetGraphicsAllocator(AllocFn alloc, FreeFn free, ReallocFn realloc, void *user);

// The installed callbacks, or null. Present so a test can verify the install happened and that
// the callbacks are actually usable rather than merely recorded.
AllocFn currentAlloc();
FreeFn currentFree();
ReallocFn currentRealloc();
void *currentUser();

// Allocates through the installed allocator, exercising it the way the GPU layer would. Returns
// null if no allocator is installed -- a loud, checkable failure rather than a fault.
void *AllocViaGraphicsAllocator(std::uint64_t size, std::uint64_t alignment);

// Counts how many times the installed allocator has been invoked, so a test can prove the
// callbacks are reachable and not just stored.
int allocatorCallCount();

// --- nv::InitializeGraphics (0x7101413cc8) ------------------------------------------------
//
// One boot-closure call site, from the same body as above (PLATFORM_IMPLEMENTATION_SPEC.md
// "InitializeGraphics", 1 site / 1 caller):
//
//   nv::InitializeGraphics(pvVar11, (ulong)*(uint *)(this + 0xcc));
//
// where pvVar11 is the block the preceding `heap->tryAlloc(..., *(u32*)(this + 0xcc), 0x1000)`
// returned. So the contract is (graphics heap base, graphics heap size) -- a block handover,
// not a device creation. NVN_DEVICE_CREATION.md §1 shows why there is nothing else here: the
// device itself is created later through nvnBootstrapLoader("nvnDeviceInitialize").
//
// WHAT THE PORT DOES: records the block, because there is no NVN/GPU backend to hand it to.
// The allocator installed by SetGraphicsAllocator is left untouched (the two are opposite
// directions across the same boundary: callbacks out vs. memory in). A null/zero pair is
// recorded as an invalid handover rather than accepted, and the call count still advances so
// the attempt is visible.
void InitializeGraphics(void *graphicsHeap, std::uint64_t graphicsHeapSize);

// The block passed to InitializeGraphics, or null. Readable so a test can assert the handover
// was recorded exactly, and so a future NVN backend has one place to take it from.
void *graphicsHeapBase();
std::uint64_t graphicsHeapSize();
bool graphicsHeapValid();

// How many times InitializeGraphics has been entered, valid handover or not.
int initializeGraphicsCallCount();

// --- nv::SetGraphicsDevtoolsAllocator (0x7101413ce8) --------------------------------------
//
// PLATFORM_REFERENCE.md gives this the SAME four-parameter shape as SetGraphicsAllocator
// (three function pointers + void* user data), and PORT_WORKLIST.md line 126 puts its call site
// in initializeGraphicsSystem. NOTE: the whole-binary scan in PLATFORM_IMPLEMENTATION_SPEC.md
// (48 imports ranked) has no entry for this name, so its exact argument list is taken from the
// declared reference signature, not from an attributed call site. The mangled symbol was not
// recovered in the docs, so the parameter order below is the reference's, not a demangling.
//
// The install is kept in SEPARATE slots from the graphics allocator: the devtools allocator is
// debug-tooling memory, and merging the two would make a devtools install silently replace the
// engine's real allocator. It reuses the allocator seam's types and accessor pattern.
void SetGraphicsDevtoolsAllocator(AllocFn alloc, FreeFn free, ReallocFn realloc, void *user);

AllocFn currentDevtoolsAlloc();
FreeFn currentDevtoolsFree();
ReallocFn currentDevtoolsRealloc();
void *currentDevtoolsUser();

// Exercises the installed devtools callbacks the same way AllocViaGraphicsAllocator does.
// Returns null when no devtools allocator is installed.
void *AllocViaDevtoolsAllocator(std::uint64_t size, std::uint64_t alignment);

int devtoolsAllocatorCallCount();

void ResetForTesting();

} // namespace nv

