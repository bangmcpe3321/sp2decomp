#!/usr/bin/env bash
# Add a SIGSEGV/SIGBUS/SIGILL handler to platform_linux.cpp so the anonymous crash becomes a
# LOCATED one: faulting address, guest lr/sp resolved through nx::describe(), the guest registers,
# and a host backtrace. This is the same technique the round-1 harness used successfully.
set -uo pipefail
P="$HOME/sp2port"
F="$P/runtime/src/platform_linux.cpp"

python3 - "$F" <<'PY'
import sys
p = sys.argv[1]
s = open(p).read()

handler = r'''
// ---- fault reporting ----------------------------------------------------------------------
// Without this the game dies with an anonymous SIGSEGV and no address. With it, the faulting
// address and the guest's lr/sp are resolved through nx::describe() ("sdk+0x1234 (sym+0x10)"),
// the registers are dumped, and a host backtrace is printed.
#include <execinfo.h>
#include <signal.h>

namespace {
const char* sig_name(int sig) {
    switch (sig) {
        case SIGSEGV: return "SIGSEGV";
        case SIGBUS:  return "SIGBUS";
        case SIGILL:  return "SIGILL";
        case SIGFPE:  return "SIGFPE";
        default:      return "signal";
    }
}

void fault_handler(int sig, siginfo_t* si, void* /*uc*/) {
    // Async-signal-safe enough for a fatal report: log(), describe() and backtrace() are not
    // strictly safe, but this runs once, on a process that is already dying.
    char buf[2048];
    std::snprintf(buf, sizeof buf,
                  "\n=== HOST %s ===\n  fault address : %p  %s\n",
                  sig_name(sig), si ? si->si_addr : nullptr,
                  si ? nx::describe(reinterpret_cast<uint64_t>(si->si_addr)).c_str() : "?");
    nx::plat::log_line(buf);

    // The guest's link register and stack pointer usually locate the failing call.
    nx::CPU& c = nx::current_cpu();
    std::snprintf(buf, sizeof buf,
                  "  guest lr      : 0x%llx  %s\n  guest sp      : 0x%llx  %s\n",
                  (unsigned long long)c.x[30], nx::describe(c.x[30]).c_str(),
                  (unsigned long long)c.x[31], nx::describe(c.x[31]).c_str());
    nx::plat::log_line(buf);

    // Registers, four per line, as the runtime's own dump_guest does.
    for (int k = 0; k < 31; k += 4) {
        std::snprintf(buf, sizeof buf, "  x%-2d %016llx %016llx %016llx %016llx", k,
                      (unsigned long long)c.x[k], (unsigned long long)c.x[k + 1],
                      (unsigned long long)c.x[k + 2],
                      (unsigned long long)(k + 3 < 31 ? c.x[k + 3] : c.x[31]));
        nx::plat::log_line(buf);
    }

    // Host backtrace: the fault happened in recompiled code, so these frames are generated C++.
    void* frames[32];
    int n = ::backtrace(frames, 32);
    nx::plat::log_line("  host backtrace:");
    for (int k = 0; k < n; ++k) {
        std::snprintf(buf, sizeof buf, "    #%-2d %p", k, frames[k]);
        nx::plat::log_line(buf);
    }
    nx::plat::log_line("=== end of fault report ===");

    _exit(70); // do not resume a guest that already faulted
}
}  // namespace

namespace nx::plat {
void install_fault_handler() {
    struct sigaction sa;
    std::memset(&sa, 0, sizeof sa);
    sa.sa_sigaction = &fault_handler;
    sa.sa_flags = SA_SIGINFO | SA_ONSTACK;
    sigaction(SIGSEGV, &sa, nullptr);
    sigaction(SIGBUS, &sa, nullptr);
    sigaction(SIGILL, &sa, nullptr);
    sigaction(SIGFPE, &sa, nullptr);
}
}  // namespace nx::plat
'''

# Insert before the entry point section.
anchor = '// ---- the entry point '
if anchor not in s:
    print("ANCHOR NOT FOUND", file=sys.stderr)
    sys.exit(1)
s = s.replace(anchor, handler + '\n' + anchor, 1)

# Call it at the top of main().
s = s.replace('int main() {\n    try {', 'int main() {\n    nx::plat::install_fault_handler();\n    try {', 1)

open(p, 'w').write(s)
print("added fault handler")
PY

echo
echo "=== rebuild + run ==="
cd "$P" || exit 1
g++ -std=c++20 -c -O1 -w -I runtime/include -I runtime/src runtime/src/platform_linux.cpp \
    -o obj-all/_runtime/platform_linux.o 2>pf.txt || { head -14 pf.txt; exit 1; }
GEN=$(find obj-all -name '*.o' | grep -v _runtime | tr '\n' ' ')
RTO=$(ls obj-all/_runtime/*.o | tr '\n' ' ')
g++ -o sp2 $GEN $RTO -lm -lc -lgcc -lpthread -ldl 2>pl.txt || { head -8 pl.txt; exit 1; }
echo "  linked: $(du -h sp2 | cut -f1)"
echo
timeout 90 ./sp2 2>&1 | grep -vE '^  UNRESOLVED' | head -46
