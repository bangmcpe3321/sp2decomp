#!/usr/bin/env bash
# Full recompile of Splatoon 2's main with the MIT recompiler.
set -uo pipefail

WORK="$HOME/sp2recomp"
cd "$HOME/refs/wonder" || exit 1

echo "=== FULL RECOMPILE: Splatoon 2 main, base 0x7100000000 ==="
date -u +'start %H:%M:%S'
/usr/bin/time -v python3 -m recomp "$WORK/main" "$WORK/gen" --name main --base 0x7100000000 2>&1 \
  | tail -40
echo "exit=$?"
date -u +'end   %H:%M:%S'

echo
echo "=== output ==="
du -sh "$WORK/gen" 2>/dev/null
find "$WORK/gen" -type f | head -12
echo
echo "=== report: unhandled instructions / jump tables ==="
head -30 "$WORK/gen/report.txt" 2>/dev/null
