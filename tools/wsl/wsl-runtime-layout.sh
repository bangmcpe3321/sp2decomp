#!/usr/bin/env bash
set -uo pipefail
pkill -f 'git clone.*SwitchGamesRecomp' 2>/dev/null && echo "clone stopped" || echo "clone not running"

cd "$HOME/sp2port/runtime" || exit 1
echo
echo "=== runtime/src/*.cpp (top level) ==="
ls src/*.cpp 2>/dev/null | xargs -n1 basename 2>/dev/null
echo
echo "=== runtime/src subdirectories ==="
find src -mindepth 1 -maxdepth 1 -type d 2>/dev/null | xargs -n1 basename 2>/dev/null
echo
echo "=== include ==="
ls include/ 2>/dev/null
echo
echo "=== does the runtime have its own build file? ==="
ls CMakeLists.txt Makefile 2>/dev/null || echo "  (none inside runtime/)"
echo
echo "=== what the TOP-LEVEL CMakeLists includes for the runtime ==="
grep -nE 'runtime/|add_library|RUNTIME_SRC|file\(GLOB' "$HOME/refs/wonder/CMakeLists.txt" 2>/dev/null | head -20
