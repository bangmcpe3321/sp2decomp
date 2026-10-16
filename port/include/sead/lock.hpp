// sead::CriticalSection and sead::ReadWriteLock — the locks Lp::Sys::HeapGroup owns.
//
// HeapGroup::createInstance (0x71011f4ffc, 160 bytes) constructs exactly these two at fixed
// offsets inside its 0x160-byte singleton:
//     sead::CriticalSection::CriticalSection((CriticalSection *)(obj + 2));   // +0x10
//     sead::ReadWriteLock::ReadWriteLock((ReadWriteLock *)(obj + 10));        // +0x50
//
// Implemented over host synchronisation primitives, the same interface-not-algorithm choice
// the platform layer used for nn::os and the heap layer used for ExpHeap.
#pragma once

namespace sead {

class CriticalSection {
public:
    CriticalSection();
    ~CriticalSection();

    void lock();
    void unlock();
    bool tryLock();

    CriticalSection(const CriticalSection &) = delete;
    CriticalSection &operator=(const CriticalSection &) = delete;

private:
    // Storage for the host primitive, sized generously so the header carries no platform
    // dependency. Initialised in the implementation.
    alignas(8) unsigned char mStorage[0x38] = {}; // total 0x40 so HeapGroup lands mRW at +0x50
    bool mInitialised = false;
};

class ReadWriteLock {
public:
    ReadWriteLock();
    ~ReadWriteLock();

    void lockRead();
    void lockWrite();
    void unlockRead();
    void unlockWrite();

    ReadWriteLock(const ReadWriteLock &) = delete;
    ReadWriteLock &operator=(const ReadWriteLock &) = delete;

private:
    alignas(8) unsigned char mStorage[0xB0] = {}; // total 0xB8 so HeapGroup lands mDisposer at +0x108
    bool mInitialised = false;
};

} // namespace sead
