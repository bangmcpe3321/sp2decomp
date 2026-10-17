#!/usr/bin/env bash
# PRINCIPLED FIX. On hardware:
#   SDK startup -> svcSetHeapSize(size) -> returns kHeapBase (GUEST address space)
#              -> nn::init::InitializeAllocator(kHeapBase, size)
# Our port skips the SDK startup, so svcSetHeapSize is never called (confirmed: 0 calls), and we handed
# the game a HOST malloc address (0x798ca0e62010) -- far outside the guest's 0x71xxxxxxx space.
# Any guest code that assumes pointers are in-range will misbehave.
# Fix: place the heap at nx::kHeapBase in GUEST space, exactly as the kernel would.
set -uo pipefail
P="$HOME/sp2port"
M="$P/runtime/src/main.cpp"

python3 - "$M" <<'PY'
import sys, re
p = sys.argv[1]
s = open(p).read()

# Replace the body of install_game_allocator with a guest-space heap.
m = re.search(r'static void install_game_allocator\(CPU& c\) \{.*?\n\}\n', s, re.S)
if not m:
    print("install_game_allocator NOT FOUND", file=sys.stderr); sys.exit(1)

new = '''static void install_game_allocator(CPU& c) {
    uint64_t off = 0;
    if (!find_func_offset(nx_module_main, "_ZN2nn4init19InitializeAllocatorEPvm", off)) {
        log("InitializeAllocator symbol not found -- allocator NOT installed");
        return;
    }
    // On hardware the kernel's svcSetHeapSize hands the app a heap at kHeapBase, INSIDE the guest
    // address space. This port skips the SDK startup that calls it (verified: zero svc 0x01 calls),
    // and previously installed the allocator over a HOST malloc address -- far outside the guest's
    // 0x71xxxxxxx range. Guest code that assumes in-range pointers would misbehave with that.
    constexpr size_t kAllocSize = 512ull << 20;
    uint64_t heap = nx::kHeapBase;
    if (!plat::commit(heap, kAllocSize)) {
        log("could not commit the game heap at %s", describe(heap).c_str());
        return;
    }
    c.x[0] = heap;
    c.x[1] = kAllocSize;
    log("installing game allocator at kHeapBase: 0x%llx size 0x%zx (guest space) via %s",
        (unsigned long long)heap, kAllocSize, describe(nx_module_main.base + off).c_str());
    call_preserving(c, nx_module_main.base + off);
    log("game allocator installed");
}
'''
s = s[:m.start()] + new + s[m.end():]
open(p, "w").write(s)
print("patched: heap moved into guest address space at kHeapBase")
PY

echo
echo "=== rebuild + run ==="
cd "$P" || exit 1
g++ -std=c++20 -c -O1 -w -I runtime/include -I runtime/src runtime/src/main.cpp \
    -o obj-all/_runtime/main.o 2>h1.txt || { head -12 h1.txt; exit 1; }
GEN=$(find "$P/obj-all" -name '*.o' | grep -v _runtime | tr '\n' ' ')
RTO=$(ls "$P"/obj-all/_runtime/*.o | tr '\n' ' ')
g++ -o "$P/sp2" $GEN $RTO -lm -lc -lgcc -lpthread -ldl 2>h1l.txt || { head -8 h1l.txt; exit 1; }
echo "  linked: $(du -h "$P/sp2" | cut -f1)"
echo
timeout 180 "$P/sp2" > /tmp/h1.txt 2>&1
echo "  exit: $? (124 = still running)"
echo "  main constructors: $(grep -c 'main init\[' /tmp/h1.txt)"
echo "  last ctor:"; grep 'main init\[' /tmp/h1.txt | tail -1 | cut -c1-130
echo "  allocator:"; grep -E 'installing game allocator|allocator installed' /tmp/h1.txt | head -2
echo "  faults/hang:"; grep -E 'SIGSEGV|fault address|guest lr|nnosInitialize returned' /tmp/h1.txt | head -4
