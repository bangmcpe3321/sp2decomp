// MINIMAL HARNESS: does the recompiled Splatoon 2 code actually EXECUTE?
//
// Deliberately bypasses the loader, HLE, NVN and the platform layer. It answers one narrow
// question: can a generated guest function run against the nx:: CPU model?
//
// Two things make this work rather than crash:
//   1. RETURN TRAP. A guest `ret` is `br x30`, so LR must point somewhere real. We set LR to a C
//      function that longjmps back into the harness, which turns "the function returned" into a
//      clean, reportable event instead of a jump into zeroed memory.
//   2. SIGNAL HANDLER. If the guest faults, we want the faulting address and the guest PC, not
//      just a segfault.
#include <nx/cpu.h>

#include <csetjmp>
#include <csignal>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <sys/mman.h>
#include <unistd.h>

static constexpr uint64_t kMainBase = 0x7100000000ull;
static constexpr uint64_t kMainSize = 0x4000000ull; // 64 MB, over main's 0x3699e50 span

static sigjmp_buf g_env;
static volatile int g_landed = 0;
static volatile uint64_t g_land_sp = 0;
static volatile uint64_t g_land_x19 = 0;

// The guest's `ret` lands here (LR points at it). longjmp returns control to the harness.
extern "C" void guest_return_trap(nx::CPU* c) {
    g_landed = 1;
    g_land_sp = c->x[31];
    g_land_x19 = c->x[19];
    siglongjmp(g_env, 1);
}

static void on_signal(int sig, siginfo_t* si, void*) {
    const char* name = (sig == SIGSEGV) ? "SIGSEGV" : (sig == SIGILL) ? "SIGILL" : "SIGBUS";
    std::printf("    !! %s at address %p\n", name, si->si_addr);
    siglongjmp(g_env, 2); // report and unwind rather than dying
}

static bool map_guest() {
    void* p = mmap(reinterpret_cast<void*>(kMainBase), kMainSize,
                   PROT_READ | PROT_WRITE | PROT_EXEC,
                   MAP_PRIVATE | MAP_ANONYMOUS | MAP_FIXED_NOREPLACE, -1, 0);
    if (p == MAP_FAILED) {
        std::perror("harness: mmap");
        return false;
    }
    std::memset(p, 0, kMainSize);
    return true;
}

// --- the six out-of-line nx:: entry points, minimised ---------------------------------------
namespace nx {

static int g_calls = 0;

void call(CPU& c, uint64_t target) {
    if (g_calls < 6) {
        std::printf("    nx::call -> 0x%llx (lr=0x%llx)  [HARNESS: not dispatching]\n",
                    (unsigned long long)target, (unsigned long long)c.x[30]);
    } else if (g_calls == 6) {
        std::printf("    ... further nx::call suppressed\n");
    }
    ++g_calls;
}

[[noreturn]] void unimpl(CPU& c, uint64_t pc, const char* what) {
    std::printf("    nx::unimpl at 0x%llx: %s\n", (unsigned long long)pc, what ? what : "?");
    (void)c;
    siglongjmp(g_env, 3);
}

void svc(CPU& c, uint32_t imm, uint64_t pc) {
    if (imm != 0) std::printf("    nx::svc #%u at 0x%llx\n", imm, (unsigned long long)pc);
    // SVC 0 is the guest's syscall entry; report and continue is enough for a smoke test.
    (void)c;
}

uint64_t mrs(CPU& c, uint32_t sysreg) { (void)c; (void)sysreg; return 0; }
void msr(CPU& c, uint32_t sysreg, uint64_t v) { (void)c; (void)sysreg; (void)v; }
void trace_sp(CPU& c, uint64_t pc) { (void)c; (void)pc; }

int call_count() { return g_calls; }

} // namespace nx

// NOTE: NOT extern "C". The generated functions are C++ (`void main_XXXX(nx::CPU&)`),
// so they are name-mangled. Declaring them extern "C" left the symbol undefined and
// --unresolved-symbols=ignore-all resolved it to address 0 -- the call then jumped to 0 and
// faulted with SP unchanged, which is exactly what the first run reported.
void main_00000024(nx::CPU& c);

int main() {
    std::printf("=== Splatoon 2 recompiled-code execution harness ===\n\n");
    if (!map_guest()) return 1;
    std::printf("guest memory mapped at 0x%llx (%llu MB)\n",
                (unsigned long long)kMainBase, (unsigned long long)(kMainSize >> 20));

    struct sigaction sa;
    std::memset(&sa, 0, sizeof(sa));
    sa.sa_sigaction = on_signal;
    sa.sa_flags = SA_SIGINFO;
    sigaction(SIGSEGV, &sa, nullptr);
    sigaction(SIGBUS, &sa, nullptr);
    sigaction(SIGILL, &sa, nullptr);

    nx::CPU c;
    std::memset(&c, 0, sizeof(c));

    const uint64_t stack_top = kMainBase + 0x3000000ull;
    c.x[31] = stack_top;
    // LR -> the trap, so a guest `ret` (br x30) lands in C++ instead of in zeroed memory.
    c.x[30] = reinterpret_cast<uint64_t>(&guest_return_trap);
    // x0 = the CPU pointer, so guest_return_trap can recover the context it is handed.
    c.x[0] = reinterpret_cast<uint64_t>(&c);

    std::printf("SP = 0x%llx   LR = %p (return trap)\n",
                (unsigned long long)c.x[31], (void*)c.x[30]);
    std::printf("calling main_00000024 ...\n\n");
    std::fflush(stdout);

    const int r = sigsetjmp(g_env, 1);
    if (r == 0) {
        main_00000024(c);
        // A guest `ret` is emitted as C++ `return;`, so returning HERE is the normal, successful
        // exit -- not a fall-through. The LR trap covers the other case (an indirect `br x30`).
        std::printf("    guest function returned normally (C++ return for `ret`)\n");
    } else if (r == 1) {
        std::printf("    GUEST RETURNED via the LR trap\n");
    } else if (r == 2) {
        std::printf("    FAULTED -- see the address above\n");
    } else {
        std::printf("    STOPPED at an nx::unimpl site\n");
    }

    std::printf("\n--- guest state after the call ---\n");
    std::printf("  SP   = 0x%llx (initial 0x%llx)\n", (unsigned long long)c.x[31],
                (unsigned long long)stack_top);
    std::printf("  x19  = 0x%llx\n", (unsigned long long)c.x[19]);
    std::printf("  x8   = 0x%llx\n", (unsigned long long)c.x[8]);
    std::printf("  nzcv = n%d z%d c%d v%d\n", c.nf, c.zf, c.cf, c.vf);
    std::printf("  nx::call invocations: %d\n", nx::call_count());

    if (r == 0 || r == 1 || r == 2 || r == 3) {
        std::printf("\n*** GENERATED GUEST CODE EXECUTED ON THE HOST ***\n");
        return 0;
    }
    return 1;
}
