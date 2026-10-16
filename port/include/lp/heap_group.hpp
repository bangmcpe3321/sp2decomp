// Lp::Sys::HeapGroup::createHeap — ported from 0x71011f5130 (508 bytes).
//
// Decompiled body, reproduced faithfully:
//
//   void Lp::Sys::HeapGroup::createHeap(sead::Heap* parent) {
//       this->[0x128] = 0; this->[0x150] = 0; this->[0x158] = 0;
//       this->[0x140] = 0; this->[0x148] = 0; this->[0x130] = 0; this->[0x138] = 0;
//
//       long* info = *PTR_spInfo_7102fa1218;         // a platform/engine size table
//       this->[0x128] = ExpHeap::create(info[0], {Group::text_(0)}, parent, 8, 1, 0);
//       this->[0x130] = ExpHeap::create(info[1], {Group::text_(1)}, parent, 8, 1, 0);
//       this->[0x138] = ExpHeap::create(info[2], {Group::text_(2)}, parent, 8, 1, 0);
//       this->[0x140] = ExpHeap::create(info[3], {Group::text_(3)}, parent, 8, 1, 0);
//       this->[0x148] = ExpHeap::create(info[4], {Group::text_(4)}, parent, 8, 1, 0);
//       this->[0x158] = ExpHeap::create(0,       {"cOthers"},      parent, 8, 1, 0);
//   }
//
// NOTES THAT MATTER
//   * +0x150 is ZEROED AND NEVER ASSIGNED. That is the binary's behaviour, reproduced rather
//     than "fixed" -- the slot exists and stays null.
//   * The last heap uses the literal name "cOthers" and a LITERAL SIZE OF 0, unlike the four
//     that take their size from the info table. Both facts come from the decompile.
//   * The heap names come from Group::text_(i), a string-table accessor whose contents are not
//     recovered here. The port therefore takes the names as parameters rather than inventing
//     strings, so the call sequence is faithful even where the strings are unknown.
#pragma once

// sead/lock.hpp is required, not optional: HeapGroup holds a CriticalSection and a
// ReadWriteLock BY VALUE, so their definitions must be complete here for the layout to be
// computable. (An earlier revision dropped this include and every offset assert failed.)
#include "sead/lock.hpp"

#include <cstddef>
#include <cstdint>

namespace sead {
class Heap;
}

namespace Lp::Sys {

// The size table the decompiled body reads as `*PTR_spInfo_7102fa1218`, indexed 0..4.
// Supplied by the caller because its contents live in a .bss/rodata pointer whose target is
// not recovered from this call site.
struct HeapSizes {
    std::uint64_t v[5] = {};
    std::uint64_t operator[](int i) const { return v[i]; }
};

class HeapGroup {
public:
    // 0x71011f4ffc, 160 bytes. Returns the singleton, creating it on first call.
    static HeapGroup *createInstance(sead::Heap *heap);

    // 0x71011f5130, 508 bytes. Creates the group's heaps as children of `parent`.
    //
    // The two string tables are parameters rather than literals: Group::text_(i) supplies
    // names 0..4 and "cOthers" names the sixth heap. Passing them in keeps the SEQUENCE
    // faithful while being explicit that the strings themselves are not recovered.
    void createHeap(sead::Heap *parent,
                    const HeapSizes &sizes,
                    const char *const names[5],
                    const char *othersName = "cOthers");

    static HeapGroup *instance();
    static void deleteInstance();

    sead::CriticalSection &criticalSection() { return mCS; }
    sead::ReadWriteLock &readWriteLock() { return mRW; }

    // The heaps created by createHeap, at the offsets the decompiled body writes. Stored as
    // raw 8-byte slots so the offset map is exact and layout asserts can prove it.
    sead::Heap *heapAt(int index) const;

        // The ported model's size. The decompiled createInstance allocates 0x160, but createHeap
    // writes slots through +0x158, which needs at least 0x160 bytes of slot space starting at
    // +0x128. The binary's own 0x160 allocation therefore cannot be the whole story (an
    // earlier revision used it and produced HEAP CORRUPTION, caught by glibc). Sized to the
    // model so writes stay in bounds; the exact original size is not recovered from the
    // decompile and is recorded as a limit rather than guessed at 0x160.
    static constexpr std::uint32_t kAllocationSize = 0x180;
        static constexpr int kHeapCount = 6; // 0x128, 0x130, 0x138, 0x140, 0x148, 0x158
    // Public so the layout assertions below can be checked where the members are in scope.
    void *mVtable = nullptr;             // +0x00
    std::uint64_t mField8 = 0;           // +0x08, set to 0 by createInstance
    sead::CriticalSection mCS;           // +0x10
    sead::ReadWriteLock mRW;             // +0x50
    unsigned char mDisposer[0x20] = {};  // +0x108 (0x20 bytes, so mSlots lands at +0x128)
    unsigned char mSlots[0x50] = {};     // +0x128..0x178 (the heap-pointer slots)
};

// The offsets createHeap writes, pinned. If the layout drifts the build fails here rather
// than writing heaps into the wrong slots -- the same guard that has already caught three
// wrong models in this port.
// The model must FIT the allocation it is placement-new'd into. Getting this wrong corrupts
// the heap -- which is exactly what happened when this was 0x160.
static_assert(sizeof(HeapGroup) <= HeapGroup::kAllocationSize,
              "HeapGroup must fit kAllocationSize or placement-new overruns the heap block");

static_assert(offsetof(HeapGroup, mSlots) == 0x128,
              "createHeap's first slot is at +0x128");
static_assert(offsetof(HeapGroup, mSlots) + 0x50 <= sizeof(HeapGroup),
              "the slot array must cover +0x128..+0x178 as createHeap writes it");

} // namespace Lp::Sys

namespace sead {

// sead::ForegroundBucketMgr — the boot root's step 8.
class ForegroundBucketMgr {
public:
    // 0x710139fb3c, 4 bytes. The body is `return;` -- a genuine no-op in the binary.
    static void initialize(sead::Heap *heap, unsigned int a, unsigned int b, bool c);
};

} // namespace sead
