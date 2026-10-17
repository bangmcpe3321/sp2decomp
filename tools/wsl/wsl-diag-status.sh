#!/usr/bin/env bash
# Test both round-7 candidates at once:
#   (a) why does init_module report "sdk constructors: 0"?  -> log the status word and init_count
#   (b) is the game's allocator installed?                  -> nn::init::GetAllocator / the game's new
set -uo pipefail
P="$HOME/sp2port"
M="$P/runtime/src/main.cpp"

python3 - "$M" <<'PY'
import sys
p = sys.argv[1]
s = open(p).read()

old = '''    uint32_t status = ld<uint32_t>(init_status_addr(m));'''
new = '''    uint32_t status = ld<uint32_t>(init_status_addr(m));
    // DIAGNOSTIC (round 8): why does sdk report zero constructors? Log the status word, its address
    // and the declared init_count so "status != 1" can be told apart from "init_count == 0".
    log("  %s: init_status @ %s = %u, init_count = %zu", m.name,
        describe(init_status_addr(m)).c_str(), status, m.init_count);'''
if old not in s:
    print("ANCHOR A NOT FOUND", file=sys.stderr); sys.exit(1)
s = s.replace(old, new, 1)
open(p, "w").write(s)
print("patched: status/init_count diagnostic")
PY

echo
echo "=== also: did the game's allocator get installed before the WaterMark ctor? ==="
grep -n 'InitializeAllocator\|GetAllocator' "$M" 2>/dev/null | head -4 || echo "  (not referenced in main.cpp)"

echo
echo "=== rebuild + run ==="
cd "$P" || exit 1
g++ -std=c++20 -c -O1 -w -I runtime/include -I runtime/src runtime/src/main.cpp \
    -o obj-all/_runtime/main.o 2>d8.txt || { head -10 d8.txt; exit 1; }
GEN=$(find "$P/obj-all" -name '*.o' | grep -v _runtime | tr '\n' ' ')
RTO=$(ls "$P"/obj-all/_runtime/*.o | tr '\n' ' ')
g++ -o "$P/sp2" $GEN $RTO -lm -lc -lgcc -lpthread -ldl 2>d8l.txt || { head -8 d8l.txt; exit 1; }
echo "  linked: $(du -h "$P/sp2" | cut -f1)"
echo
timeout 90 "$P/sp2" 2>&1 | grep -vE '^  UNRESOLVED|^    #' | head -34
