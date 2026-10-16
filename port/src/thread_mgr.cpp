// sead::ThreadMgr / sead::GlobalRandom — minimal call-contract implementations.
#include "sead/thread_mgr.hpp"

namespace sead {

namespace {
ThreadMgr gThreadMgr;
GlobalRandom gGlobalRandom;
} // namespace

ThreadMgr *ThreadMgr::createInstance(Heap *heap) {
    gThreadMgr.mHeap = heap;
    gThreadMgr.mInitialized = false;
    return &gThreadMgr;
}

ThreadMgr *ThreadMgr::instance() { return &gThreadMgr; }

void ThreadMgr::initialize(ThreadMgr *mgr, Heap *heap) {
    if (mgr == nullptr) return;
    mgr->mHeap = heap;
    mgr->mInitialized = true;
}

GlobalRandom *GlobalRandom::createInstance(Heap *heap) {
    (void)heap; // the RNG does not allocate; the heap argument is accepted for fidelity
    gGlobalRandom.mState = 1u;
    return &gGlobalRandom;
}

GlobalRandom *GlobalRandom::instance() { return &gGlobalRandom; }

std::uint32_t GlobalRandom::next() {
    // xorshift32 -- a deterministic generator. The original's algorithm is not observable
    // from Framework::initialize, so this provides *a* reproducible sequence rather than a
    // claim to match the original's stream.
    std::uint32_t x = gGlobalRandom.mState;
    x ^= x << 13;
    x ^= x >> 17;
    x ^= x << 5;
    gGlobalRandom.mState = x;
    return x;
}

} // namespace sead
