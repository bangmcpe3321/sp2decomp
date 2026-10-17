#!/usr/bin/env bash
# STEP 3 of the goal: link all objects and CATEGORISE the undefined-symbol set.
#
# The point is not to produce a working binary -- it is to convert "what's still missing?" from an
# estimate into an enumerated, categorised list:
#   * missing nn::* HLE imports      (the runtime's job; our platform layer is the reference shape)
#   * missing nx:: runtime helpers   (the MIT runtime's job)
#   * missing NVN entry points       (out of scope for this goal, but must be counted)
#   * missing generated guest funcs  (should be zero if all modules compiled)
#   * libc/libm                      (free)
set -uo pipefail

P="$HOME/sp2port"
OBJ="$P/obj-all"
LOG="$P/link-analysis.txt"
: > "$LOG"

say() { echo "$@" | tee -a "$LOG"; }

say "=== objects available ==="
say "  generated: $(find "$OBJ" -name 'code_*.o' | wc -l)"
say "  runtime  : $(ls "$OBJ"/_runtime/*.o 2>/dev/null | wc -l)"

# Collect every undefined symbol across all objects.
say
say "=== collecting undefined symbols ==="
nm --undefined-only --demangle "$OBJ"/*/code_*.o 2>/dev/null \
  | sed -E 's/^ *U //' | sort -u > "$P/undef-generated.txt"
nm --undefined-only --demangle "$OBJ"/_runtime/*.o 2>/dev/null \
  | sed -E 's/^ *U //' | sort -u > "$P/undef-runtime.txt"

# Collect every DEFINED symbol across all objects, so we can tell "missing" from "provided".
nm --defined-only --demangle "$OBJ"/*/code_*.o "$OBJ"/_runtime/*.o 2>/dev/null \
  | sed -E 's/^[0-9a-fA-F]* [A-Za-z] //' | sort -u > "$P/defined-all.txt"

say "  undefined (generated objects): $(wc -l < "$P/undef-generated.txt")"
say "  undefined (runtime objects)  : $(wc -l < "$P/undef-runtime.txt")"
say "  defined   (all objects)      : $(wc -l < "$P/defined-all.txt")"

# The genuinely MISSING set = undefined minus defined.
say
say "=== genuinely missing (undefined AND not defined anywhere) ==="
comm -23 "$P/undef-generated.txt" "$P/defined-all.txt" > "$P/missing.txt"
MISSING=$(wc -l < "$P/missing.txt")
say "  MISSING: $MISSING"

say
say "--- categorised ---"
cat_grep() { local pat="$1" label="$2"; local n; n=$(grep -cE "$pat" "$P/missing.txt" 2>/dev/null || true); printf '  %-34s %6s\n' "$label" "${n:-0}"; }
{
  cat_grep '^nn::'                      'nn::*  (HLE imports)'
  cat_grep '^nx::'                      'nx::*  (runtime helpers)'
  cat_grep '^nvn|^NVN'                  'nvn*   (NVN - OUT OF SCOPE)'
  cat_grep '^sead::|^Lp::|^agl::'       'sead/Lp/agl (engine - should be 0)'
  cat_grep '^_Z[A-Za-z0-9_]+'           'other C++ mangled'
  cat_grep '^(memcpy|memset|memmove|strlen|malloc|free|abort|printf|sqrtf|truncf|floorf|ceilf|powf|expf|logf|sinf|cosf)' 'libc/libm'
} | tee -a "$LOG"

say
say "=== the nn::* set in full (this is the HLE work list) ==="
grep -E '^nn::' "$P/missing.txt" 2>/dev/null | sed 's/^/  /' | tee -a "$LOG" | head -60
say "  ... (see $P/missing.txt for the complete list)"

say
say "=== the nx::* set in full (runtime gaps) ==="
grep -E '^nx::' "$P/missing.txt" 2>/dev/null | sed 's/^/  /' | tee -a "$LOG"

say
say "=== verdict ==="
if [ "$MISSING" -eq 0 ]; then
  say "  ZERO missing symbols across every object -- a full link is plausible."
else
  say "  $MISSING missing symbols. The nn::* count above is the HLE work list;"
  say "  everything else should be zero or explained."
fi
