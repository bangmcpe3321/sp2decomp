#!/usr/bin/env bash
# DECISIVE CHECK: is the function table GENERATED per game (so a foreign game works), or hardcoded
# to Wonder?
set -uo pipefail

echo "=== loader.cpp: how call() resolves a target ==="
sed -n '150,185p' "$HOME/refs/wonder/runtime/src/loader.cpp"

echo
echo "=== loader.cpp: where the table is POPULATED ==="
sed -n '215,240p' "$HOME/refs/wonder/runtime/src/loader.cpp"

echo
echo "=== did the recompiler emit a table for SPLATOON 2? ==="
ls -la "$HOME/sp2recomp/gen/table.cpp" 2>/dev/null
echo "  --- head of MY generated table.cpp ---"
head -24 "$HOME/sp2recomp/gen/table.cpp" 2>/dev/null

echo
echo "=== its size / entry count ==="
if [ -f "$HOME/sp2recomp/gen/table.cpp" ]; then
  echo "  lines: $(wc -l < "$HOME/sp2recomp/gen/table.cpp")"
  echo "  function entries referenced: $(grep -o 'main_[0-9A-F]*' "$HOME/sp2recomp/gen/table.cpp" | wc -l)"
  echo "  offset/fn pairs: $(grep -c '0x' "$HOME/sp2recomp/gen/table.cpp")"
fi
