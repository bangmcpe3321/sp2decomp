#!/usr/bin/env bash
# STEP 2+3 of the goal: compile ALL 516 generated translation units, then link and enumerate the
# undefined-symbol set, categorised.
#
# This is long (~1-2 h), so it is designed to be run as a background job and to leave a complete
# log even if interrupted. Compilation is parallel and incremental: an object that already exists
# is skipped, so a re-run resumes.
set -uo pipefail

P="$HOME/sp2port"
INC="$P/runtime/include"
OBJ="$P/obj-all"
LOG="$P/build-log.txt"
JOBS="${JOBS:-$(nproc)}"

mkdir -p "$OBJ"
: > "$LOG"

echo "=== build configuration ===" | tee -a "$LOG"
echo "  jobs        : $JOBS" | tee -a "$LOG"
echo "  include     : $INC" | tee -a "$LOG"
echo "  objects     : $OBJ" | tee -a "$LOG"
echo "  disk free   : $(df -h "$HOME" | tail -1 | awk '{print $4}')" | tee -a "$LOG"
echo "  g++         : $(g++ --version | head -1)" | tee -a "$LOG"

# Module bases as generated (recorded for the link stage).
cat >> "$LOG" <<'MODS'

=== module bases (as generated) ===
  main     0x7100000000
  sdk      0x7101000000
  subsdk0  0x7102000000
  subsdk1  0x7104000000
  subsdk2  0x7106000000
  subsdk3  0x7108000000
MODS

# --- compile --------------------------------------------------------------------------------
count_total=0
count_done=0
for d in "$P"/gen/*; do
  [ -d "$d" ] || continue
  count_total=$((count_total + $(ls "$d"/code_*.cpp 2>/dev/null | wc -l)))
done
echo | tee -a "$LOG"
echo "=== compiling $count_total translation units ===" | tee -a "$LOG"

compile_one() {
  local src="$1"
  local mod
  mod=$(basename "$(dirname "$src")")
  local base="$OBJ/$mod"
  mkdir -p "$base"
  local out="$base/$(basename "${src%.cpp}").o"
  [ -f "$out" ] && return 0
  if g++ -std=c++20 -c -O1 -w -I "$INC" -I "$(dirname "$src")" "$src" -o "$out" 2>"$out.err"; then
    rm -f "$out.err"
    return 0
  fi
  echo "FAILED $src" >> "$LOG"
  head -5 "$out.err" >> "$LOG"
  return 1
}
export -f compile_one
export OBJ INC LOG

# xargs -P for parallelism; -n1 so each TU is its own job.
find "$P"/gen -name 'code_*.cpp' -print0 \
  | xargs -0 -P "$JOBS" -I{} bash -c 'compile_one "$@"' _ {} 2>/dev/null

count_done=$(find "$OBJ" -name '*.o' | wc -l)
echo "  compiled: $count_done / $count_total" | tee -a "$LOG"
echo "  object bytes: $(du -sh "$OBJ" | cut -f1)" | tee -a "$LOG"

echo | tee -a "$LOG"
echo "=== failures, if any (see log) ===" | tee -a "$LOG"
grep -c '^FAILED' "$LOG" 2>/dev/null | sed 's/^/  /' | tee -a "$LOG"

# --- link attempt ---------------------------------------------------------------------------
echo | tee -a "$LOG"
echo "=== LINK ATTEMPT: all objects + runtime core, unresolved tolerated for measurement ===" | tee -a "$LOG"

# Runtime sources that do NOT need a windowing platform, and NOT nvn (graphics is out of scope).
RUNTIME_CORE=$(ls "$P"/runtime/src/*.cpp 2>/dev/null \
  | grep -vE 'platform_(mac|win|android)|memguard_(mac|win|android)|/nvn/|vk_|touch_layout|input_script|frame_stats|perf_hint')

echo "  runtime core sources: $(echo "$RUNTIME_CORE" | wc -l)" | tee -a "$LOG"

# Compile the runtime core too.
ROBJ="$OBJ/_runtime"
mkdir -p "$ROBJ"
for src in $RUNTIME_CORE; do
  out="$ROBJ/$(basename "${src%.cpp}").o"
  [ -f "$out" ] && continue
  g++ -std=c++20 -c -O1 -w -I "$INC" "$src" -o "$out" 2>"$out.err" || {
    echo "RUNTIME-FAILED $(basename "$src")" >> "$LOG"
    head -4 "$out.err" >> "$LOG"
  }
done
echo "  runtime objects: $(ls "$ROBJ"/*.o 2>/dev/null | wc -l)" | tee -a "$LOG"

echo | tee -a "$LOG"
echo "=== DONE. Next: inspect $LOG for failures, then link. ===" | tee -a "$LOG"
