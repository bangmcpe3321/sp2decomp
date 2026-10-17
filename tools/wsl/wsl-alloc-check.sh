#!/usr/bin/env bash
set -uo pipefail
R="$HOME/sp2port/runtime/src"

echo "=== operator new / malloc in the runtime ==="
grep -rn 'operator new\|_Znwm\|::malloc' "$R"/*.cpp 2>/dev/null | head -12

echo
echo "=== HLE names containing new/malloc/alloc ==="
grep -rhn 'NX_HLE("' "$R"/*.cpp 2>/dev/null | grep -iE 'new|malloc|alloc' | head -14

echo
echo "=== is operator new an unresolved import in main? ==="
grep -c '_Znwm\|_Znam' "$HOME/sp2port/gen/main/table.cpp" 2>/dev/null || echo 0

echo
echo "=== nn::init::InitializeAllocator / GetAllocator offsets ==="
for t in "$HOME"/sp2port/gen/*/table.cpp; do
  m=$(grep -o '{"_ZN2nn4init19InitializeAllocator[^}]*}' "$t" 2>/dev/null | head -1)
  [ -n "$m" ] && echo "  $(basename "$(dirname "$t")"): $m"
done
