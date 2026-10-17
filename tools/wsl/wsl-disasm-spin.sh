#!/usr/bin/env bash
# Read the EXIT CONDITION: disassemble main_00D2F0F4 from its start. The loop is at +151; the test that
# should end it is somewhere before that. Static disassembly -- no need to run the game.
set -uo pipefail
P="$HOME/sp2port"
cd "$P" || exit 1

gdb -q -batch \
  -ex 'set pagination off' \
  -ex 'disassemble /r main_00D2F0F4' \
  ./sp2 2>&1 | grep -vE 'Reading symbols|Downloading|^\[New|^\[Thread' | head -85
