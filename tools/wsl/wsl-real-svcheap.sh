#!/usr/bin/env bash
# NEXT: sead::ExpHeap::tryCreate +0x44 faults at 0x88. Hypothesis: the kernel's heap bookkeeping
# (g_heap_size, vm_set) was never established -- we only did a manual plat::commit. On hardware the SDK
# startup calls svcSetHeapSize FIRST and then InitializeAllocator with what the kernel returned.
# Use the runtime's OWN svc dispatcher (kernel.cpp case 0x01) so the model matches hardware exactly.
set -uo pipefail
P="$HOME/sp2port"
M="$P/runtime/src/main.cpp"

python3 - "$M" <<'PY'
import sys, re
p = sys.argv[1]
s = open(p).read()
if 'svc(c, 0x01' in s:
    print("already patched"); sys.exit(0)

m = re.search(r'    constexpr size_t kAllocSize = .*?\n    if \(!plat::commit\(heap, kAllocSize\)\) \{.*?\n    \}\n', s, re.S)
if not m:
    print("ANCHOR NOT FOUND", file=sys.stderr); sys.exit(1)

new = '''    constexpr size_t kAllocSize = 512ull << 20;
    // ROUND: use the runtime's REAL SVC 0x01 (SetHeapSize) so the kernel's bookkeeping -- g_heap_size,
    // vm_set, the memory map -- is established exactly as on hardware, instead of a bare plat::commit.
    // kernel.cpp case 0x01 commits at kHeapBase, enforces kHeapMax, and returns kHeapBase in x1.
    c.x[1] = kAllocSize;
    svc(c, 0x01, 0);
    uint64_t heap = c.x[1];
    if (heap == 0) {
        log("svcSetHeapSize did not return a heap base -- allocator NOT installed");
        return;
    }
'''
s = s[:m.start()] + new + s[m.end():]
open(p, "w").write(s)
print("patched: heap now comes from the real svcSetHeapSize path")
PY

echo
echo "=== rebuild + run ==="
cd "$P" || exit 1
g++ -std=c++20 -c -O1 -w -I runtime/include -I runtime/src runtime/src/main.cpp \
    -o obj-all/_runtime/main.o 2>g1.txt || { head -12 g1.txt; exit 1; }
GEN=$(find "$P/obj-all" -name '*.o' | grep -v _runtime | tr '\n' ' ')
RTO=$(ls "$P"/obj-all/_runtime/*.o | tr '\n' ' ')
g++ -o "$P/sp2" $GEN $RTO -lm -lc -lgcc -lpthread -ldl 2>g1l.txt || { head -8 g1l.txt; exit 1; }
echo "  linked: $(du -h "$P/sp2" | cut -f1)"
echo
timeout 240 "$P/sp2" > /tmp/g1.txt 2>&1
echo "  exit: $? (124 = still running)"
echo "  main constructors: $(grep -c 'main init\[' /tmp/g1.txt)"
echo
grep -E 'HOST SIGSEGV|fault address|guest lr|_init at|init_status|allocator|nnosInitialize returned|FATAL' /tmp/g1.txt | head -12
