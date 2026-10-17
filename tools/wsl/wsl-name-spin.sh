#!/usr/bin/env bash
# The spin is in main+0xD2F0F4, called from the PseudoGlobalVariable<StreamSettings> ctor at +0x3cc.
# Name that function: find the symbol whose offset is the largest <= 0xd2f0f4.
set -uo pipefail
T="$HOME/sp2port/gen/main/table.cpp"

echo "=== symbols near 0xd2f0f4 (the spinning function) ==="
grep -oE '\{"_Z[^"]+", 0x[0-9a-f]+, ' "$T" 2>/dev/null \
  | sed 's/{"//; s/", 0x/ /; s/, $//' \
  | awk '{v=strtonum("0x"$2); if (v>0xd28000 && v<=0xd2f0f4) print v, $1}' \
  | sort -n | tail -8

echo
echo "=== dump the region 0xd2f000..0xd2f100 ==="
grep -oE '\{"_Z[^"]+", 0x[0-9a-f]+, ' "$T" 2>/dev/null \
  | sed 's/{"//; s/", 0x/ /; s/, $//' \
  | awk '{v=strtonum("0x"$2); if (v>=0xd2e000 && v<=0xd30000) print v, $1}' \
  | sort -n | head -12
