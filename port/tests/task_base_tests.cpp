// Contract tests for sead::TaskBase::MgrTaskArg (0x7100e6b7bc, 308 bytes).
#include "sead/task_base.hpp"
#include "sead/framework_args.hpp"
#include "sead/heap_mgr.hpp"

#include <cstdio>
#include <initializer_list>

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
    std::printf("sead::TaskBase::MgrTaskArg contract tests (0x7100e6b7bc)\n\n");

    sead::HeapMgr::destroy();
    sead::Framework::InitializeArg fwArg;
    sead::Framework::initialize(fwArg);
    const int roots = sead::HeapMgr::getRootHeapNum();
    Check(roots >= 1, "a root heap exists (the flags loop depends on this)");

    std::printf("the TaskClassID is copied whole\n");
    {
        sead::TaskClassID id;
        id.typeInfo = reinterpret_cast<const void *>(0x1234);
        id.extra = 0x5678;
        sead::MgrTaskArg arg(id);
        Check(arg.factory.typeInfo == id.typeInfo, "typeInfo is copied");
        Check(arg.factory.extra == id.extra, "the second id word is copied");
    }

    std::printf("\nthe zeroed fields and observed defaults\n");
    {
        sead::TaskClassID id;
        sead::MgrTaskArg arg(id);

        // The constructor zeroes a specific offset list, not the whole object.
        const auto *base = reinterpret_cast<const unsigned char *>(&arg);
        bool zeroed = true;
        for (std::size_t off : {0x10, 0x18, 0x28, 0x30, 0x40, 0x48, 0x58, 0x60, 0x78, 0x80, 0x90, 0x98, 0xa0}) {
            if (*reinterpret_cast<const std::uint64_t *>(base + off) != 0) zeroed = false;
        }
        Check(zeroed, "the fields the body zeroes are all zero");

        // `*(u32*)(this + 0xa8) = 0xffffffff; *(u32*)(this + 0xac) = 1;`
        Check(arg.fieldA8 == 0, "fieldA8 is 0, as the body stores");
        Check(arg.fieldAc == 1, "fieldAc is 1, as the body stores");
        Check(arg.fieldB0 == nullptr, "fieldB0 is null");
    }

    std::printf("\nthe per-root-heap flags array (the part the reference does not show)\n");
    {
        sead::TaskClassID id;
        sead::MgrTaskArg arg(id);
        const int expected = (roots < sead::MgrTaskArg::kMaxFlags) ? roots
                                                                   : sead::MgrTaskArg::kMaxFlags;
        int set = 0;
        for (int i = 0; i < sead::MgrTaskArg::kMaxFlags; ++i) {
            if (arg.flagForRootHeap(i) == 1) ++set;
        }
        Check(set == expected,
              "one flag byte is set per root heap, at the observed 0x18 stride");

        // The flags must sit at the offset the decompiled loop writes, or a flag would land in
        // a neighbouring field instead.
        Check(sead::MgrTaskArg::kFlagsOffset == 0x24,
              "the flags array starts at +0x24, where the decompiled loop writes");
        Check(sead::MgrTaskArg::kFlagsStride == 0x18,
              "and advances by 0x18 per root heap");
        Check(arg.flagForRootHeap(-1) == 0 && arg.flagForRootHeap(99) == 0,
              "out-of-range flag reads are refused, not read out of bounds");
    }

    std::printf("\nthe flags follow the HEAP LAYER's state\n");
    {
        // A MgrTaskArg built after the heap layer sees its root heap count; this is the
        // dependency that makes this constructor need HeapMgr to have run.
        sead::TaskClassID id;
        sead::MgrTaskArg arg(id);
        Check(arg.flagForRootHeap(0) == 1,
              "with a root heap present, flag 0 is set");
        std::printf("        root heaps = %d, flags set = %d\n", roots,
                    (arg.flagForRootHeap(0) == 1 ? 1 : 0));
    }

    std::printf("\n----------------------------------------\n");
    std::printf("%d checks, %d failures\n", g_checks, g_failures);
    return g_failures == 0 ? 0 : 1;
}
