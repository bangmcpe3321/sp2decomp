#!/usr/bin/env bash
# What does Splatoon 2's SDK export that could perform system initialisation?
# The port enters at nnMain, bypassing whatever normally sets up mutexes/thread-pointers.
set -uo pipefail
G="$HOME/sp2port/gen"

echo "=== candidate init/startup symbols in main ==="
grep -oE '"_ZN2nn[0-9A-Za-z_]*(4init|7nnos|10Initialize|7Startup|5Start)[0-9A-Za-z_]*"' \
  "$G/main/table.cpp" 2>/dev/null | sort -u | head -20

echo
echo "=== same in sdk ==="
grep -oE '"_ZN2nn[0-9A-Za-z_]*(4init|7nnos|10Initialize|7Startup|5Start)[0-9A-Za-z_]*"' \
  "$G/sdk/table.cpp" 2>/dev/null | sort -u | head -20

echo
echo "=== nnos* symbols anywhere (the pre-nn::init SDK surface) ==="
grep -ohE '"nnos[A-Za-z0-9_]*"' "$G"/*/table.cpp 2>/dev/null | sort -u | head -16

echo
echo "=== plain C entry-ish names (nnMain / __libnx / nnosInitialize) ==="
for n in nnMain nnosInitialize nnosStartup __libnx_init __nx_init; do
  c=$(grep -c "\"$n\"" "$G"/*/table.cpp 2>/dev/null | awk -F: '{s+=$2} END{print s+0}')
  printf '  %-16s %s\n' "$n" "$c"
done
