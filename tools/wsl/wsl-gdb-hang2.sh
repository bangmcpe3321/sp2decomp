#!/usr/bin/env bash
set -uo pipefail
SUDO() { echo 'minecraft123' | sudo -S "$@" 2>&1 | grep -v '^\[sudo\]' ; }

echo "=== current ptrace_scope ==="
cat /proc/sys/kernel/yama/ptrace_scope 2>/dev/null

echo "=== set to 0 (allow attach) ==="
SUDO sysctl -w kernel.yama.ptrace_scope=0 | tail -2
cat /proc/sys/kernel/yama/ptrace_scope 2>/dev/null

echo
echo "=== start + attach again ==="
P="$HOME/sp2port"
cd "$P" || exit 1
./sp2 > /tmp/run14.txt 2>&1 &
PID=$!
echo "  pid $PID (60s)"
sleep 60

if ! kill -0 "$PID" 2>/dev/null; then echo "  exited early"; tail -4 /tmp/run14.txt; exit 0; fi

echo "  attaching..."
gdb -q -batch \
    -ex 'set pagination off' \
    -ex 'set print frame-arguments none' \
    -ex 'bt 30' \
    -p "$PID" 2>&1 | grep -vE '^\[|Reading symbols|^warning|Downloading|^$' | head -42

echo
echo "=== guest log position ==="
grep 'main init\[' /tmp/run14.txt | tail -1 | cut -c1-150
kill -9 "$PID" 2>/dev/null
