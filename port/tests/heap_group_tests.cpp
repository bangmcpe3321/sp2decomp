// Contract tests for Lp::Sys::HeapGroup and sead::ForegroundBucketMgr.
//
// HeapGroup::createInstance (0x71011f4ffc, 160 bytes) and ForegroundBucketMgr::initialize
// (0x710139fb3c, 4 bytes -- a genuine no-op in the binary).
#include "lp/heap_group.hpp"
#include "sead/heap.hpp"
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
    std::printf("Lp::Sys::HeapGroup / sead::ForegroundBucketMgr contract tests\n\n");

    sead::HeapMgr::destroy();
    sead::Framework::InitializeArg arg;
    sead::Framework::initialize(arg);
    sead::Heap *root = sead::HeapMgr::getRootHeap(0);
    Check(root != nullptr, "a root heap exists to allocate the singleton from");

    std::printf("\nHeapGroup::createInstance (0x71011f4ffc)\n");
    Check(Lp::Sys::HeapGroup::instance() == nullptr,
          "no singleton exists before createInstance");

    const int liveBefore = root->liveAllocationCount();
    Lp::Sys::HeapGroup *hg = Lp::Sys::HeapGroup::createInstance(root);
    Check(hg != nullptr, "createInstance returns the singleton");
    Check(Lp::Sys::HeapGroup::instance() == hg, "and instance() agrees");
    Check(root->liveAllocationCount() == liveBefore + 1,
          "exactly one allocation was made from the supplied heap");

    // Idempotence: `if (plVar4 == 0) { ... } return plVar4;`
    Lp::Sys::HeapGroup *again = Lp::Sys::HeapGroup::createInstance(root);
    Check(again == hg, "a second createInstance returns the SAME singleton");
    Check(root->liveAllocationCount() == liveBefore + 1,
          "and allocates nothing further (idempotent)");

    // The two locks must be usable -- the original constructs both.
    hg->criticalSection().lock();
    hg->criticalSection().unlock();
    Check(true, "the CriticalSection locks and unlocks");

    hg->readWriteLock().lockWrite();
    hg->readWriteLock().unlockWrite();
    hg->readWriteLock().lockRead();
    hg->readWriteLock().unlockRead();
    Check(true, "the ReadWriteLock takes both read and write");

    // A refusal must not produce a half-built singleton.
    Lp::Sys::HeapGroup::deleteInstance();
    Check(Lp::Sys::HeapGroup::instance() == nullptr, "deleteInstance clears the singleton");
    Check(Lp::Sys::HeapGroup::createInstance(nullptr) == nullptr,
          "createInstance(nullptr) refuses rather than allocating elsewhere");
    Check(Lp::Sys::HeapGroup::instance() == nullptr,
          "and leaves no half-built singleton behind");

    std::printf("\nForegroundBucketMgr::initialize (0x710139fb3c, 4-byte no-op)\n");
    const int before = root->liveAllocationCount();
    sead::ForegroundBucketMgr::initialize(root, 1u, 2u, true);
    Check(true, "the no-op runs without effect, as the binary's body does");
    Check(root->liveAllocationCount() == before, "and allocates nothing");
    // It must be safe with every argument the boot root could pass.
    sead::ForegroundBucketMgr::initialize(nullptr, 0u, 0u, false);
    Check(true, "and is safe with null/invalid arguments too");

    std::printf("\n----------------------------------------\n");
    std::printf("%d checks, %d failures\n", g_checks, g_failures);
    return g_failures == 0 ? 0 : 1;
}
