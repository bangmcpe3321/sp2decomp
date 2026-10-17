#!/usr/bin/env bash
# THE DIRECT ANSWER: catch the WRITE, not the call.
# 0x710304fb90 is the node; its m_pNext is at +8 = 0x710304fb98.
# A hardware watchpoint on that address fires on ANY write, with a host backtrace naming the writer.
set -uo pipefail
P="$HOME/sp2port"
cd "$P" || exit 1

cat > /tmp/wp.gdb <<'GDB'
set pagination off
set confirm off
set breakpoint pending on
watch *(unsigned long long*)0x710304fb98
commands
  silent
  printf "\n*** WRITE #%d to node->m_pNext (0x710304fb98) ***\n", ++$wp
  printf "new value = 0x%lx\n", *(unsigned long long*)0x710304fb98
  printf "head global = 0x%lx\n", *(unsigned long long*)0x7102fc7520
  bt 12
  continue
end
set $wp = 0
run
GDB

echo "=== running with a watchpoint on node->m_pNext (up to 900s) ==="
timeout 900 gdb -q -batch -x /tmp/wp.gdb ./sp2 > /tmp/wpout.txt 2>&1
echo "exit=$?"
echo
echo "=== watchpoint hits ==="
grep -c 'WRITE #' /tmp/wpout.txt 2>/dev/null || echo 0
echo
awk '/WRITE #/{p=1} p' /tmp/wpout.txt | head -60
