// sead::Framework argument structs — ported from their decompiled constructors.
//
// Both are small and FULLY OBSERVABLE: the constructors are literal 8-byte stores, so
// there is no layout ambiguity to resolve. Field names come from the open-ead/sead
// reference (copies in reference/seadFramework.h); the VALUES come from the binary, and
// they do not always agree with the reference's implied defaults — see the notes below.
//
//   sead::Framework::InitializeArg::InitializeArg()  @ 0x7100e69894
//     *(u64 *)this     = 0x3000000    // 48 MB
//     *(u64 *)(this+8) = 0
//
//   sead::Framework::RunArg::RunArg()                @ 0x7100e698a0
//     *(u64 *)this     = 0xffffffff00000000          // two packed 32-bit fields
//
// The reference declares:
//   struct InitializeArg { u64 heap_size; Arena* arena; };
//   struct RunArg { u32 prepare_stack_size; s32 prepare_priority; };
// which matches the observed 16-byte and 8-byte footprints.
#pragma once

#include <cstdint>

namespace sead {

class Arena; // forward; only its address is stored

class Framework {
public:
    struct InitializeArg {
        InitializeArg();

        std::uint64_t heap_size; // +0x00, observable default 0x3000000 (48 MB)
        Arena *arena;            // +0x08, observable default null
    };

    struct RunArg {
        RunArg();

        // The constructor writes one 64-bit word, 0xffffffff00000000. Reading it as the
        // reference's two 32-bit fields gives prepare_stack_size = 0 and
        // prepare_priority = -1, which is what the comments below record. The raw store is
        // reproduced rather than the reconstruction, so the observable value is exact.
        std::uint32_t prepare_stack_size; // +0x00
        std::int32_t prepare_priority;    // +0x04
    };
};

} // namespace sead
