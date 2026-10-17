#!/usr/bin/env bash
# Disassemble PseudoGlobalVariable<StreamSettings>'s constructor (main_00D5A238) -- the last remaining
# suspect for the self-referential list node. Does it write the next/field0 word, and what?
set -uo pipefail
P="$HOME/sp2port"
cd "$P" || exit 1

echo "=== PseudoGlobalVariable<StreamSettings> ctor: main_00D5A238 ==="
gdb -q -batch \
  -ex 'set pagination off' \
  -ex 'disassemble /r main_00D5A238' \
  ./sp2 2>&1 | grep -vE 'Reading symbols|Downloading|^\[New|^\[Thread' | head -60
