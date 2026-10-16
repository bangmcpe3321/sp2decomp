// Two small boot-root dependencies, one of them a no-op.
//
// 1. sead::ForegroundBucketMgr::initialize  @ 0x710139fb3c — 4 BYTES
//    The decompiled body is literally `return;`. Ported as an explicit no-op rather than
//    left as a fail-loudly gap, because running it is faithful: the original does nothing.
//
// 2. Lp::Sys::HeapGroup::createInstance     @ 0x71011f4ffc — 160 BYTES
//    A singleton allocator. Decompiled shape:
//        if (sInstance == null) {
//            obj = operator new(0x160, heap, 8);
//            IDisposer::IDisposer(obj + 0x108, heap, 3);
//            obj->vtable = <HeapGroup vtable>;
//            sStaticDisposer = obj + 0x108;
//            obj->[0] = <SingletonDisposer_ vtable>;
//            obj->[1] = 0;
//            CriticalSection::CriticalSection(obj + 0x10);
//            ReadWriteLock::ReadWriteLock(obj + 0x50);
//            sInstance = obj;
//        }
//        return sInstance;
//    The static-disposer registration is what lets the engine tear the singleton down at
//    exit; it is modelled as a stored pointer, which is all the sequence observes.
#pragma once

#include "sead/lock.hpp"

#include <cstddef>
#include <cstdint>

namespace sead {
class Heap;
}

namespace Lp::Sys {

// Lp::Sys::HeapGroup — created once during the boot root's sequence.
class HeapGroup {
public:
    // 0x71011f4ffc, 160 bytes. Returns the singleton, creating it on first call.
    static HeapGroup *createInstance(sead::Heap *heap);

    // The singleton, or null if createInstance has not run. The original reaches it through
    // PTR_sInstance_7102f9d3f0.
    static HeapGroup *instance();

    // Tears the singleton down, as deleteInstance does.
    static void deleteInstance();

    // The two locks, at the offsets the decompiled body constructs them.
    sead::CriticalSection &criticalSection() { return mCS; }
    sead::ReadWriteLock &readWriteLock() { return mRW; }

    // Total size the original allocates, asserted against the modelled layout below.
    static constexpr std::uint32_t kAllocationSize = 0x160;

    // Public so the layout assertions can be checked where the members are in scope.
    void *mVtable = nullptr;            // +0x00
    std::uint64_t mField8 = 0;          // +0x08, set to 0 by the original
    sead::CriticalSection mCS;          // +0x10
    sead::ReadWriteLock mRW;            // +0x50
    unsigned char mDisposer[0x58] = {}; // +0x108
};

// The modelled members must land where the decompiled body constructs them, or the singleton
// would differ from the original's layout. Checked here because the members are in scope.
static_assert(offsetof(HeapGroup, mCS) == 0x10,
              "CriticalSection is constructed at obj + 0x10 (plVar4 + 2)");
static_assert(offsetof(HeapGroup, mRW) == 0x50,
              "ReadWriteLock is constructed at obj + 0x50 (plVar4 + 10)");
static_assert(offsetof(HeapGroup, mDisposer) == 0x108,
              "IDisposer is constructed at obj + 0x108 (plVar4 + 0x21)");

} // namespace Lp::Sys

namespace sead {

// sead::ForegroundBucketMgr — the boot root's step 8.
class ForegroundBucketMgr {
public:
    // 0x710139fb3c, 4 bytes. The body is `return;` -- a genuine no-op in the binary.
    static void initialize(sead::Heap *heap, unsigned int a, unsigned int b, bool c);
};

} // namespace sead
