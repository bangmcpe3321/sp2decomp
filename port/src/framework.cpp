// sead::Framework::initialize — ported from 0x7100e698ac (200 bytes).
#include "sead/framework_args.hpp"

#include "sead/heap.hpp"
#include "sead/heap_mgr.hpp"
#include "sead/thread_mgr.hpp"

namespace sead {

namespace {
Heap *gThreadMgrHeap = nullptr;
} // namespace

Heap *Framework::threadMgrHeap() { return gThreadMgrHeap; }

void Framework::initialize(const InitializeArg &arg) {
    // Clear any heap recorded by a previous call FIRST, so a failed or refused
    // initialisation cannot leave a dangling ThreadMgr heap. The refusal-path test caught
    // exactly that: without this, threadMgrHeap() reported the PREVIOUS run's heap.
    gThreadMgrHeap = nullptr;

    // --- the arena choice the decompiled body makes -------------------------------------
    //   if ((undefined8 *)param_1[1] == 0) HeapMgr::initialize(*param_1);
    //   else                               HeapMgr::initialize(param_1[1]);
    // arg.arena is at +0x08 and arg.heap_size at +0x00, matching the decompile's param_1[1]
    // and *param_1.
    if (arg.arena == nullptr) {
        HeapMgr::initialize(static_cast<std::size_t>(arg.heap_size));
    } else {
        HeapMgr::initialize(arg.arena);
    }

    // --- the root heap, which the boot path reads as sRootHeaps[0] ----------------------
    Heap *root = HeapMgr::getRootHeap(0);
    if (root == nullptr) return; // initialize() refused (null arena / allocation failure)

    // --- ThreadMgr heap ----------------------------------------------------------------
    //   pHVar1 = (Heap *)ExpHeap::create(0, (long)&local_30, pHVar2, 8, 1, 0);
    // Note the literal size 0, reproduced rather than corrected.
    ExpHeap *th = ExpHeap::create(0, "sead::ThreadMgr", root, 8, HeapDirection::eForward, true);
    if (th == nullptr) return;
    gThreadMgrHeap = th;

    //   ThreadMgr::createInstance(pHVar1);
    //   ThreadMgr::initialize(*(ThreadMgr **)PTR_sInstance_7102f9d280, pHVar1);
    ThreadMgr *mgr = ThreadMgr::createInstance(th);
    ThreadMgr::initialize(mgr, th);

    //   (**(code **)(*(long *)pHVar1 + 0x28))(pHVar1);   -- vptr+0x28, Heap::destroy
    th->destroy();

    //   GlobalRandom::createInstance(pHVar2);
    GlobalRandom::createInstance(root);
}

} // namespace sead
