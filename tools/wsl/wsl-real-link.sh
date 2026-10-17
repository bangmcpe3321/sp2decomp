#!/usr/bin/env bash
# STEP 3b: the REAL link. All 516 generated objects + runtime core + libc/libm/libgcc.
#
# The previous analysis found only 12 missing symbols and every one is a standard-library symbol,
# so a complete link should be possible today. This proves it.
set -uo pipefail

P="$HOME/sp2port"
OBJ="$P/obj-all"
OUT="$P/sp2"
LOG="$P/link-result.txt"
: > "$LOG"
say() { echo "$@" | tee -a "$LOG"; }

say "=== inputs ==="
say "  generated objects: $(find "$OBJ" -name 'code_*.o' | wc -l)"
say "  runtime objects  : $(ls "$OBJ"/_runtime/*.o 2>/dev/null | wc -l)"

# Fix the one runtime source that failed on a missing include, so hle_fs is available.
FS="$P/runtime/src/hle_fs.cpp"
if [ -f "$FS" ] && ! grep -q '#include <vector>' "$FS"; then
  say
  say "=== repairing hle_fs.cpp: missing #include <vector> ==="
  sed -i '1i #include <vector>  // PATCHED: hle_fs.cpp used std::vector without including it' "$FS"
  g++ -std=c++20 -c -O1 -w -I "$P/runtime/include" "$FS" -o "$OBJ/_runtime/hle_fs.o" 2>&1 | head -5
  [ -f "$OBJ/_runtime/hle_fs.o" ] && say "  hle_fs.o now built" || say "  still failing"
fi

# nx:: call/unimpl/svc/mrs/msr come from loader.cpp, which pulls in the platform layer. Provide
# small stand-ins instead so the LINK can be measured without the platform layer existing.
say
say "=== link ==="
RT=$(ls "$OBJ"/_runtime/*.o 2>/dev/null | tr '\n' ' ')
GEN=$(find "$OBJ" -name 'code_*.o' | tr '\n' ' ')

# The runtime has its own main() (main.cpp); use --allow-multiple-definition is wrong.
# Instead: link the game + runtime, and let the missing platform symbols be reported.
g++ -o "$OUT" $GEN $RT -lm -lc -lgcc -lpthread -ldl \
  -Wl,--unresolved-symbols=report-all 2>"$P/link-err.txt"
RC=$?

say "  g++ exit: $RC"
if [ $RC -eq 0 ] && [ -f "$OUT" ]; then
  say "  *** LINK SUCCEEDED ***"
  say "  binary: $(du -h "$OUT" | cut -f1)"
  say "  file:   $(file -b "$OUT" | cut -c1-70)"
else
  say "  link reported problems; first 40 lines:"
  head -40 "$P/link-err.txt" | sed 's/^/    /' | tee -a "$LOG"
  say
  say "  --- undefined symbol count ---"
  grep -oE "undefined reference to [^']*'[^']*'" "$P/link-err.txt" 2>/dev/null \
    | sed -E "s/.*\`([^']*)'.*/\1/" | sort -u > "$P/link-undef.txt"
  say "  distinct undefined: $(wc -l < "$P/link-undef.txt" 2>/dev/null || echo 0)"
  say "  --- categorised ---"
  for pat in '^nn::' '^nx::' '^nvn|^NVN' '^nx::nvn|NVN' '^vk' 'platform' '^(sqrt|round|fma|nearby|trunc|__)' ; do
    n=$(grep -cE "$pat" "$P/link-undef.txt" 2>/dev/null || true)
    printf '    %-28s %s\n' "$pat" "${n:-0}" | tee -a "$LOG"
  done
  say
  say "  --- first 40 undefined ---"
  head -40 "$P/link-undef.txt" | sed 's/^/    /' | tee -a "$LOG"
fi
