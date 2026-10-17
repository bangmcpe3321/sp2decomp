#!/usr/bin/env bash
# DIAGNOSTIC: call sead::HeapMgr::initialize(size) from the port with a NON-ZERO size, just before the
# real nnMain. If the ExpHeap fault clears, the reading is confirmed and what remains is "supply the right
# number". If it persists, the framework path is wrong in more than that one argument.
set -uo pipefail
P="$HOME/sp2port"
M="$P/runtime/src/main.cpp"

python3 - "$M" <<'PY'
import sys
p = sys.argv[1]
s = open(p).read()
if 'HeapMgr::initialize' in s:
    print("already patched"); sys.exit(0)

old = '    game::after_init();\n    log("entering nnMain");'
new = '''    game::after_init();
    // DIAGNOSTIC: sead::Framework::initialize calls HeapMgr::initialize(0) because the InitializeArg it
    // receives has both size fields zero. Call it ourselves with a real size first, and see whether the
    // ExpHeap fault clears -- that distinguishes a one-input problem from a framework-init problem.
    {
        uint64_t hm = 0;
        if (find_func_offset(nx_module_main, "_ZN4sead7HeapMgr10initializeEm", hm)) {
            constexpr uint64_t kRootHeap = 0x10000000ull;  // 256 MB of the 512 MB game heap
            c.x[0] = kRootHeap;
            log("DIAGNOSTIC: sead::HeapMgr::initialize(0x%llx) at %s",
                (unsigned long long)kRootHeap, describe(nx_module_main.base + hm).c_str());
            call_preserving(c, nx_module_main.base + hm);
            log("DIAGNOSTIC: HeapMgr::initialize returned");
        } else {
            log("DIAGNOSTIC: HeapMgr::initialize symbol not found");
        }
    }
    log("entering nnMain");'''
if old not in s:
    print("ANCHOR NOT FOUND", file=sys.stderr); sys.exit(1)
s = s.replace(old, new, 1)
open(p, "w").write(s)
print("patched: pre-call HeapMgr::initialize(0x10000000)")
PY

echo
echo "=== rebuild + run ==="
cd "$P" || exit 1
g++ -std=c++20 -c -O1 -w -I runtime/include -I runtime/src runtime/src/main.cpp \
    -o obj-all/_runtime/main.o 2>d5.txt || { head -12 d5.txt; exit 1; }
GEN=$(find "$P/obj-all" -name '*.o' | grep -v _runtime | tr '\n' ' ')
RTO=$(ls "$P"/obj-all/_runtime/*.o | tr '\n' ' ')
g++ -o "$P/sp2" $GEN $RTO -lm -lc -lgcc -lpthread -ldl 2>d5l.txt || { head -8 d5l.txt; exit 1; }
echo "  linked: $(du -h "$P/sp2" | cut -f1)"
echo
timeout 300 "$P/sp2" > /tmp/d5.txt 2>&1
echo "  exit: $?"
echo
echo "=== milestones ==="
grep -E 'DIAGNOSTIC|entering nnMain|HOST SIGSEGV|fault address|guest lr|GetInfo|GETINFO' /tmp/d5.txt | head -20
