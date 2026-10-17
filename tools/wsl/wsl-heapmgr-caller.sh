#!/usr/bin/env bash
# Who calls sead::HeapMgr::initialize, and where does the ZERO come from?
# At entry x0 = size = 0. The caller just computed it. Print the backtrace, then disassemble the
# instructions leading up to the call so the register/load that produced the zero is visible.
set -uo pipefail
P="$HOME/sp2port"
cd "$P" || exit 1

cat > /tmp/hmc.gdb <<'GDB'
set pagination off
set confirm off
break main_00E7C4E0
commands
  silent
  printf "\n=== HeapMgr::initialize entered, x0(size) = 0x%lx ===\n", *(unsigned long long*)($rdi)
  printf "guest x0 slot = 0x%lx\n", *(unsigned long long*)($rdi + 0x00)
  bt 10
  set $ret = *(unsigned long long*)$rsp
  printf "\nreturn address = 0x%lx\n", $ret
  printf "=== instructions leading to the call ===\n"
  x/12i $ret - 44
  continue
end
run
GDB

echo "=== run under gdb ==="
timeout 500 gdb -q -batch -x /tmp/hmc.gdb ./sp2 > /tmp/hmc.txt 2>&1
echo "exit=$?"
echo
awk '/HeapMgr::initialize entered/{p=1} p' /tmp/hmc.txt | head -40
