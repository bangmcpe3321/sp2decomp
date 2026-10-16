#!/usr/bin/env bash
# Configure, build and run the platform contract tests.
set -uo pipefail

PORT="/mnt/c/Users/Hexa/Documents/nintendo/sp2decomp/port"
BUILD="$HOME/sp2port-build"

echo "=== toolchain ==="
g++ --version | head -1
cmake --version | head -1
ninja --version

echo
echo "=== configure ==="
cmake -S "$PORT" -B "$BUILD" -G Ninja -DCMAKE_BUILD_TYPE=RelWithDebInfo 2>&1 | tail -8
echo "   configure exit=$?"

echo
echo "=== build ==="
cmake --build "$BUILD" 2>&1 | tail -25
echo "   build exit=$?"

echo
echo "=== run tests ==="
if [ -x "$BUILD/platform_tests" ]; then
  "$BUILD/platform_tests"
  echo "   test exit=$?"
else
  echo "   binary not produced"
fi

echo
echo "=== also report warnings-only rebuild to catch ABI sloppiness ==="
touch "$PORT/src/os.cpp"
cmake --build "$BUILD" 2>&1 | grep -E 'warning|error' | head -12 || echo "   no warnings"
