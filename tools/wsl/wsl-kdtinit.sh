#!/usr/bin/env bash
set -uo pipefail
P="$HOME/sp2port"
echo "=== kDtInit: definition and uses ==="
grep -rn 'kDtInit' "$P/runtime/src" "$P/runtime/include" 2>/dev/null | head -8

echo
echo "=== init_status_addr + the surrounding function ==="
sed -n '90,112p' "$P/runtime/src/main.cpp"

echo
echo "=== what does 'sdk+30' resolve to in the generated table? ==="
grep -o '{"_init[^}]*}' "$P/gen/sdk/table.cpp" 2>/dev/null | head -4
grep -c '_init' "$P/gen/sdk/table.cpp" 2>/dev/null || echo 0
