#!/usr/bin/env bash
set -uo pipefail
G="$HOME/sp2port/gen"

echo "=== nn::init symbols exported by Splatoon 2 main ==="
grep -o '_ZN2nn4init[0-9A-Za-z_]*' "$G/main/table.cpp" 2>/dev/null | sort -u | head -12

echo
echo "=== nn::init symbols exported by sdk ==="
grep -o '_ZN2nn4init[0-9A-Za-z_]*' "$G/sdk/table.cpp" 2>/dev/null | sort -u | head -12

echo
echo "=== any 'Start' symbol in main (mangled) ==="
grep -o '_ZN2nn[0-9A-Za-z_]*5Start[0-9A-Za-z_]*' "$G/main/table.cpp" 2>/dev/null | sort -u | head -10

echo
echo "=== the game's real entry point candidates (nnMain / main-ish) ==="
grep -o '"_ZN2nn[0-9A-Za-z_]*4init[0-9A-Za-z_]*"' "$G/main/table.cpp" "$G/sdk/table.cpp" 2>/dev/null | sort -u | head -10
