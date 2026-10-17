#!/usr/bin/env bash
set -uo pipefail
echo "=== build log tail ==="
tail -14 "$HOME/sp2port-build.out" 2>/dev/null || echo "  (no log yet)"

echo
echo "=== objects so far ==="
TOTAL=$(find "$HOME/sp2port/obj-all" -name '*.o' 2>/dev/null | wc -l)
echo "  total: $TOTAL"
for d in "$HOME"/sp2port/obj-all/*/; do
  [ -d "$d" ] || continue
  n=$(find "$d" -maxdepth 1 -name '*.o' 2>/dev/null | wc -l)
  if [ "$n" -gt 0 ]; then
    printf '    %-12s %s\n' "$(basename "$d")" "$n"
  fi
done

echo
echo "=== compiler processes still running ==="
pgrep -fc 'g\+\+.*-c' 2>/dev/null || echo 0

echo
echo "=== failures logged ==="
grep -c '^FAILED\|^RUNTIME-FAILED' "$HOME/sp2port/build-log.txt" 2>/dev/null || echo 0

echo
echo "=== disk ==="
df -h "$HOME" | tail -1
