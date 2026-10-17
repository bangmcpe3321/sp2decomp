#!/usr/bin/env bash
# Identify the self-referential node 0x710304fb90 (= main + 0x304fb90).
# It is a static object in main's data region: find it in the symbol/relocation tables, then find which
# PseudoGlobalVariable<T> constructor writes there.
set -uo pipefail
G="$HOME/sp2port/gen"

echo "=== 0x304fb90 in main's symbols (a named static?) ==="
grep -oE '\{"[^"]*", 0x304f[0-9a-f]*, ' "$G/main/table.cpp" 2>/dev/null | head -8

echo
echo "=== does any symbol sit exactly at 0x304fb90? ==="
grep -c '0x304fb90[,}]' "$G/main/table.cpp" 2>/dev/null || echo 0

echo
echo "=== it as a registered data symbol (main's data table) ==="
grep -oE '"[A-Za-z_][A-Za-z0-9_]*", 0x304fb90' "$G/main/table.cpp" 2>/dev/null | head -5

echo
echo "=== what section is 0x304fb90 in? main data starts at +
# from earlier: text 0, ro 0x1416000, data 0x2d63000, bss 0x2fdb1b0
echo "    data 0x2d63000..0x2fdb1b0   bss 0x2fdb1b0.."
echo
echo "=== relocations targeting 0x304fb90 (who references it) ==="
grep -c '0x304fb90' "$G/main/table.cpp" 2>/dev/null || echo 0
