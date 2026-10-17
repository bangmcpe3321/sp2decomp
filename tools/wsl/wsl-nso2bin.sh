#!/usr/bin/env bash
# The loader wants a raw module image (private/analysis/<module>.bin), produced by tools/nso2bin.py
# from the NSO. Generate them for every Splatoon 2 module.
set -uo pipefail
P="$HOME/sp2port"
W="$HOME/refs/wonder"
E=/mnt/c/Users/Hexa/Documents/nintendo/hactool-1.4.0-win/exefs

echo "=== nso2bin.py usage ==="
python3 "$W/tools/nso2bin.py" --help 2>&1 | head -12

mkdir -p "$P/private/analysis"

echo
echo "=== converting each module ==="
for m in main sdk subsdk0 subsdk1 subsdk2 subsdk3; do
  [ -f "$E/$m" ] || continue
  out="$P/private/analysis/$m.bin"
  [ -f "$out" ] && { echo "  $m: already present"; continue; }
  printf '  %-9s ' "$m"
  if python3 "$W/tools/nso2bin.py" "$E/$m" "$out" 2>/tmp/n2b.txt; then
    echo "OK ($(du -h "$out" | cut -f1))"
  else
    echo "FAILED"
    head -4 /tmp/n2b.txt | sed 's/^/      /'
  fi
done

echo
echo "=== result ==="
ls -la "$P/private/analysis" 2>/dev/null | tail -8
