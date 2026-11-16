// nv::SetGraphicsAllocator / nv::InitializeGraphics / nv::SetGraphicsDevtoolsAllocator.
//
// See include/nv/graphics_allocator.hpp for the evidence. The short version: the four-parameter
// signature is taken from the MANGLED SYMBOL
//   _ZN2nv20SetGraphicsAllocatorEPFPvmmS0_EPFvS0_S0_EPFS0_S0_mS0_ES0_
// not guessed from the decompile, and the callbacks are backed by host memory.
//
// InitializeGraphics is the opposite direction across the same boundary: the engine hands the
// graphics layer a block of memory, while SetGraphicsAllocator hands it a way to get more.
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

// Devtools callbacks, kept separate on purpose (see header).
AllocFn gDevtoolsAlloc = nullptr;
FreeFn gDevtoolsFree = nullptr;
ReallocFn gDevtoolsRealloc = nullptr;
void *gDevtoolsUser = nullptr;
int gDevtoolsCalls = 0;

// The block nv::InitializeGraphics was handed. There is no NVN backend to own it, so the port
// records the handover instead of pretending the memory was consumed.
void *gGraphicsHeap = nullptr;
std::uint64_t gGraphicsHeapSize = 0;
int gInitializeGraphicsCalls = 0;

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

void InitializeGraphics(void *graphicsHeap, std::uint64_t graphicsHeapSize) {
    // Recorded, not forwarded: the port has no GPU, and NVN_DEVICE_CREATION.md shows the device
    // is created separately through nvnBootstrapLoader. The pair is stored even when invalid so
    // the caller (and graphicsHeapValid) can see exactly what was supplied.
    gGraphicsHeap = graphicsHeap;
    gGraphicsHeapSize = graphicsHeapSize;
    ++gInitializeGraphicsCalls;
}

void *graphicsHeapBase() { return gGraphicsHeap; }
std::uint64_t graphicsHeapSize() { return gGraphicsHeapSize; }

bool graphicsHeapValid() {
    // The call site derives the size from `*(u32*)(this + 0xcc)` and the base from a successful
    // tryAlloc, so a null base or zero size is not a usable handover.
    return gGraphicsHeap != nullptr && gGraphicsHeapSize != 0;
}

int initializeGraphicsCallCount() { return gInitializeGraphicsCalls; }

void SetGraphicsDevtoolsAllocator(AllocFn alloc, FreeFn free, ReallocFn realloc, void *user) {
    // Same storage-only contract as SetGraphicsAllocator: the engine installs, the consumer
    // (NVN's debug tooling) is what would exercise it. Separated so installing devtools memory
    // does not disturb the real graphics allocator.
    gDevtoolsAlloc = alloc;
    gDevtoolsFree = free;
    gDevtoolsRealloc = realloc;
    gDevtoolsUser = user;
}

AllocFn currentDevtoolsAlloc() { return gDevtoolsAlloc; }
FreeFn currentDevtoolsFree() { return gDevtoolsFree; }
ReallocFn currentDevtoolsRealloc() { return gDevtoolsRealloc; }
void *currentDevtoolsUser() { return gDevtoolsUser; }

void *AllocViaDevtoolsAllocator(std::uint64_t size, std::uint64_t alignment) {
    if (gDevtoolsAlloc == nullptr) return nullptr;
    ++gDevtoolsCalls;
    return gDevtoolsAlloc(size, alignment, gDevtoolsUser);
}

int devtoolsAllocatorCallCount() { return gDevtoolsCalls; }

void ResetForTesting() {
    gAlloc = nullptr;
    gFree = nullptr;
    gRealloc = nullptr;
    gUser = nullptr;
    gCalls = 0;

    gDevtoolsAlloc = nullptr;
    gDevtoolsFree = nullptr;
    gDevtoolsRealloc = nullptr;
    gDevtoolsUser = nullptr;
    gDevtoolsCalls = 0;

    gGraphicsHeap = nullptr;
    gGraphicsHeapSize = 0;
    gInitializeGraphicsCalls = 0;
}

} // namespace nv
