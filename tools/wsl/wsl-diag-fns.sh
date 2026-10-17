#!/usr/bin/env bash
set -uo pipefail
R="$HOME/sp2port/runtime"
echo "=== describe / backtrace / current_cpu declarations ==="
grep -rn 'describe\|backtrace\|current_cpu' "$R/include/nx/runtime.h" "$R/include/nx/cpu.h" 2>/dev/null | head -12

echo
echo "=== their definitions (signatures) ==="
grep -n 'std::string describe\|void backtrace\|CPU& current_cpu\|uint64_t resolve' "$R/src"/*.cpp 2>/dev/null | head -10

echo
echo "=== how platform_win's crash handler reports a fault (the template to follow) ==="
grep -n -A18 'LONG WINAPI crash_handler' "$R/src/platform_win.cpp" 2>/dev/null | head -26
