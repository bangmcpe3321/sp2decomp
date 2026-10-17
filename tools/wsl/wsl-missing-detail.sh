#!/usr/bin/env bash
set -uo pipefail
P="$HOME/sp2port"

echo "=== the missing symbols, line by line ==="
nl -ba "$P/missing.txt" 2>/dev/null

echo
echo "=== hexdump check (are they blanks?) ==="
wc -l < "$P/missing.txt"
grep -c . "$P/missing.txt" || true

echo
echo "=== runtime compile failure ==="
grep -B1 -A4 'RUNTIME-FAILED' "$P/build-log.txt" 2>/dev/null | head -10

echo
echo "=== which runtime source has no object? ==="
for s in "$P"/runtime/src/*.cpp; do
  b=$(basename "${s%.cpp}")
  case "$b" in platform_mac|platform_win|platform_android|memguard_mac|memguard_win|memguard_android|touch_layout|input_script|frame_stats|perf_hint) continue;; esac
  [ -f "$P/obj-all/_runtime/$b.o" ] || echo "  NO OBJECT: $b"
done
