// Lp::Sys::HeapGroup and sead::ForegroundBucketMgr.
#include "lp/heap_group.hpp"

#include "sead/heap.hpp"

#include <cstddef>
#include <new>

namespace Lp::Sys {

namespace {
HeapGroup *gInstance = nullptr;

// The slot offsets createHeap writes, in the order the decompiled body writes them.
// +0x150 is deliberately absent: the body zeroes it and never assigns a heap.
constexpr std::size_t kSlotOffsets[HeapGroup::kHeapCount] = {
    0x128, 0x130, 0x138, 0x140, 0x148, 0x158,
};
constexpr std::size_t kZeroedOnlyOffset = 0x150;

sead::Heap **Slot(HeapGroup *h, std::size_t offset) {
    return reinterpret_cast<sead::Heap **>(reinterpret_cast<unsigned char *>(h) + offset);
}
} // namespace

HeapGroup *HeapGroup::createInstance(sead::Heap *heap) {
    // `if (plVar4 == 0) { ... } return plVar4;` -- idempotent.
    if (gInstance != nullptr) return gInstance;

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

// 0x71011f5130, 508 bytes.
void HeapGroup::createHeap(sead::Heap *parent, const HeapSizes &sizes,
                           const char *const names[5], const char *othersName) {
    // The body zeroes every slot it will write, PLUS +0x150 which it never assigns. Both
    // happen here, so the "dead" slot is reproduced rather than optimised away.
    for (std::size_t off : kSlotOffsets) *Slot(this, off) = nullptr;
    *Slot(this, kZeroedOnlyOffset) = nullptr;

    // Slots 0..4 take their size from the info table and their name from Group::text_(i).
    //   uVar2 = sead::ExpHeap::create(lVar3, (long)&local_60, param_1, 8, 1, 0);
    for (int i = 0; i < 5; ++i) {
        const char *name = (names != nullptr && names[i] != nullptr) ? names[i] : "cGroup";
        *Slot(this, kSlotOffsets[i]) = sead::ExpHeap::create(
            static_cast<std::size_t>(sizes[i]), name, parent, 8, sead::HeapDirection::eForward,
            true);
    }

    // The sixth uses the literal name and a LITERAL SIZE OF 0 -- unlike the others.
    //   pcStack_58 = "cOthers"; ... ExpHeap::create(0, ...)
    *Slot(this, kSlotOffsets[5]) = sead::ExpHeap::create(
        0, othersName != nullptr ? othersName : "cOthers", parent, 8,
        sead::HeapDirection::eForward, true);
}

sead::Heap *HeapGroup::heapAt(int index) const {
    if (index < 0 || index >= kHeapCount) return nullptr;
    return *reinterpret_cast<sead::Heap *const *>(
        reinterpret_cast<const unsigned char *>(this) + kSlotOffsets[index]);
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
