#!/usr/bin/env bash
# SetNext is recorded at 0xd181e0, but GetNext at 0xd181d8 disassembles to 15 bytes (ends 0xd181e7).
# THOSE OVERLAP. Either the symbol table is inconsistent, or GetNext is shorter than its disassembly
# suggests (i.e. my disassembly ran past its end into the next function). Disassemble the region and see.
set -uo pipefail
P="$HOME/sp2port"
cd "$P" || exit 1
echo "=== 0xd181e0 (claimed SetNext) ==="
gdb -q -batch -ex 'set pagination off' -ex 'disassemble /r main_00D181E0' ./sp2 2>&1 \
  | grep -vE 'Reading symbols|Downloading' | head -18
echo
echo "=== 0xd181d8 with an EXPLICIT 24-byte window (does GetNext end before 0xd181e0?) ==="
gdb -q -batch -ex 'set pagination off' -ex 'x/12i 0x7100d181d8' ./sp2 2>&1 \
  | grep -vE 'Reading symbols|Downloading' | head -18
