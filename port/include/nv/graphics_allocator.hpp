// nv::SetGraphicsAllocator and nn::mem::StandardAllocator — the first calls
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

// nn::mem::StandardAllocator ALREADY EXISTS in nn/services.hpp. The first version of this`n// header redeclared it and the linker caught the duplicate definition -- a reminder to check`n// what the platform layer already provides before adding to it.`n#include "nn/services.hpp"

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

void ResetForTesting();

} // namespace nv

