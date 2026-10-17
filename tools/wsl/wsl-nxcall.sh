#!/usr/bin/env bash
set -uo pipefail
cd "$HOME/sp2recomp/gen" || exit 1

echo "=== how nx::call is used: the indirect-branch dispatcher ==="
grep -h 'nx::call' code_*.cpp | head -5

echo
echo "=== nx::call total occurrences ==="
grep -h 'nx::call' code_*.cpp | wc -l

echo
echo "=== context: a function making an indirect call ==="
grep -l 'nx::call' code_*.cpp | head -1 | while read -r f; do
  echo "  file: $f"
  grep -n -B2 -A1 'nx::call' "$f" | head -14 | sed 's/^/    /'
done

echo
echo "=== V128 / vzero usage ==="
grep -h 'nx::V128\|nx::vzero' code_*.cpp | head -3
