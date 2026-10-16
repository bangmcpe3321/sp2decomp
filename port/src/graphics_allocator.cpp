// nv::SetGraphicsAllocator and nn::mem::StandardAllocator.
//
// See include/nv/graphics_allocator.hpp for the evidence. The short version: the four-parameter
// signature is taken from the MANGLED SYMBOL
//   _ZN2nv20SetGraphicsAllocatorEPFPvmmS0_EPFvS0_S0_EPFS0_S0_mS0_ES0_
// not guessed from the decompile, and the callbacks are backed by host memory.
#include "nv/graphics_allocator.hpp"

#include <cstdlib>
#include <cstring>

namespace nv {

namespace {

AllocFn gAlloc = nullptr;
FreeFn gFree = nullptr;
ReallocFn gRealloc = nullptr;
void *gUser = nullptr;
int gCalls = 0;

} // namespace

void SetGraphicsAllocator(AllocFn alloc, FreeFn free, ReallocFn realloc, void *user) {
    // Stored exactly as given. A null allocator is NOT rejected here, because the binary's call
    // site passes whatever it has and the GPU layer is the thing that would fail later; the port
    // keeps that behaviour and makes failure observable through AllocViaGraphicsAllocator
    // returning null rather than faulting.
    gAlloc = alloc;
    gFree = free;
    gRealloc = realloc;
    gUser = user;
}

AllocFn currentAlloc() { return gAlloc; }
FreeFn currentFree() { return gFree; }
ReallocFn currentRealloc() { return gRealloc; }
void *currentUser() { return gUser; }

void *AllocViaGraphicsAllocator(std::uint64_t size, std::uint64_t alignment) {
    if (gAlloc == nullptr) return nullptr; // loud and checkable, not a crash
    ++gCalls;
    return gAlloc(size, alignment, gUser);
}

int allocatorCallCount() { return gCalls; }

void ResetForTesting() {
    gAlloc = nullptr;
    gFree = nullptr;
    gRealloc = nullptr;
    gUser = nullptr;
    gCalls = 0;
}

} // namespace nv

