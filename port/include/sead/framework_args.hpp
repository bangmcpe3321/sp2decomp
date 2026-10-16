// sead::Framework — its argument structs and the initialize entry point.
//
// TWO SOURCES, BOTH COMMITTED AS REFERENCE:
//   reference/seadFramework.h      -- the class and its argument structs
//   the binary's decompiled bodies -- the VALUES and the call sequence
//
// Argument constructors, ported from their decompiled bodies (literal stores, so exact):
//   sead::Framework::InitializeArg::InitializeArg()  @ 0x7100e69894
//     *(u64 *)this     = 0x3000000    // 48 MB
//     *(u64 *)(this+8) = 0
//   sead::Framework::RunArg::RunArg()                @ 0x7100e698a0
//     *(u64 *)this     = 0xffffffff00000000
//
// initialize, ported from 0x7100e698ac (200 bytes):
//   void sead::Framework::initialize(const InitializeArg& arg) {
//       if (arg.arena == nullptr) HeapMgr::initialize(arg.heap_size);
//       else                      HeapMgr::initialize(arg.arena);
//       Heap* root = <sRootHeaps[0]>;
//       Heap* th = ExpHeap::create(0, {"sead::ThreadMgr"}, root, 8, 1, 0);
//       ThreadMgr::createInstance(th); ThreadMgr::initialize(instance, th);
//       th->destroy(th);                       // vptr+0x28
//       GlobalRandom::createInstance(root);
//   }
//
// THE REFERENCE'S VALUES DO NOT ALWAYS MATCH THE BINARY'S, and the binary wins: RunArg's
// constructor stores a word mapping to stack_size=0, priority=-1, whereas the reference
// implies no particular defaults. Values here are the binary's.
#pragma once

#include <cstdint>

namespace sead {

class Arena; // forward; only its address is stored
class Heap;

class Framework {
public:
    struct InitializeArg {
        InitializeArg();

        std::uint64_t heap_size; // +0x00, observable default 0x3000000 (48 MB)
        Arena *arena;            // +0x08, observable default null
    };

    struct RunArg {
        RunArg();

        // The constructor writes one 64-bit word, 0xffffffff00000000. The port stores those
        // bytes verbatim (see framework_args.cpp), which is byte-exact and cannot be got
        // wrong by reasoning about halves or endianness -- four attempts proved that.
        std::uint32_t prepare_stack_size; // +0x00
        std::int32_t prepare_priority;    // +0x04
    };

    // 0x7100e698ac, 200 bytes. First consumer of InitializeArg; calls the ported
    // HeapMgr::initialize overloads.
    static void initialize(const InitializeArg &arg);

    // The heap the ThreadMgr was given, retained so a later stage can inspect or restore it.
    // The original reaches it through PTR_sInstance_7102f9d280.
    static Heap *threadMgrHeap();
};

} // namespace sead
