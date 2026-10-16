// Lp::Sys::HeapGroup and sead::ForegroundBucketMgr.
#include "lp/heap_group.hpp"

#include "sead/heap.hpp"

#include <cstddef>
#include <new>

namespace Lp::Sys {

namespace {
HeapGroup *gInstance = nullptr;
} // namespace

// The modelled members must land at the offsets the decompiled body constructs them at, or
// the singleton would be laid out differently from the original.

HeapGroup *HeapGroup::createInstance(sead::Heap *heap) {
    // `if (plVar4 == 0) { ... } return plVar4;` -- idempotent.
    if (gInstance != nullptr) return gInstance;

    // The original allocates 0x160 bytes from the supplied heap. The port allocates from the
    // same heap so the ownership relationship is faithful; if the heap refuses, fail rather
    // than silently falling back to a different allocator.
    void *mem = (heap != nullptr) ? heap->tryAlloc(kAllocationSize, 8) : nullptr;
    if (mem == nullptr) return nullptr;

    gInstance = new (mem) HeapGroup();
    return gInstance;
}

HeapGroup *HeapGroup::instance() { return gInstance; }

void HeapGroup::deleteInstance() {
    if (gInstance == nullptr) return;
    gInstance->~HeapGroup();
    gInstance = nullptr;
}


} // namespace Lp::Sys

namespace sead {

void ForegroundBucketMgr::initialize(sead::Heap *heap, unsigned int a, unsigned int b, bool c) {
    // 0x710139fb3c is 4 bytes and the decompiled body is `return;`. Ported as an explicit
    // no-op: running it IS faithful, so it does not need to be a fail-loudly gap.
    (void)heap;
    (void)a;
    (void)b;
    (void)c;
}

} // namespace sead
