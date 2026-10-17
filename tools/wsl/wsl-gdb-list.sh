#!/usr/bin/env bash
# Read the LIST STATE at the spin. AddVariable walks a linked list; if the head is zero/self-referential
# or a `next` points backwards, that is the bug. Disassemble the loop so the register roles are visible.
set -uo pipefail
P="$HOME/sp2port"
cd "$P" || exit 1

./sp2 > /tmp/run15.txt 2>&1 &
PID=$!
echo "pid $PID (60s)"
sleep 60
kill -0 "$PID" 2>/dev/null || { echo "exited early"; tail -4 /tmp/run15.txt; exit 0; }

gdb -q -batch \
  -ex 'set pagination off' \
  -ex 'set print frame-arguments none' \
  -ex 'bt 3' \
  -ex 'printf "\n=== registers ===\n"' \
  -ex 'info registers rax rbx rcx rdx rsi rdi rbp rsp r8 r9 r10 r11 r12 r13 r14 r15 rip' \
  -ex 'printf "\n=== the loop (20 insns around pc) ===\n"' \
  -ex 'x/20i $pc-40' \
  -ex 'printf "\n=== memory at pointer-looking registers ===\n"' \
  -ex 'printf "rdi: "' -ex 'x/4gx $rdi' \
  -ex 'printf "rax: "' -ex 'x/4gx $rax' \
  -ex 'printf "rbx: "' -ex 'x/4gx $rbx' \
  -ex 'printf "r12: "' -ex 'x/4gx $r12' \
  -ex 'printf "r13: "' -ex 'x/4gx $r13' \
  -p "$PID" 2>&1 | grep -vE 'Reading symbols|Downloading|^\[New|^\[Thread|^warning' | head -70

kill -9 "$PID" 2>/dev/null
