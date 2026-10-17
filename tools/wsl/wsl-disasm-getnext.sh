#!/usr/bin/env bash
# GetNext() is at 0xd181d8. Which offset does it read? If it reads +8, then node+8 IS m_pNext and the
# measured self-reference is exactly the walk's advance -- mechanism fully proven, no inference left.
set -uo pipefail
P="$HOME/sp2port"
cd "$P" || exit 1
gdb -q -batch \
  -ex 'set pagination off' \
  -ex 'disassemble /r main_00D181D8' \
  ./sp2 2>&1 | grep -vE 'Reading symbols|Downloading|^\[New|^\[Thread' | head -22
