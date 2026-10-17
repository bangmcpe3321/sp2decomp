#!/usr/bin/env bash
# THE DECIDING QUESTION: is nx::call keyed on a table a foreign game can populate?
set -uo pipefail
cd "$HOME/refs/wonder" || exit 1

echo "=== nx headers ==="
ls runtime/include/nx/

echo
echo "=== declaration / definition of nx::call ==="
grep -rn 'call' runtime/include/nx/ 2>/dev/null | grep -E '\bcall\b' | head -12

echo
echo "=== the CPU struct: does it carry a function table? ==="
grep -n -A40 'struct CPU' runtime/include/nx/cpu.h 2>/dev/null | head -56
