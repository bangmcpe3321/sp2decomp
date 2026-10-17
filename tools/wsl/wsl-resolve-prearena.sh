#!/usr/bin/env bash
set -uo pipefail
T="$HOME/sp2port/gen/main/table.cpp"
grep -oE '\{"[^"]+", 0x[0-9a-f]+, ' "$T" 2>/dev/null \
  | sed 's/{"//; s/", 0x/|/; s/, $//' > /tmp/s3.txt
echo "=== symbols containing 98bd8 / e7c5 (near the pre-arena call) ==="
grep -E '\|e98bd8$|\|e7c500$|\|e7c51c$' /tmp/s3.txt
echo
echo "=== everything between 0xe98b00 and 0xe98c80 ==="
awk -F'|' '{v=strtonum("0x"$2); if (v>=0xe98b00 && v<=0xe98c80) printf "  0x%x  %s\n", v, $1}' /tmp/s3.txt | sort -n | head -12
