// Contract tests for sead::Framework::initialize (0x7100e698ac).
//
// This is the first function that CONSUMES the ported InitializeArg and CALLS the ported
// HeapMgr::initialize overloads, so these tests exercise the joined-up path.
#include "sead/framework_args.hpp"
#include "sead/heap.hpp"
#include "sead/heap_mgr.hpp"
#include "sead/thread_mgr.hpp"

#include <cstdio>
#include <string>

namespace {
int g_failures = 0;
int g_checks = 0;
void Check(bool cond, const char *what) {
    ++g_checks;
    if (!cond) { ++g_failures; std::printf("  FAIL  %s\n", what); }
    else { std::printf("  ok    %s\n", what); }
}
} // namespace

int main() {
    std::printf("sead::Framework::initialize contract tests (0x7100e698ac)\n\n");

    // --- the size path: arg.arena == nullptr, so HeapMgr::initialize(arg.heap_size) -------
    {
        std::printf("arena == nullptr -> HeapMgr::initialize(heap_size)\n");
        sead::HeapMgr::destroy();
        sead::Framework::InitializeArg arg; // 48 MB, null arena
        Check(arg.arena == nullptr, "the ported InitializeArg has a null arena");

        sead::Framework::initialize(arg);

        Check(sead::HeapMgr::getRootHeapNum() == 1,
              "Framework::initialize created a root heap via the size overload");
        sead::Heap *root = sead::HeapMgr::getRootHeap(0);
        Check(root != nullptr, "and the root heap is reachable as sRootHeaps[0]");

        sead::Heap *thHeap = sead::Framework::threadMgrHeap();
        Check(thHeap != nullptr, "the ThreadMgr heap was created");
        if (thHeap != nullptr) {
            Check(std::string(thHeap->name()) == "sead::ThreadMgr",
                  "and carries the name the decompiled body passes");
        }
        Check(sead::ThreadMgr::instance()->isInitialized(),
              "ThreadMgr::initialize was called with that heap");
        Check(sead::ThreadMgr::instance()->heap() == thHeap,
              "and the ThreadMgr holds it");
        Check(sead::GlobalRandom::instance() != nullptr,
              "GlobalRandom::createInstance ran");

        // The RNG must be usable and deterministic per createInstance.
        const std::uint32_t r1 = sead::GlobalRandom::instance()->next();
        Check(r1 != 0, "GlobalRandom::next returns a non-zero value");
        sead::GlobalRandom::createInstance(root);
        Check(sead::GlobalRandom::instance()->next() == r1,
              "re-creating resets the sequence (deterministic, reproducible)");
    }

    std::printf("\n");
    // --- the arena path: arg.arena != nullptr, so HeapMgr::initialize(arg.arena) ---------
    {
        std::printf("arena != nullptr -> HeapMgr::initialize(arena)\n");
        sead::HeapMgr::destroy();
        static unsigned char arenaMem[0x100000]; // 1 MB, static so it outlives the framework
        sead::Arena arena(arenaMem, sizeof(arenaMem));

        sead::Framework::InitializeArg arg;
        arg.arena = &arena;

        sead::Framework::initialize(arg);

        Check(sead::HeapMgr::getRootHeapNum() == 1, "the arena overload created a root heap");
        sead::Heap *root = sead::HeapMgr::getRootHeap(0);
        Check(root != nullptr && root->getSize() == sizeof(arenaMem),
              "sized from the caller's arena, not from heap_size");
        Check(sead::Framework::threadMgrHeap() != nullptr,
              "the ThreadMgr heap was created in the arena path too");
    }

    std::printf("\n");
    // --- the refusal path ---------------------------------------------------------------
    {
        std::printf("refusal when there is no usable arena\n");
        sead::HeapMgr::destroy();
        sead::Framework::InitializeArg arg;
        arg.heap_size = 0;    // no arena and no size -> initialize() must refuse
        arg.arena = nullptr;
        sead::Framework::initialize(arg);
        Check(sead::HeapMgr::getRootHeapNum() == 0,
              "a zero-size request creates no root heap");
        Check(sead::Framework::threadMgrHeap() == nullptr ||
                  sead::HeapMgr::getRootHeap(0) != nullptr,
              "and Framework::initialize returns without a dangling ThreadMgr heap");
    }

    std::printf("\nsead::Framework::Framework (0x7100e696a4, 60 bytes)\n");
    {
        sead::Framework fw;
        const unsigned char *base = reinterpret_cast<const unsigned char *>(&fw);

        // The decompiled body self-links the reset event's node at +0x20/+0x28.
        void *const *head = reinterpret_cast<void *const *>(base + 0x20);
        void *const *tail = reinterpret_cast<void *const *>(base + 0x28);
        Check(*head == const_cast<void *>(static_cast<const void *>(base + 0x20)),
              "mResetEvent head self-links to +0x20");
        Check(*tail == const_cast<void *>(static_cast<const void *>(base + 0x20)),
              "and the tail links back to +0x20 too");

        // The fields the constructor zeroes.
        Check(*reinterpret_cast<const unsigned int *>(base + 0x30) == 0, "+0x30 is zeroed");
        Check(*reinterpret_cast<void *const *>(base + 0x38) == nullptr, "+0x38 is zeroed");
        Check(*reinterpret_cast<void *const *>(base + 0x40) == nullptr,
              "mTaskMgr (+0x40) starts null");
        Check(*reinterpret_cast<void *const *>(base + 0x48) == nullptr,
              "mMethodTreeMgr (+0x48) starts null");
        Check(*reinterpret_cast<void *const *>(base + 0x10) == nullptr, "+0x10 is zeroed");
        std::printf("        constructed; reset event self-linked at +0x20\n");
    }

    std::printf("\n----------------------------------------\n");
    std::printf("%d checks, %d failures\n", g_checks, g_failures);
    return g_failures == 0 ? 0 : 1;
}
