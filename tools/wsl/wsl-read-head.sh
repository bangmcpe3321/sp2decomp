#!/usr/bin/env bash
# The ctor reaches AddVariable by a DIRECT host call (+285: call main_00D2F0F4), so call_preserving hooks
# never see it. Read the list head straight out of memory at the hang and compare it to the node.
#   head global = main + 0x2fc7520 = 0x7102fc7520
#   node        = 0x710304fb90
# If head == node, the list holds exactly that node -> adding it again self-links. Hypothesis PROVEN.
set -uo pipefail
P="$HOME/sp2port"
cd "$P" || exit 1

./sp2 > /tmp/run17.txt 2>&1 &
PID=$!
echo "pid $PID (55s)"
sleep 55
kill -0 "$PID" 2>/dev/null || { echo "exited early"; tail -4 /tmp/run17.txt; exit 0; }

gdb -q -batch \
  -ex 'set pagination off' \
  -ex 'printf "=== the list head global (main+0x2fc7520) ===\n"' \
  -ex 'p/x *(unsigned long long*)0x7102fc7520' \
  -ex 'printf "\n=== the node under the walk ===\n"' \
  -ex 'p/x *(unsigned long long*)0x710304fb90' \
  -ex 'p/x *(unsigned long long*)0x710304fb98' \
  -ex 'printf "\n=== a couple more PGV statics for context ===\n"' \
  -ex 'p/x *(unsigned long long*)0x7102fc7908' \
  -ex 'p/x *(unsigned long long*)0x7102fc7910' \
  -ex 'printf "\n=== count installed (main+0x2fc75b0) ===\n"' \
  -ex 'p/d *(unsigned int*)0x7102fc75b0' \
  -p "$PID" 2>&1 | grep -vE 'Reading symbols|Downloading|^\[New|^\[Thread' | head -30

kill -9 "$PID" 2>/dev/null
