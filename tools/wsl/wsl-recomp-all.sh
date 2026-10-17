#!/usr/bin/env bash
# Complete the CPU side: recompile subsdk0..3, and verify the sdk output compiles.
set -uo pipefail

EXEFS=/mnt/c/Users/Hexa/Documents/nintendo/hactool-1.4.0-win/exefs
WORK="$HOME/sp2recomp"
cd "$HOME/refs/wonder" || exit 1

echo "=== subsdk modules present ==="
for f in subsdk0 subsdk1 subsdk2 subsdk3; do
  [ -f "$EXEFS/$f" ] && printf '  %-8s %8s bytes\n' "$f" "$(stat -c%s "$EXEFS/$f")"
done

BASE_OFF=0x2000000
i=0
for f in subsdk0 subsdk1 subsdk2 subsdk3; do
  [ -f "$EXEFS/$f" ] || continue
  i=$((i+1))
  cp -f "$EXEFS/$f" "$WORK/$f"
  # Distinct base per module, continuing the 0x1000000 stride from sdk (0x7101000000).
  BASE=$(printf '0x%x' $((0x7100000000 + BASE_OFF * i)))
  echo
  echo "=== $f  (base $BASE) ==="
  python3 -m recomp "$WORK/$f" "$WORK/gen_$f" --name "$f" --base "$BASE" 2>&1 \
    | grep -E 'seeds:|pass |analysis:|done:' | tail -4
  echo "  report: $(cat "$WORK/gen_$f/report.txt" 2>/dev/null | head -1)"
  echo "  size:   $(du -sh "$WORK/gen_$f" 2>/dev/null | cut -f1)"
done

echo
echo "=== verify the SDK output COMPILES (same check as main) ==="
INC="$HOME/refs/wonder/runtime/include"
cd "$WORK/gen_sdk" || exit 1
CHECKED=0; OK=0
for f in $(ls code_*.cpp | head -4) code_059.cpp; do
  [ -f "$f" ] || continue
  CHECKED=$((CHECKED+1))
  printf '  %-16s ' "$f"
  if timeout 400 g++ -std=c++20 -fsyntax-only -w -I "$INC" -I . "$f" 2>/tmp/s.txt; then
    echo OK; OK=$((OK+1))
  else
    echo FAILED; head -4 /tmp/s.txt | sed 's/^/      /'
  fi
done
echo "  checked $CHECKED, OK $OK"

echo
echo "=== TOTALS across every module ==="
python3 - "$WORK" <<'PY'
import glob, os, re, sys
work = sys.argv[1]
tot_f = tot_i = 0
for rep in sorted(glob.glob(os.path.join(work, "gen*", "report.txt"))):
    txt = open(rep).read()
    m = re.search(r"functions (\d+), handled (\d+), unhandled (\d+)", txt)
    b = re.search(r"unresolved br[^,]*,?\s*(\d+)|unresolved br \(indirect tail calls\) (\d+)", txt)
    br = int((b.group(1) or b.group(2))) if b else 0
    name = os.path.basename(os.path.dirname(rep))
    if m:
        f, i, u = int(m.group(1)), int(m.group(2)), int(m.group(3))
        tot_f += f; tot_i += i
        print("  %-12s functions %7d  handled %9d  unhandled %d  br %d" % (name, f, i, u, br))
print("  %-12s functions %7d  handled %9d" % ("TOTAL", tot_f, tot_i))
PY
