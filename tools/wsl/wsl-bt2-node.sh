#!/usr/bin/env bash
# WHO re-registers 0x710304fb90? Break on AddVariable with argument == that node, let the FIRST hit pass,
# and take a HOST backtrace on the SECOND. The generated code is C++, so the frames name the caller.
set -uo pipefail
P="$HOME/sp2port"
cd "$P" || exit 1

cat > /tmp/bt2.gdb <<'GDB'
set pagination off
set confirm off
set breakpoint pending on
set $hits = 0
break main_00D2F0F4 if *(unsigned long long*)($rdi+8) == 0x710304fb90
commands
  silent
  set $hits = $hits + 1
  printf "\n=== hit %d for node 0x710304fb90 ===\n", $hits
  if $hits < 2
    continue
  end
  printf "*** SECOND REGISTRATION ***\n"
  printf "this(x0) = 0x%lx  node(x1) = 0x%lx\n", *(unsigned long long*)($rdi), *(unsigned long long*)($rdi+8)
  printf "host backtrace:\n"
  bt 16
  kill
  quit
end
run
GDB

echo "=== running (up to 600s) ==="
timeout 600 gdb -q -batch -x /tmp/bt2.gdb ./sp2 > /tmp/bt2out.txt 2>&1
echo "exit=$?"
echo
echo "=== the second registration ==="
awk '/SECOND REGISTRATION/,/^$/' /tmp/bt2out.txt | head -30
echo
echo "=== how many hits of that exact node? ==="
grep -c 'hit .* for node 0x710304fb90' /tmp/bt2out.txt
