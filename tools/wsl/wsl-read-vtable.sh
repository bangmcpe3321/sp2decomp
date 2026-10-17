#!/usr/bin/env bash
# Name the slot. The loop does, TWICE per iteration:
#     rdx = node->field0 ; rsi = *(rdx + 0x28) ; x0 = node ; call rsi
# Round 1 INFERRED that slot is GetNext(). Prove or falsify it: read *(field0+0x28) at the hang and
# resolve it through describe(). The fault handler's describe() is available via a tiny helper run.
set -uo pipefail
P="$HOME/sp2port"
cd "$P" || exit 1

./sp2 > /tmp/run16.txt 2>&1 &
PID=$!
echo "pid $PID (55s)"
sleep 55
kill -0 "$PID" 2>/dev/null || { echo "exited early"; tail -4 /tmp/run16.txt; exit 0; }

gdb -q -batch \
  -ex 'set pagination off' \
  -ex 'printf "=== the node and its field0 ===\n"' \
  -ex 'printf "node  = "' -ex 'p/x $rax' \
  -ex 'x/4gx 0x710304fb90' \
  -ex 'printf "\n=== field0 (node+0) and the slot at +0x28 ===\n"' \
  -ex 'p/x *(unsigned long long*)0x710304fb90' \
  -ex 'printf "slot+0x28 = "' -ex 'p/x *(unsigned long long*)(*(unsigned long long*)0x710304fb90 + 0x28)' \
  -ex 'printf "slot+0x00 = "' -ex 'p/x *(unsigned long long*)(*(unsigned long long*)0x710304fb90)' \
  -ex 'printf "slot+0x08 = "' -ex 'p/x *(unsigned long long*)(*(unsigned long long*)0x710304fb90 + 0x08)' \
  -ex 'printf "slot+0x10 = "' -ex 'p/x *(unsigned long long*)(*(unsigned long long*)0x710304fb90 + 0x10)' \
  -ex 'printf "slot+0x18 = "' -ex 'p/x *(unsigned long long*)(*(unsigned long long*)0x710304fb90 + 0x18)' \
  -ex 'printf "slot+0x20 = "' -ex 'p/x *(unsigned long long*)(*(unsigned long long*)0x710304fb90 + 0x20)' \
  -p "$PID" 2>&1 | grep -vE 'Reading symbols|Downloading|^\[New|^\[Thread|^warning' | head -40

kill -9 "$PID" 2>/dev/null
