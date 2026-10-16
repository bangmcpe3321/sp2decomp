// Contract tests for sead::GameFramework / GameFrameworkNx::initialize.
//
// Ported from 0x7100e69fe4 (456 bytes) and 0x7100e6724c (20 bytes). The checks follow the
// boot path, which is the only usage evidence: Framework::initialize first, then one heap per
// system manager, each installed as current only for its own createInstance.
#include "sead/game_framework.hpp"
#include "sead/game_framework_nx.hpp"
#include "sead/heap.hpp"
#include "sead/heap_mgr.hpp"

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
    std::printf("sead::GameFramework::initialize contract tests\n");
    std::printf("(0x7100e69fe4, 456 bytes; wrapper 0x7100e6724c)\n\n");

    sead::HeapMgr::destroy();
    sead::Framework::InitializeArg arg; // 48 MB, null arena

    std::printf("GameFramework::initialize\n");
    sead::GameFramework::initialize(arg);

    Check(sead::HeapMgr::getRootHeapNum() == 1,
          "the base Framework::initialize created the root heap");
    sead::Heap *root = sead::HeapMgr::getRootHeap(0);
    Check(root != nullptr, "and it is reachable as sRootHeaps[0]");

    sead::Heap *sys = sead::GameFramework::systemManagersHeap();
    Check(sys != nullptr, "the sead::SystemManagers heap was created");
    if (sys != nullptr) {
        Check(std::string(sys->name()) == "sead::SystemManagers",
              "carrying the name the decompiled body passes");
        Check(sys->getSize() > 0, "sized from the parent's getMaxAllocatableSize(8)");
        // Its budget must come from the ROOT heap's answer, which is the boot pattern.
        Check(sys->getSize() <= root->getSize(),
              "and no larger than the root heap it was carved from");
    }

    sead::ResourceMgr *res = sead::ResourceMgr::instance();
    Check(res != nullptr, "ResourceMgr::createInstance ran");
    Check(res->heap() != nullptr, "and ResourceMgr holds the heap it was given");
    if (res->heap() != nullptr) {
        Check(std::string(res->heap()->name()) == "sead::ResourceMgr",
              "with the sead::ResourceMgr heap");
    }

    sead::FileDeviceMgr *fdev = sead::FileDeviceMgr::instance();
    Check(fdev != nullptr, "FileDeviceMgr::createInstance ran");
    Check(fdev->heap() != nullptr, "and FileDeviceMgr holds its heap");

    // The current heap must be RESTORED after each manager, because the binary's body does
    // `if (prev != 1) setCurrentHeap_(prev)`. A failure here would mean managers leak their
    // heap as "current" and later allocations land in the wrong place.
    Check(sead::HeapMgr::instance()->getCurrentHeap() != res->heap(),
          "ResourceMgr's heap is NOT left as the current heap (restore happened)");
    Check(sead::HeapMgr::instance()->getCurrentHeap() != fdev->heap(),
          "FileDeviceMgr's heap is NOT left as current either");

    std::printf("\n");
    std::printf("GameFrameworkNx::initialize (the 20-byte wrapper)\n");
    const int before = sead::PerformanceMgrNx::initializeCount();
    sead::GameFrameworkNx::initialize(arg);
    Check(sead::PerformanceMgrNx::initializeCount() == before + 1,
          "the wrapper forwarded to PerformanceMgrNx::initialize (the platform import)");
    Check(sead::HeapMgr::getRootHeapNum() >= 1,
          "and GameFramework::initialize ran through it");

    std::printf("\n");
    std::printf("refusal path leaves no stale state\n");
    sead::HeapMgr::destroy();
    sead::Framework::InitializeArg zero;
    zero.heap_size = 0;
    zero.arena = nullptr;
    sead::GameFrameworkNx::initialize(zero);
    Check(sead::GameFramework::systemManagersHeap() == nullptr,
          "a refused run leaves no SystemManagers heap behind");

    std::printf("\n----------------------------------------\n");
    std::printf("%d checks, %d failures\n", g_checks, g_failures);
    return g_failures == 0 ? 0 : 1;
}
