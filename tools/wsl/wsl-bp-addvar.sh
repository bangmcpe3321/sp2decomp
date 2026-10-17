#!/usr/bin/env bash
# Observe EVERY AddVariable call. The recompiler emits direct calls, so gdb breakpoints are the only way.
# The first call whose argument is 0x710304fb90, plus the list state at that moment, IS the corruption.
set -uo pipefail
P="$HOME/sp2port"
cd "$P" || exit 1

cat > /tmp/bp.gdb <<'GDB'
set pagination off
set confirm off
break main_00D2F0F4
commands
  silent
  printf "AddVariable  x0(this)=0x%-12lx x1(node)=0x%-12lx  head=0x%lx\n", *(unsigned long long*)($rdi), *(unsigned long long*)($rdi+8), *(unsigned long long*)(0x7102fc7520)
  continue
end
run
GDB

echo "=== running under gdb (this takes a while) ==="
timeout 300 gdb -q -batch -x /tmp/bp.gdb ./sp2 2>&1 \
  | grep -vE 'Reading symbols|Downloading|^\[New|^\[Thread|^warning|^\[Inferior' | head -60
