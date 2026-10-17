#!/usr/bin/env bash
# Who calls sead::ExpHeap::tryCreate? Catch the SIGSEGV under gdb (it stops before our handler) and
# take a host backtrace. That names the caller and tells us whether it is a constructor or _init itself.
set -uo pipefail
P="$HOME/sp2port"
cd "$P" || exit 1

cat > /tmp/faultbt.gdb <<'GDB'
set pagination off
set confirm off
handle SIGSEGV stop print nopass
run
printf "\n=== faulted ===\n"
printf "faulting insn pc = 0x%lx\n", $pc
bt 16
printf "\n=== guest registers (rdi = CPU*) ===\n"
printf "x0  = 0x%lx\n", *(unsigned long long*)($rdi + 0x00)
printf "x19 = 0x%lx\n", *(unsigned long long*)($rdi + 0x98)
printf "x20 = 0x%lx\n", *(unsigned long long*)($rdi + 0xa0)
GDB

echo "=== run under gdb, stop at the fault ==="
timeout 600 gdb -q -batch -x /tmp/faultbt.gdb ./sp2 > /tmp/fb.txt 2>&1
echo "exit=$?"
echo
awk '/=== faulted ===/{p=1} p' /tmp/fb.txt | head -30
