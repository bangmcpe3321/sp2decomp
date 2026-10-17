#!/usr/bin/env bash
# 0x304fb90 has NO symbol at its start -- it is an INTERIOR address. That may itself be the bug: a list
# node pointer aimed into the middle of an object instead of at its start.
# Map the layout around it: every symbol in 0x304f800..0x304fd00 with its offset and size.
set -uo pipefail
T="$HOME/sp2port/gen/main/table.cpp"

echo "=== symbols and sizes near 0x304fb90 ==="
grep -oE '\{"[^"]+", 0x304f[0-9a-f]+, [0-9]+, [0-9]+, [0-9]+, [0-9]+\}' "$T" 2>/dev/null \
  | sed 's/{"//; s/", 0x/|/; s/, /|/g; s/}$//' \
  | awk -F'|' '{
      v=strtonum("0x"$2);
      if (v>=0x304f800 && v<=0x304fd00)
        printf "  0x%x  size=%-4s type=%s  %s\n", v, $4, $5, $1
    }' | sort

echo
echo "=== the gap that contains 0x304fb90 ==="
grep -oE '\{"[^"]+", 0x304f[0-9a-f]+, [0-9]+, [0-9]+, [0-9]+, [0-9]+\}' "$T" 2>/dev/null \
  | sed 's/{"//; s/", 0x/|/; s/, /|/g; s/}$//' \
  | awk -F'|' '{ v=strtonum("0x"$2); if (v<=0x304fb90) print v"|"$1"|"$4 }' \
  | sort -n | tail -2
