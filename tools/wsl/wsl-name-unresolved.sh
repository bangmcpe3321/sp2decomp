#!/usr/bin/env bash
set -uo pipefail
P="$HOME/sp2port"
L="$P/runtime/src/loader.cpp"

python3 - "$L" <<'PY'
import sys
p = sys.argv[1]
s = open(p).read()
old = '''            if (!target) {
                // Unresolved: functions get a logging stub; data stays null.
                if (s.type == 2 || s.type == 0) target = hle_address(s.name);
                missing++;
            }'''
new = '''            if (!target) {
                // Unresolved: functions get a logging stub; data stays null.
                if (s.type == 2 || s.type == 0) target = hle_address(s.name);
                g_exports_missing.push_back(std::string(lm.info->name) + ":" + s.name);
                missing++;
            }'''
if old not in s:
    print("ANCHOR NOT FOUND", file=sys.stderr)
    sys.exit(1)
s = s.replace(old, new)
open(p, "w").write(s)
print("patched increment site")
PY

echo "=== rebuild loader + relink ==="
cd "$P" || exit 1
g++ -std=c++20 -c -O1 -w -I runtime/include -I runtime/src runtime/src/loader.cpp \
    -o obj-all/_runtime/loader.o 2>ld.txt || { head -8 ld.txt; exit 1; }
GEN=$(find obj-all -name '*.o' | grep -v _runtime | tr '\n' ' ')
RTO=$(ls obj-all/_runtime/*.o | tr '\n' ' ')
g++ -o sp2 $GEN $RTO -lm -lc -lgcc -lpthread -ldl 2>lk.txt || { head -8 lk.txt; exit 1; }
echo "  linked: $(du -h sp2 | cut -f1)"

echo
echo "=== RUN -- the unresolved list ==="
timeout 60 ./sp2 2>&1 | head -46
