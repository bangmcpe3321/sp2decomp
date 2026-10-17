#!/usr/bin/env bash
# Exhaustion ELIMINATED (512 MB, same hang). Now NAME the hang: attach a debugger to the running
# process and take a backtrace. The generated code is C++, so the frames are real functions.
set -uo pipefail
P="$HOME/sp2port"
cd "$P" || exit 1

echo "=== tooling available? ==="
for t in gdb eu-stack pstack; do
  command -v $t >/dev/null 2>&1 && echo "  $t: $(command -v $t)" || echo "  $t: MISSING"
done

echo
echo "=== start the game in the background ==="
./sp2 > /tmp/run12.txt 2>&1 &
PID=$!
echo "  pid $PID"
sleep 45

if ! kill -0 "$PID" 2>/dev/null; then
  echo "  process already exited -- see /tmp/run12.txt"
  tail -6 /tmp/run12.txt
  exit 0
fi

echo "  still alive after 45s -- taking a backtrace"
echo
if command -v gdb >/dev/null 2>&1; then
  gdb -batch -p "$PID" -ex 'bt 24' -ex 'info registers rip' 2>&1 | grep -vE '^\[|Reading|warning' | head -40
elif command -v eu-stack >/dev/null 2>&1; then
  eu-stack -p "$PID" 2>&1 | head -30
else
  echo "  no debugger; falling back to /proc"
  echo "  wchan: $(cat /proc/$PID/wchan 2>/dev/null)"
  echo "  threads: $(ls /proc/$PID/task 2>/dev/null | wc -l)"
  for t in $(ls /proc/$PID/task 2>/dev/null | head -6); do
    echo "    tid $t wchan=$(cat /proc/$PID/task/$t/wchan 2>/dev/null) state=$(awk '{print $3}' /proc/$PID/task/$t/stat 2>/dev/null)"
  done
fi

kill -9 "$PID" 2>/dev/null
echo
echo "=== last game log line ==="
grep 'main init\[' /tmp/run12.txt | tail -1 | cut -c1-140
