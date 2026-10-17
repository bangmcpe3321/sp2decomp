#!/usr/bin/env bash
# Re-stage the regenerated code, recompile every TU, relink and re-run.
set -uo pipefail
P="$HOME/sp2port"
G="$HOME/sp2recomp"
INC="$P/runtime/include"

echo "=== 1. re-stage generated code with the new bases ==="
for pair in "gen:main" "gen_sdk:sdk" "gen_subsdk0:subsdk0" "gen_subsdk1:subsdk1" \
            "gen_subsdk2:subsdk2" "gen_subsdk3:subsdk3"; do
  src="$G/${pair%%:*}"; dst="$P/gen/${pair##*:}"
  [ -d "$src" ] || continue
  rm -rf "$dst"; mkdir -p "$dst"
  cp -f "$src"/*.cpp "$src"/*.h "$dst"/ 2>/dev/null
  printf '  %-9s %3s cpp\n' "${pair##*:}" "$(ls "$dst"/code_*.cpp 2>/dev/null | wc -l)"
done

echo
echo "=== 2. drop the stale objects (bases are baked in) ==="
rm -rf "$P/obj-all"
mkdir -p "$P/obj-all"
echo "  cleared"

echo
echo "=== 3. compile all TUs, 6 at a time ==="
compile_one() {
  local src="$1"
  local mod; mod=$(basename "$(dirname "$src")")
  local base="$OBJ/$mod"; mkdir -p "$base"
  local out="$base/$(basename "${src%.cpp}").o"
  g++ -std=c++20 -c -O1 -w -I "$INC" -I "$(dirname "$src")" "$src" -o "$out" 2>"$out.err" \
    || { echo "FAILED $src" >> "$LOG"; head -3 "$out.err" >> "$LOG"; }
}
export -f compile_one
export OBJ="$P/obj-all" INC LOG="$P/rebuild-log.txt"
: > "$LOG"

# code_*.cpp and table.cpp both
find "$P/gen" \( -name 'code_*.cpp' -o -name 'table.cpp' \) -print0 \
  | xargs -0 -P 6 -I{} bash -c 'compile_one "$@"' _ {}

echo "  objects: $(find "$P/obj-all" -name '*.o' | wc -l)"
echo "  failures: $(grep -c '^FAILED' "$LOG" 2>/dev/null || echo 0)"

echo
echo "=== 4. runtime objects (platform layer + core) ==="
ROBJ="$P/obj-all/_runtime"; mkdir -p "$ROBJ"
for src in "$P"/runtime/src/*.cpp; do
  b=$(basename "${src%.cpp}")
  case "$b" in
    platform_mac|platform_win|platform_android|platform_android_audio|platform_android_input|\
memguard_mac|memguard_win|memguard_android|touch_layout|input_script|frame_stats|perf_hint|vk_*) continue;;
  esac
  g++ -std=c++20 -c -O1 -w -I "$INC" -I "$P/runtime/src" "$src" -o "$ROBJ/$b.o" 2>/dev/null \
    || echo "  runtime FAILED: $b"
done
echo "  runtime objects: $(ls "$ROBJ"/*.o 2>/dev/null | wc -l)"

echo
echo "=== 5. relink ==="
GEN=$(find "$P/obj-all" -name '*.o' | grep -v _runtime | tr '\n' ' ')
RTO=$(ls "$ROBJ"/*.o | tr '\n' ' ')
g++ -o "$P/sp2" $GEN $RTO -lm -lc -lgcc -lpthread -ldl 2>"$P/link4.txt"
RC=$?
echo "  link exit: $RC  ($(du -h "$P/sp2" 2>/dev/null | cut -f1))"
[ $RC -ne 0 ] && { head -8 "$P/link4.txt" | sed 's/^/    /'; exit 1; }

echo
echo "=== 6. RUN (90 s) ==="
cd "$P" && timeout 90 ./sp2 2>&1 | head -44
echo "  exit: ${PIPESTATUS[0]} (124 = still running)"
