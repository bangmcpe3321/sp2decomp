#!/usr/bin/env bash
set -uo pipefail
cd "$HOME/refs/wonder" || exit 1

echo "=== ModuleInfo shape (nx/module.h) ==="
grep -n -A16 'struct ModuleInfo' runtime/include/nx/module.h 2>/dev/null | head -22

echo
echo "=== where the module array comes from (loader.cpp) ==="
grep -n 'mods' runtime/src/loader.cpp 2>/dev/null | head -14

echo
echo "=== does the game glue declare its modules? ==="
grep -n 'ModuleInfo\|g_modules\|modules' games/wonder/game.cpp 2>/dev/null | head -12

echo
echo "=== the loader entry that takes the module list ==="
grep -n -B2 -A10 'mods\[\]' runtime/src/loader.cpp runtime/include/nx/loader.h 2>/dev/null | head -24
