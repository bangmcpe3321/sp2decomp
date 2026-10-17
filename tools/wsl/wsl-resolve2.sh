#!/usr/bin/env bash
# Resolve the vtable slots to symbols. If 0xd181d8 is GetNext, round 1's inference is PROVEN.
set -uo pipefail
T="$HOME/sp2port/gen/main/table.cpp"

grep -oE '\{"[^"]+", 0x[0-9a-f]+, ' "$T" 2>/dev/null \
  | sed 's/{"//; s/", 0x/|/; s/, $//' > /tmp/syms.txt

echo "=== symbol table: $(wc -l < /tmp/syms.txt) entries ==="
echo
echo "=== resolve each vtable entry ==="
for a in d0cc20 d17f60 d17fcc d18108 d18198 d181d8; do
  line=$(awk -F'|' -v tgt="$a" '
    BEGIN { t=strtonum("0x" tgt) }
    { v=strtonum("0x" $2); if (v<=t && v>best) { best=v; nm=$1 } }
    END { if (best) printf "0x%x|%s", best, nm }' /tmp/syms.txt)
  v=${line%%|*}; name=${line#*|}
  printf '  0x%-9s -> %-70s (starts %s)\n' "$a" "$name" "$v"
done

echo
echo "=== is GetNext itself at one of these? ==="
grep -n 'SendMultiParameterE7GetNextEv\|WaterMark.*GetNext\|PseudoGlobalVariableRoot.*GetNext' /tmp/syms.txt | head -5
