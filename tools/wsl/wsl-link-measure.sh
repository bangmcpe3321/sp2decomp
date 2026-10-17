#!/usr/bin/env bash
# MEASURE THE DISTANCE TO A LINK: compile the generated main into objects and count undefined
# symbols. This is the honest metric for "how far from runnable", as opposed to "does it compile".
set -uo pipefail

GEN="$HOME/sp2recomp/gen"
INC="$HOME/refs/wonder/runtime/include"
OBJ="$HOME/sp2recomp/obj"
mkdir -p "$OBJ"
cd "$GEN" || exit 1

echo "=== compile 3 generated TUs to OBJECT files (not just -fsyntax-only) ==="
OK=0
for f in code_000.cpp code_100.cpp code_400.cpp; do
  [ -f "$f" ] || continue
  printf '  %-16s ' "$f"
  if timeout 600 g++ -std=c++20 -c -O1 -w -I "$INC" -I . "$f" -o "$OBJ/${f%.cpp}.o" 2>/tmp/c.txt; then
    echo "OK  ($(du -h "$OBJ/${f%.cpp}.o" | cut -f1))"; OK=$((OK+1))
  else
    echo "FAILED"; head -6 /tmp/c.txt | sed 's/^/      /'
  fi
done
echo "  compiled $OK/3"

echo
echo "=== undefined symbols those objects require (the runtime's job) ==="
if ls "$OBJ"/*.o >/dev/null 2>&1; then
  nm -uC "$OBJ"/*.o 2>/dev/null | sed 's/^ *U //' | sort -u > /tmp/undef.txt
  echo "  distinct undefined symbols: $(wc -l < /tmp/undef.txt)"
  echo "  --- grouped by prefix ---"
  sed -E 's/^(nx|nn|sead|Lp|nv)::.*/\1::/' /tmp/undef.txt | sort | uniq -c | sort -rn | head -12
  echo "  --- first 24 ---"
  head -24 /tmp/undef.txt | sed 's/^/      /'
fi

echo
echo "=== how many undefined are MEMORY helpers vs game functions? ==="
if [ -s /tmp/undef.txt ]; then
  echo "  nx:: (runtime)        : $(grep -c '^nx::' /tmp/undef.txt || true)"
  echo "  anything else         : $(grep -vc '^nx::' /tmp/undef.txt || true)"
  echo "  --- the non-nx ones, if any ---"
  grep -v '^nx::' /tmp/undef.txt | head -16 | sed 's/^/      /'
fi
