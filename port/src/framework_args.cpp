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
static_assert(sizeof(Framework::RunArg) == 0x08,
              "RunArg is 8 bytes in the binary (one 64-bit store)");

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
