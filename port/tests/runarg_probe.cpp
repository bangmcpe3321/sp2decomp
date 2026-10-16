// Settle the RunArg field order definitively: print the raw 64-bit word the constructor
// produces, so the halves can be read off rather than argued about.
#include "sead/framework_args.hpp"

#include <cstdio>
#include <cstring>

int main() {
    sead::Framework::RunArg arg;
    unsigned long long raw = 0;
    std::memcpy(&raw, &arg, sizeof(raw));
    std::printf("raw 64-bit word : 0x%016llx\n", raw);
    std::printf("  as stored, +0x00 (first 4 bytes) = 0x%08x\n", arg.prepare_stack_size);
    std::printf("  as stored, +0x04 (next 4 bytes)  = 0x%08x\n",
                static_cast<unsigned>(arg.prepare_priority));
    std::printf("\nthe binary's store is 0xffffffff00000000\n");
    std::printf("so the field at +0x00 should equal 0x00000000 and +0x04 should equal 0xffffffff\n");
    std::printf("matches: %s\n", raw == 0xffffffff00000000ull ? "YES" : "NO");
    return raw == 0xffffffff00000000ull ? 0 : 1;
}
