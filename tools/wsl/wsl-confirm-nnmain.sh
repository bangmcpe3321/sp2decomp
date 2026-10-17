#!/usr/bin/env bash
set -uo pipefail
echo "=== nnMain markers ==="
grep -nE 'entering nnMain|returned from nnMain' /tmp/g1.txt | head -4
echo
echo "=== main constructor lines logged: $(grep -cE 'main init\[' /tmp/g1.txt) ==="
echo
echo "=== full tail (non-UNRESOLVED) ==="
grep -vE '^  UNRESOLVED' /tmp/g1.txt | tail -10
echo
echo "=== resolve the key backtrace frames against main's symbol table ==="
T="$HOME/sp2port/gen/main/table.cpp"
grep -oE '\{"[^"]+", 0x[0-9a-f]+, ' "$T" 2>/dev/null | sed 's/{"//; s/", 0x/|/; s/, $//' > /tmp/s.txt
for a in e7cf7c e7678c e698ac e69fe4 e6724c 11f5b20 19a3e0; do
  line=$(awk -F'|' -v tgt="$a" 'BEGIN{t=strtonum("0x"tgt)} {v=strtonum("0x"$2); if(v<=t&&v>best){best=v;nm=$1}} END{if(best)printf "0x%x|%s",best,nm}' /tmp/s.txt)
  printf '  0x%-8s -> %s\n' "$a" "${line#*|}"
done
