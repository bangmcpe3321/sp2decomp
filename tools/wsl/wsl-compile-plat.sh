#!/usr/bin/env bash
set -uo pipefail
P="$HOME/sp2port"
cd "$P" || exit 1

echo "=== compile platform_linux.cpp ==="
g++ -std=c++20 -c -O1 -w -I runtime/include -I runtime/src \
    runtime/src/platform_linux.cpp -o obj-all/_runtime/platform_linux.o 2>"$P/plat-err.txt"
RC=$?
echo "  exit: $RC"
if [ -f obj-all/_runtime/platform_linux.o ]; then
  echo "  object: $(du -h obj-all/_runtime/platform_linux.o | cut -f1)"
else
  echo "  FAILED -- first 24 errors:"
  head -24 "$P/plat-err.txt" | sed 's/^/    /'
fi
