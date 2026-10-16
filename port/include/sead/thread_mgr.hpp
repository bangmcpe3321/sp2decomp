// sead::ThreadMgr / sead::GlobalRandom — the two dependencies of Framework::initialize.
//
// Both are minimal: the decompiled body calls ThreadMgr::createInstance(heap) and
// ThreadMgr::initialize(instance, heap), then GlobalRandom::createInstance(rootHeap). What
// those do internally is not observable from this call site, so this models the CALL
// CONTRACT (an instance that can be created and initialised) rather than inventing thread
// or RNG semantics that would be guesses.
//
// That restraint is deliberate: the platform layer's nn::os provides real threading, and the
// engine's ThreadMgr sits on top of it. Porting its internals needs its own decompiled body,
// which is not part of the boot root's 13 dependencies.
#pragma once

#include <cstdint>

namespace sead {

class Heap;

// sead::ThreadMgr — created and initialised with a heap during Framework::initialize.
class ThreadMgr {
public:
    static ThreadMgr *createInstance(Heap *heap);
    static ThreadMgr *instance();

    // The reference's initialize takes the instance pointer and a heap.
    static void initialize(ThreadMgr *mgr, Heap *heap);

    Heap *heap() const { return mHeap; }
    bool isInitialized() const { return mInitialized; }

private:
    Heap *mHeap = nullptr;
    bool mInitialized = false;
};

// sead::GlobalRandom — the engine's shared RNG, created with the root heap.
class GlobalRandom {
public:
    static GlobalRandom *createInstance(Heap *heap);
    static GlobalRandom *instance();

    // A deterministic default seed, so behaviour is reproducible across runs. The original's
    // seed source is not observable from Framework::initialize.
    std::uint32_t next();

    void setSeed(std::uint32_t seed) { mState = seed ? seed : 1u; }

private:
    std::uint32_t mState = 1u;
};

} // namespace sead
