#!/usr/bin/env bash
set -uo pipefail
T="$HOME/sp2port/gen/main/table.cpp"
grep -oE '\{"[^"]+", 0x[0-9a-f]+, ' "$T" 2>/dev/null | sed 's/{"//; s/", 0x/|/; s/, $//' > /tmp/s2.txt
echo "=== resolve the new fault address 0xe76550 ==="
awk -F'|' 'BEGIN{t=strtonum("0xe76550")} {v=strtonum("0x"$2); if(v<=t&&v>best){best=v;nm=$1}} END{printf "  0x%x  %s  (+0x%x)\n", best, nm, t-best}' /tmp/s2.txt
echo
echo "=== neighbours ==="
awk -F'|' '{v=strtonum("0x"$2); if(v>=0xe76400&&v<=0xe76900) printf "  0x%x  %s\n", v, $1}' /tmp/s2.txt | sort -n | head -10
echo
echo "=== the caller of Arena::Arena during _init (0xe7d068) ==="
awk -F'|' 'BEGIN{t=strtonum("0xe7d068")} {v=strtonum("0x"$2); if(v<=t&&v>best){best=v;nm=$1}} END{printf "  0x%x  %s  (+0x%x)\n", best, nm, t-best}' /tmp/s2.txt
