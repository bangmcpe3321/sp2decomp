#!/usr/bin/env bash
# Confirm the g_fast[4] module limit and its consequence for Splatoon 2's SIX modules.
set -uo pipefail
cd "$HOME/refs/wonder" || exit 1

echo "=== every reference to g_fast ==="
grep -rn 'g_fast' runtime/src/*.cpp runtime/include/ 2>/dev/null

echo
echo "=== the module registration loop, in full ==="
grep -n -B4 -A3 'g_fast_count++' runtime/src/loader.cpp 2>/dev/null

echo
echo "=== is there a NON-fast fallback for unregistered modules? ==="
grep -n 'g_modules' runtime/src/loader.cpp 2>/dev/null | head -12

echo
echo "=== how many modules does Splatoon 2 have, and their sizes? ==="
E=/mnt/c/Users/Hexa/Documents/nintendo/hactool-1.4.0-win/exefs
for m in main sdk subsdk0 subsdk1 subsdk2 subsdk3; do
  [ -f "$E/$m" ] && printf '  %-9s %9s bytes\n' "$m" "$(stat -c%s "$E/$m")"
done
echo "  -> 6 modules; g_fast holds 4."
