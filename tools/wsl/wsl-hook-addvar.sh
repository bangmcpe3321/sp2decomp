#!/usr/bin/env bash
# Prove or kill the duplicate-registration hypothesis: log every AddVariable(node) call with the node
# address AND the current list head. A repeated node address == duplicate == hypothesis PROVEN.
set -uo pipefail
P="$HOME/sp2port"
M="$P/runtime/src/main.cpp"

python3 - "$M" <<'PY'
import sys
p = sys.argv[1]
s = open(p).read()
if 'AddVariable[' in s:
    print("already patched"); sys.exit(0)

old = '''    if (target == nx_module_main.base + 0xdda018ull) {'''
new = '''    // DIAGNOSTIC (round 4/12): AddVariable(main+0xd2f0f4) is the spin. Log each call's node argument
    // (x1) and the current list head (main+0x2fc7520) so a repeated node proves duplicate registration.
    if (target == nx_module_main.base + 0xd2f0f4ull) {
        static int an = 0;
        static uint64_t seen[64]; static int nseen = 0;
        uint64_t node = c.x[1];
        uint64_t head = ld<uint64_t>(nx_module_main.base + 0x2fc7520ull);
        bool dup = false;
        for (int k = 0; k < nseen; ++k) if (seen[k] == node) dup = true;
        if (nseen < 64) seen[nseen++] = node;
        log("AddVariable[%d] node=0x%llx head=0x%llx%s", an++, (unsigned long long)node,
            (unsigned long long)head, dup ? "  <<< DUPLICATE NODE" : "");
    }
    if (target == nx_module_main.base + 0xdda018ull) {'''
if old not in s:
    print("ANCHOR NOT FOUND", file=sys.stderr); sys.exit(1)
s = s.replace(old, new, 1)
open(p, "w").write(s)
print("patched: AddVariable logging")
PY

echo
echo "=== rebuild + run ==="
cd "$P" || exit 1
g++ -std=c++20 -c -O1 -w -I runtime/include -I runtime/src runtime/src/main.cpp \
    -o obj-all/_runtime/main.o 2>d4.txt || { head -12 d4.txt; exit 1; }
GEN=$(find "$P/obj-all" -name '*.o' | grep -v _runtime | tr '\n' ' ')
RTO=$(ls "$P"/obj-all/_runtime/*.o | tr '\n' ' ')
g++ -o "$P/sp2" $GEN $RTO -lm -lc -lgcc -lpthread -ldl 2>d4l.txt || { head -8 d4l.txt; exit 1; }
echo "  linked: $(du -h "$P/sp2" | cut -f1)"
echo
timeout 120 "$P/sp2" 2>&1 | grep -E 'AddVariable\[|allocator installed|main init\[136[0-9]\]|SIGSEGV' | head -40
