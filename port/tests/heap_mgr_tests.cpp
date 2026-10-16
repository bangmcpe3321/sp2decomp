// Contract tests for sead::HeapMgr.
//
// These follow the boot path exactly, because that is the only usage evidence available:
//   Framework::initialize:  if (arg.arena == nullptr) HeapMgr::initialize(arg.heap_size);
//                           else                      HeapMgr::initialize(arg.arena);
//                           Heap* root = sRootHeaps[0];
//                           Heap* th = ExpHeap::create(root->getMaxAllocatableSize(8), ...);
//   GameFramework::initialize: same shape, one heap per system manager, with
//                           prev = setCurrentHeap_(new); ...; if (prev != 1) setCurrentHeap_(prev);
#include "sead/heap_mgr.hpp"
#include "sead/framework_args.hpp"

#include <cstdio>

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
    std::printf("sead::HeapMgr contract tests\n");
    std::printf("(boot entries: initialize(size) / initialize(Arena*), createRootHeap_)\n\n");

    // --- the size form, as Framework::initialize uses when arg.arena == nullptr ----------
    {
        std::printf("HeapMgr::initialize(size) -- the size form\n");
        // 48 MB, exactly what the ported InitializeArg carries.
        sead::Framework::InitializeArg arg;
        Check(arg.arena == nullptr, "the ported InitializeArg has a null arena");
        Check(arg.heap_size == 0x3000000, "and a 48 MB heap_size");

        sead::HeapMgr::initialize(static_cast<std::size_t>(arg.heap_size));
        Check(sead::HeapMgr::getRootHeapNum() == 1, "one root heap exists after initialize(size)");

        sead::Heap *root = sead::HeapMgr::getRootHeap(0);
        Check(root != nullptr, "getRootHeap(0) returns it -- this is sRootHeaps[0]");
        if (root != nullptr) {
            Check(root->getSize() == 0x3000000, "the root heap's budget is the arena size");
            // THE BOOT-PATH CALL: size the first per-manager heap from the root heap.
            const std::size_t sysSize = root->getMaxAllocatableSize(8);
            Check(sysSize > 0, "root->getMaxAllocatableSize(8) answers -- the boot pattern works");

            // Reproduce GameFramework::initialize's per-manager construction.
            sead::ExpHeap *sys = sead::ExpHeap::create(sysSize, "sead::SystemManagers", root);
            Check(sys != nullptr, "a system-manager heap is created from that size");

            // prev = setCurrentHeap_(sys); ... restore if prev != 1
            sead::Heap *prev = sead::HeapMgr::instance()->setCurrentHeap_(sys);
            Check(prev != nullptr, "setCurrentHeap_ returns a previous value");
            Check(sead::HeapMgr::instance()->getCurrentHeap() == sys,
                  "and the new heap is current");
            // The binary tests `prev != 1` before restoring; here prev was the root heap.
            Check(prev != reinterpret_cast<sead::Heap *>(1),
                  "prev is a real heap, not the no-previous sentinel");
            sead::HeapMgr::instance()->setCurrentHeap_(prev);
            Check(sead::HeapMgr::instance()->getCurrentHeap() == root,
                  "restoring prev puts the root heap back");

            if (sys != nullptr) {
                sys->freeAll();
                sys->destroy();
                delete sys;
            }
        }
    }

    std::printf("\n");
    // --- the arena form ----------------------------------------------------------------
    {
        std::printf("HeapMgr::initialize(Arena*) -- the arena form\n");
        static unsigned char arenaMem[0x200000]; // 2 MB, static so it outlives the manager
        sead::Arena arena(arenaMem, sizeof(arenaMem));
        Check(arena.isInitialized(), "the caller's arena reports initialized");

        sead::HeapMgr::destroy();
        Check(sead::HeapMgr::getRootHeapNum() == 0, "destroy clears the root heaps");

        sead::HeapMgr::initialize(&arena);
        Check(sead::HeapMgr::getRootHeapNum() == 1, "arena form creates a root heap");
        sead::Heap *root = sead::HeapMgr::getRootHeap(0);
        Check(root != nullptr && root->getSize() == sizeof(arenaMem),
              "the root heap is sized from the caller's arena");

        // A null or uninitialised arena must be refused, not crash.
        sead::HeapMgr::initialize(static_cast<sead::Arena *>(nullptr));
        Check(true, "initialize(nullptr) is refused safely");
        sead::Arena empty;
        sead::HeapMgr::initialize(&empty);
        Check(true, "initialize(&uninitialised) is refused safely");
    }

    std::printf("\n");
    // --- the no-previous-heap sentinel -------------------------------------------------
    {
        std::printf("setCurrentHeap_ sentinel behaviour\n");
        sead::HeapMgr::destroy();
        // After destroy, mCurrentHeap is null, so setting a heap has no previous: the
        // binary's caller tests `prev != 1`, so the sentinel must be exactly 1.
        sead::ExpHeap *h = sead::ExpHeap::create(0x1000, "sentinel");
        Check(h != nullptr, "a heap to install");
        if (h != nullptr) {
            sead::Heap *prev = sead::HeapMgr::instance()->setCurrentHeap_(h);
            Check(prev == reinterpret_cast<sead::Heap *>(1),
                  "with no previous heap, setCurrentHeap_ returns the sentinel 1");
            sead::HeapMgr::instance()->setCurrentHeap_(nullptr);
            h->destroy();
            delete h;
        }
    }

    std::printf("\n----------------------------------------\n");
    std::printf("%d checks, %d failures\n", g_checks, g_failures);
    return g_failures == 0 ? 0 : 1;
}
