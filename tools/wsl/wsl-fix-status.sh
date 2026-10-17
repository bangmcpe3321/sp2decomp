#!/usr/bin/env bash
# ROOT CAUSE of the null `this`:
#     sdk: init_status @ sdk+6bf678 = 2, init_count = 74
#     sdk constructors: 0
# Splatoon 2's SDK writes **2** into the init-status word; Wonder's writes **1**, and the runtime
# only runs constructors for `status == 1`. So SEVENTY-FOUR sdk constructors were silently skipped --
# whatever registers the object behind nn::nex::WaterMark never ran, hence this == NULL.
#
# Fix: run the constructors for any non-zero status, and log which value was seen.
set -uo pipefail
P="$HOME/sp2port"
M="$P/runtime/src/main.cpp"

python3 - "$M" <<'PY'
import sys
p = sys.argv[1]
s = open(p).read()

old = '''    if (status == 1)
        // PATCHED: log each entry BEFORE calling it.'''
new = '''    // PATCHED (round 8): Splatoon 2's SDK writes 2 into the init-status word, not 1. The stock
    // runtime required exactly 1, so sdk's SEVENTY-FOUR constructors were silently skipped and
    // nn::nex::WaterMark was constructed on a null `this`. Accept any non-zero status.
    if (status != 0)
        // PATCHED: log each entry BEFORE calling it.'''
if old not in s:
    print("ANCHOR NOT FOUND", file=sys.stderr); sys.exit(1)
s = s.replace(old, new, 1)

s = s.replace('log("%s constructors: %zu", m.name, status == 1 ? m.init_count : 0);',
              'log("%s constructors: %zu (status %u)", m.name, status != 0 ? m.init_count : 0, status);', 1)
open(p, "w").write(s)
print("patched: constructors run for any non-zero status")
PY

echo
echo "=== rebuild + run ==="
cd "$P" || exit 1
g++ -std=c++20 -c -O1 -w -I runtime/include -I runtime/src runtime/src/main.cpp \
    -o obj-all/_runtime/main.o 2>d9.txt || { head -10 d9.txt; exit 1; }
GEN=$(find "$P/obj-all" -name '*.o' | grep -v _runtime | tr '\n' ' ')
RTO=$(ls "$P"/obj-all/_runtime/*.o | tr '\n' ' ')
g++ -o "$P/sp2" $GEN $RTO -lm -lc -lgcc -lpthread -ldl 2>d9l.txt || { head -8 d9l.txt; exit 1; }
echo "  linked: $(du -h "$P/sp2" | cut -f1)"
echo
timeout 120 "$P/sp2" 2>&1 | grep -vE '^  UNRESOLVED|^    #|^  x[0-9]' | head -40
