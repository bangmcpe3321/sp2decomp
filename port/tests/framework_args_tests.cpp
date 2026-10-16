// Contract tests for the sead::Framework argument constructors.
//
// Ports of 0x7100e69894 (InitializeArg) and 0x7100e698a0 (RunArg). Both bodies are literal
// stores, so the checks assert the exact observable values rather than inferred behaviour.
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
    std::printf("sead::Framework argument constructor tests\n");
    std::printf("(ports of 0x7100e69894 and 0x7100e698a0)\n\n");

    {
        std::printf("sead::Framework::InitializeArg::InitializeArg (0x7100e69894)\n");
        sead::Framework::InitializeArg arg;
        // The constructor stores 0x3000000 at +0x00 -- 48 MB.
        Check(arg.heap_size == 0x3000000,
              "heap_size defaults to 0x3000000 (48 MB), the constructor's literal");
        Check((arg.heap_size >> 20) == 48, "which is 48 MB");
        Check(arg.arena == nullptr, "arena defaults to null");
        std::printf("        heap_size = 0x%llx (%llu MB), arena = %p\n",
                    static_cast<unsigned long long>(arg.heap_size),
                    static_cast<unsigned long long>(arg.heap_size >> 20),
                    static_cast<void *>(arg.arena));
    }

    std::printf("\n");
    {
        std::printf("sead::Framework::RunArg::RunArg (0x7100e698a0)\n");
        sead::Framework::RunArg arg;
        // The binary writes one 64-bit word 0xffffffff00000000, so the two 32-bit fields
        // are its halves.
        Check(arg.prepare_stack_size == 0x00000000u,
              "prepare_stack_size is 0, as the binary reports");
        Check(arg.prepare_priority == -1,
              "prepare_priority is -1 (0xffffffff), as the binary reports");
        std::printf("        prepare_stack_size = 0x%x, prepare_priority = %d\n",
                    arg.prepare_stack_size, arg.prepare_priority);
    }

    std::printf("\n----------------------------------------\n");
    std::printf("%d checks, %d failures\n", g_checks, g_failures);
    return g_failures == 0 ? 0 : 1;
}
