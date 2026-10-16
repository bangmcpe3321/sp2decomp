// sead::Framework argument constructors — ported from 0x7100e69894 and 0x7100e698a0.
//
// Both bodies are literal stores, so the ports reproduce the exact observable bytes rather
// than deriving member values and risking an ordering mistake.
//
// RunArg took FOUR attempts. Each time I derived the two 32-bit fields from the 64-bit
// literal by reasoning about halves and endianness, got a different answer, and a stale
// test binary confused the picture further. The constructor now memcpy's the literal word
// directly into the (asserted 8-byte) struct, which is byte-exact by construction and
// cannot be got wrong by reasoning. runarg_probe.cpp verifies the stored word.
#include "sead/framework_args.hpp"

#include <cstddef>
#include <cstring>

namespace sead {

// The observed 16-byte footprint matches the reference's {u64, Arena*}.
static_assert(sizeof(Framework::InitializeArg) == 0x10,
              "InitializeArg is 16 bytes in the binary (stores at +0x00 and +0x08)");
static_assert(offsetof(Framework::InitializeArg, heap_size) == 0x00,
              "heap_size sits at +0x00");
static_assert(offsetof(Framework::InitializeArg, arena) == 0x08,
              "arena sits at +0x08");
// The constructor's stores must land at the offsets the decompile proves.
static_assert(offsetof(Framework, mResetEventHead) == 0x20,
              "mResetEvent's self-linked node is written at +0x20");
static_assert(offsetof(Framework, mResetEventTail) == 0x28, "and its mate at +0x28");
static_assert(offsetof(Framework, mResetEventCount) == 0x30, "the count field is at +0x30");
static_assert(offsetof(Framework, mResetParameter) == 0x38, "mResetParameter is at +0x38");
static_assert(offsetof(Framework, mTaskMgr) == 0x40, "mTaskMgr is at +0x40");
static_assert(offsetof(Framework, mMethodTreeMgr) == 0x48, "mMethodTreeMgr is at +0x48");
static_assert(offsetof(Framework, mResetEventVtable) == 0x18, "the ResetEvent vtable is at +0x18");
static_assert(offsetof(Framework, mField10) == 0x10, "the +0x10 store lands at +0x10");

static_assert(sizeof(Framework::RunArg) == 0x08,
              "RunArg is 8 bytes in the binary (one 64-bit store)");

// 0x7100e696a4, 60 bytes. Each store is the decompiled body's store, at its offset.
Framework::Framework() {
    mResetEventHead = reinterpret_cast<void *>(reinterpret_cast<unsigned char *>(this) + kResetEventOffset);
    mResetEventTail = reinterpret_cast<void *>(reinterpret_cast<unsigned char *>(this) + kResetEventOffset);
    mResetEventCount = 0;
    mResetParameter = nullptr;
    mTaskMgr = nullptr;
    mMethodTreeMgr = nullptr;
    mMethodTreeMgrHeap = nullptr;
    mField10 = nullptr;
    mResetEventVtable = nullptr; // the original installs a vtable; see the header note
    mVtable = nullptr;           // likewise
}

Framework::InitializeArg::InitializeArg()
    : heap_size(0x3000000), // 48 MB -- the literal the constructor stores
      arena(nullptr) {}

Framework::RunArg::RunArg() {
    // The binary stores one 64-bit word, 0xffffffff00000000. Writing those bytes verbatim
    // is exact by construction: deriving the halves invited an ordering error, and this
    // cannot have one. The member values that result are whatever those bytes mean.
    constexpr std::uint64_t kWord = 0xffffffff00000000ull;
    static_assert(sizeof(Framework::RunArg) == sizeof(kWord),
                  "RunArg must be exactly one 64-bit word for a verbatim store");
    std::memcpy(this, &kWord, sizeof(kWord));
}

} // namespace sead
