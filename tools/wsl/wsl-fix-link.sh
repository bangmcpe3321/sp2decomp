#!/usr/bin/env bash
# Fix the two real gaps found by the link and retry it:
#   1. table.cpp was never compiled (the build globbed only code_*.cpp), so nx_module_* were missing.
#   2. no per-game glue existed; add Splatoon 2's game.cpp.
set -uo pipefail

P="$HOME/sp2port"
SRC="/mnt/c/Users/Hexa/Documents/nintendo/re-work/sp2"
INC="$P/runtime/include"
: > "$P/retry-log.txt"
say() { echo "$@" | tee -a "$P/retry-log.txt"; }

say "=== 1. compile the table.cpp of every module ==="
for d in "$P"/gen/*/; do
  mod=$(basename "$d")
  t="$d/table.cpp"
  [ -f "$t" ] || continue
  out="$P/obj-all/$mod/table.o"
  if [ -f "$out" ]; then say "  $mod: already built"; continue; fi
  if g++ -std=c++20 -c -O1 -w -I "$INC" -I "$d" "$t" -o "$out" 2>"$out.err"; then
    say "  $mod: table.o OK ($(du -h "$out" | cut -f1))"
  else
    say "  $mod: FAILED"
    head -4 "$out.err" | sed 's/^/      /' | tee -a "$P/retry-log.txt"
  fi
done

say
say "=== 2. compile the game glue ==="
cp -f "$SRC/game.cpp" "$P/runtime/src/game_sp2.cpp"
if g++ -std=c++20 -c -O1 -w -I "$INC" -I "$P/runtime/src" "$P/runtime/src/game_sp2.cpp" \
     -o "$P/obj-all/_runtime/game_sp2.o" 2>"$P/game-err.txt"; then
  say "  game_sp2.o OK"
else
  say "  game_sp2.o FAILED"
  head -8 "$P/game-err.txt" | sed 's/^/      /' | tee -a "$P/retry-log.txt"
fi

say
say "=== 3. relink ==="
GEN=$(find "$P/obj-all" -name 'code_*.o' -o -name 'table.o' | grep -v _runtime | tr '\n' ' ')
RT=$(ls "$P"/obj-all/_runtime/*.o 2>/dev/null | tr '\n' ' ')
say "  generated objects: $(echo "$GEN" | wc -w)"
say "  runtime objects  : $(echo "$RT" | wc -w)"

g++ -o "$P/sp2" $GEN $RT -lm -lc -lgcc -lpthread -ldl 2>"$P/link-err2.txt"
RC=$?
say "  link exit: $RC"
if [ $RC -eq 0 ] && [ -f "$P/sp2" ]; then
  say "  *** LINK SUCCEEDED -- a Splatoon 2 binary exists ***"
  say "  size: $(du -h "$P/sp2" | cut -f1)"
  say "  file: $(file -b "$P/sp2" | cut -c1-72)"
else
  grep -oE "undefined reference to \`[^']*'" "$P/link-err2.txt" 2>/dev/null \
    | sed -E "s/.*\`//; s/'$//" | sort -u > "$P/undef2.txt"
  say "  distinct undefined: $(wc -l < "$P/undef2.txt" 2>/dev/null || echo 0)"
  say "  --- list ---"
  head -40 "$P/undef2.txt" | sed 's/^/    /' | tee -a "$P/retry-log.txt"
fi
