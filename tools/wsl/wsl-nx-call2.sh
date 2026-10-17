#!/usr/bin/env bash
# The implementation of nx::call, and the table it indexes.
set -uo pipefail
cd "$HOME/refs/wonder" || exit 1

echo "=== files defining/exposing the function table ==="
grep -rln 'void call(CPU&' runtime/src runtime/include 2>/dev/null

echo
echo "=== the definition of nx::call ==="
grep -rn -A24 'void call(CPU& c, uint64_t target)' runtime/src 2>/dev/null | head -30

echo
echo "=== the table itself: how is it built and indexed? ==="
grep -rn 'g_table\|table\[\|funcs\[\|g_funcs\|kFunc\|Fn>\|unordered_map<uint64_t' runtime/src runtime/include 2>/dev/null | head -20

echo
echo "=== generated per-game glue: does it emit the table? ==="
ls games/wonder 2>/dev/null | head -12
echo "--- look for a generated table in a game dir or gen ---"
find games -name '*.cpp' 2>/dev/null | head -6
