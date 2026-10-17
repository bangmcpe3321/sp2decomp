#!/usr/bin/env bash
# Test the null-new hypothesis directly: was nn::init::InitializeAllocator ever CALLED before the
# nn::nex::WaterMark crash? It is at main+0xdda018 (_ZN2nn4init19InitializeAllocatorEPvm, 80 bytes).
# Hook call()/call_preserving so every call to that address is logged.
set -uo pipefail
P="$HOME/sp2port"
L="$P/runtime/src/loader.cpp"
M="$P/runtime/src/main.cpp"

echo "=== where is call_preserving defined? ==="
grep -rn 'call_preserving' "$M" | head -4
grep -rn 'void call_preserving' "$P/runtime/src"/*.cpp | head -3

echo
echo "=== patch: log any call to InitializeAllocator ==="
python3 - "$M" <<'PY'
import sys
p = sys.argv[1]
s = open(p).read()

# Find the call_preserving definition and add a targeted log.
import re
m = re.search(r'static\s+void\s+call_preserving\s*\([^)]*\)\s*\{', s)
if not m:
    print("call_preserving NOT FOUND", file=sys.stderr); sys.exit(1)

inject = m.group(0) + '''
    // DIAGNOSTIC (round 9): the null-`this` in nn::nex::WaterMark means operator new returned null.
    // nn::init::InitializeAllocator(main+0xdda018) is what installs the game's allocator; log every
    // call to it so "was the allocator ever set up?" stops being a guess.
    if (target == nx_module_main.base + 0xdda018ull) {
        log("*** nn::init::InitializeAllocator CALLED (buf=0x%llx size=0x%llx)",
            (unsigned long long)c.x[0], (unsigned long long)c.x[1]);
    }'''
if 'target == nx_module_main.base' in s:
    print("already patched"); sys.exit(0)
s = s[:m.start()] + inject + s[m.end():]
open(p, "w").write(s)
print("patched call_preserving with an InitializeAllocator log")
PY

echo
echo "=== rebuild + run, filtering for the allocator ==="
cd "$P" || exit 1
g++ -std=c++20 -c -O1 -w -I runtime/include -I runtime/src runtime/src/main.cpp \
    -o obj-all/_runtime/main.o 2>a9.txt || { head -12 a9.txt; exit 1; }
GEN=$(find "$P/obj-all" -name '*.o' | grep -v _runtime | tr '\n' ' ')
RTO=$(ls "$P"/obj-all/_runtime/*.o | tr '\n' ' ')
g++ -o "$P/sp2" $GEN $RTO -lm -lc -lgcc -lpthread -ldl 2>a9l.txt || { head -8 a9l.txt; exit 1; }
echo "  linked: $(du -h "$P/sp2" | cut -f1)"
echo
timeout 120 "$P/sp2" 2>&1 | grep -E 'InitializeAllocator|WaterMark|constructors|_init at|SIGSEGV|fault address|guest lr' | head -18
