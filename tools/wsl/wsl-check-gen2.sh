#!/usr/bin/env bash
# Syntax-check the generated C++ WITH Wonder's runtime include path, which the generated code
# depends on (nx/cpu.h). Without -I the check fails on a missing header, which says nothing
# about the generated code's validity.
set -uo pipefail

GEN="$HOME/sp2recomp/gen"
INC="$HOME/refs/wonder/runtime/include"
cd "$GEN" || exit 1

echo "include path: $INC"
ls "$INC/nx/cpu.h" >/dev/null 2>&1 && echo "  nx/cpu.h present"

echo
echo "=== syntax-check sampled translation units ==="
CHECKED=0; OK=0
for f in code_000.cpp code_050.cpp code_100.cpp code_200.cpp code_300.cpp code_400.cpp code_432.cpp; do
  [ -f "$f" ] || continue
  CHECKED=$((CHECKED+1))
  printf '  %-16s ' "$f"
  if timeout 400 g++ -std=c++20 -fsyntax-only -w -I "$INC" -I . "$f" 2>/tmp/syn.txt; then
    echo "OK"; OK=$((OK+1))
  else
    echo "FAILED"
    head -5 /tmp/syn.txt | sed 's/^/      /'
  fi
done

echo
echo "checked $CHECKED, OK $OK"

echo
echo "=== what does a generated function look like? ==="
sed -n '1,12p' code_000.cpp
echo "  ..."
awk '/^void |^uint|^int|^u32|^u64/ {print; c++; if(c>=3) exit}' code_000.cpp | head -8
