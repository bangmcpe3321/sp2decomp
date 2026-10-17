#!/usr/bin/env bash
set -uo pipefail
cd "$HOME/sp2port" || exit 1
gdb -q -batch -ex 'set pagination off' -ex 'disassemble main_00D2F0F4' ./sp2 2>/dev/null > /tmp/fn.txt
echo "=== total instructions: $(grep -c '^ ' /tmp/fn.txt) ==="
echo
echo "=== EVERY compare (cmp*/test) in the whole function ==="
grep -E 'cmp|test' /tmp/fn.txt | sed 's/^ *//'
echo
echo "=== just the +191..+200 region ==="
sed -n '/+191:/,/+205:/p' /tmp/fn.txt | sed 's/^ *//'
