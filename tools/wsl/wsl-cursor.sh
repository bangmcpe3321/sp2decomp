#!/usr/bin/env bash
# DECISIVE READ: what is the walk cursor at the spin?
#   c.x[20]  is at 0xa0(%rdi)  (the CPU struct starts with x[0] at offset 0)
#   The loop does:  +197 mov 0xa0(%rbx),%rax ... +222 (the spin) ... so rax == c.x[20].
# If c.x[20] == 0x710304fb90, round 2's pointer path is CONFIRMED and round 5's "head" claim is wrong.
set -uo pipefail
P="$HOME/sp2port"
cd "$P" || exit 1

./sp2 > /tmp/r19.txt 2>&1 &
PID=$!
echo "pid $PID (52s)"
sleep 52
kill -0 "$PID" 2>/dev/null || { echo "exited early"; tail -3 /tmp/r19.txt; exit 0; }

cat > /tmp/r.gdb <<'GDB'
set pagination off
printf "pc                = 0x%lx\n", $pc
printf "c.x[20] (cursor)  = 0x%lx\n", *(unsigned long long*)($rdi + 0xa0)
printf "c.x[0]            = 0x%lx\n", *(unsigned long long*)($rdi)
printf "c.x[1]            = 0x%lx\n", *(unsigned long long*)($rdi + 0x8)
printf "c.x[30] (lr)      = 0x%lx\n", *(unsigned long long*)($rdi + 0xf0)
set $cur = *(unsigned long long*)($rdi + 0xa0)
if $cur != 0
  printf "cursor +0 (vptr)  = 0x%lx\n", *(unsigned long long*)$cur
  printf "cursor +8 (next)  = 0x%lx\n", *(unsigned long long*)($cur + 8)
end
GDB

gdb -q -batch -x /tmp/r.gdb -p "$PID" 2>&1 \
  | grep -vE 'Reading symbols|Downloading|^\[New|^\[Thread|^warning' | head -20

kill -9 "$PID" 2>/dev/null
