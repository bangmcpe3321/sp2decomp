#!/usr/bin/env bash
# THE DECISIVE MEASUREMENT. Round 11 left one question: is guest x19 equal to the walk cursor?
#   x[19] is at CPU struct offset 0x98 (x[0] is at offset 0).
#   if x19 == cursor 0x710304fb90 -> the guest would have exited via `cmp x0, x19; b.eq`, the recompiled
#     code did not -> RECOMPILATION DEFECT CONFIRMED.
#   if x19 differs               -> the guest would also have looped -> that explanation is refuted.
set -uo pipefail
P="$HOME/sp2port"
cd "$P" || exit 1

./sp2 > /tmp/r20.txt 2>&1 &
PID=$!
echo "pid $PID (52s)"
sleep 52
kill -0 "$PID" 2>/dev/null || { echo "exited early"; tail -3 /tmp/r20.txt; exit 0; }

cat > /tmp/x19.gdb <<'GDB'
set pagination off
printf "c.x[0]   = 0x%lx\n", *(unsigned long long*)($rdi + 0x00)
printf "c.x[19]  = 0x%lx   <-- the sentinel candidate\n", *(unsigned long long*)($rdi + 0x98)
printf "c.x[20]  = 0x%lx   <-- the walk cursor\n", *(unsigned long long*)($rdi + 0xa0)
printf "c.x[21]  = 0x%lx   <-- the other compared register\n", *(unsigned long long*)($rdi + 0xa8)
set $c = *(unsigned long long*)($rdi + 0xa0)
set $s = *(unsigned long long*)($rdi + 0x98)
if $c == $s
  printf "\n>>> CURSOR == x19  ==> the guest would have EXITED; the recompiled loop did NOT.\n"
  printf ">>> RECOMPILATION DEFECT CONFIRMED (a register exit test is missing).\n"
else
  printf "\n>>> CURSOR != x19  ==> the guest would ALSO have looped.\n"
  printf ">>> The missing-compare explanation is REFUTED for this hang.\n"
end
GDB

gdb -q -batch -x /tmp/x19.gdb -p "$PID" 2>&1 \
  | grep -vE 'Reading symbols|Downloading|^\[New|^\[Thread|^warning' | head -20

kill -9 "$PID" 2>/dev/null
