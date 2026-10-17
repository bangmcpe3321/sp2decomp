#!/usr/bin/env bash
# Trace the PseudoGlobalVariable chain from head=0x7103650160 by following m_pNext (node+8).
# Goals: (a) is 0x710304fb90 the tail? (b) does any node appear TWICE (proving duplicate registration)?
# (c) how long is the chain? (d) is it otherwise well-formed?
set -uo pipefail
P="$HOME/sp2port"
cd "$P" || exit 1

./sp2 > /tmp/run18.txt 2>&1 &
PID=$!
echo "pid $PID (55s)"
sleep 55
kill -0 "$PID" 2>/dev/null || { echo "exited early"; tail -4 /tmp/run18.txt; exit 0; }

cat > /tmp/walk.gdb <<'GDB'
set pagination off
set $n = *(unsigned long long*)0x7102fc7520
printf "head = 0x%lx\n", $n
set $i = 0
while $n != 0 && $i < 40
  printf "  [%2d] node=0x%-12lx vptr=0x%-12lx next=0x%lx\n", $i, $n, *(unsigned long long*)$n, *(unsigned long long*)($n+8)
  set $n = *(unsigned long long*)($n+8)
  set $i = $i + 1
end
printf "walk stopped after %d nodes, next=0x%lx\n", $i, $n
GDB

gdb -q -batch -x /tmp/walk.gdb -p "$PID" 2>&1 \
  | grep -vE 'Reading symbols|Downloading|^\[New|^\[Thread|^warning' | head -50

kill -9 "$PID" 2>/dev/null
