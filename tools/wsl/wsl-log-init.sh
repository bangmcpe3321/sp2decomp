#!/usr/bin/env bash
# Test the init_array hypothesis: init_module() calls every init_array entry as a function. If one
# is not a function start, the call lands mid-function -- exactly the "sdk+30 (_init+c)" fault.
# Log each entry with its offset BEFORE calling it.
set -uo pipefail
P="$HOME/sp2port"
M="$P/runtime/src/main.cpp"

echo "=== the current init_module ==="
grep -n -A6 'static void init_module' "$M"

python3 - "$M" <<'PY'
import sys
p = sys.argv[1]
s = open(p).read()
old = '        for (size_t k = 0; k < m.init_count; k++) call_preserving(c, m.base + m.init_array[k]);'
new = '''        // PATCHED: log each entry BEFORE calling it. A bad init_array entry shows up here as an
        // offset that is not a function start, which is the "sdk+30 (_init+c)" fault signature.
        for (size_t k = 0; k < m.init_count; k++) {
            log("%s init[%zu] +0x%llx -> %s", m.name, k,
                (unsigned long long)m.init_array[k], describe(m.base + m.init_array[k]).c_str());
            call_preserving(c, m.base + m.init_array[k]);
        }'''
if old not in s:
    print("ANCHOR NOT FOUND", file=sys.stderr)
    sys.exit(1)
s = s.replace(old, new)
open(p, "w").write(s)
print("patched init_module with logging")
PY

echo
echo "=== rebuild main.o and relink ==="
cd "$P" || exit 1
g++ -std=c++20 -c -O1 -w -I runtime/include -I runtime/src runtime/src/main.cpp \
    -o obj-all/_runtime/main.o 2>mi.txt || { head -8 mi.txt; exit 1; }
GEN=$(find obj-all -name '*.o' | grep -v _runtime | tr '\n' ' ')
RTO=$(ls obj-all/_runtime/*.o | tr '\n' ' ')
g++ -o sp2 $GEN $RTO -lm -lc -lgcc -lpthread -ldl 2>ml.txt || { head -8 ml.txt; exit 1; }
echo "  linked: $(du -h sp2 | cut -f1)"

echo
echo "=== RUN: the init_array entries ==="
timeout 60 ./sp2 2>&1 | head -70
