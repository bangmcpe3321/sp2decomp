#!/usr/bin/env bash
# Reconfigure, build and run ALL port test binaries.
set -uo pipefail

PORT="/mnt/c/Users/Hexa/Documents/nintendo/sp2decomp/port"
BUILD="$HOME/sp2port-build"
rc=0

echo "=== configure ==="
cmake -S "$PORT" -B "$BUILD" -G Ninja -DCMAKE_BUILD_TYPE=RelWithDebInfo 2>&1 | tail -4

echo
echo "=== build (warnings are failures of intent, so report them) ==="
cmake --build "$BUILD" 2>&1 | grep -E 'error|warning|Linking|FAILED' | head -30
echo "   build exit=${PIPESTATUS[0]}"

echo
for t in platform_tests services_tests; do
  echo "=== $t ==="
  if [ -x "$BUILD/$t" ]; then
    "$BUILD/$t" 2>&1 | tail -6
    e=$?
    [ $e -ne 0 ] && rc=$e
    echo "   exit=$e"
  else
    echo "   not built"
    rc=1
  fi
  echo
done

echo "=== ctest summary ==="
(cd "$BUILD" && ctest --output-on-failure 2>&1 | tail -8)

echo
echo "overall rc=$rc"
exit $rc
