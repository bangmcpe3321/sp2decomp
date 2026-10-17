#!/usr/bin/env bash
# CONFIRMED: nn::init::InitializeAllocator (main+0xdda018) is NEVER CALLED -- no log line appeared.
# So every operator new in main's static init returns null, and nn::nex::WaterMark's constructor
# receives this == NULL. That is the whole fault.
#
# In the real system, SDK startup calls InitializeAllocator(buffer, size) before any static
# constructor runs. This port skips that, so install the allocator ourselves over a host buffer
# BEFORE main's constructors, which is what the SDK would do.
set -uo pipefail
P="$HOME/sp2port"
M="$P/runtime/src/main.cpp"

python3 - "$M" <<'PY'
import sys
p = sys.argv[1]
s = open(p).read()
if 'install_game_allocator' in s:
    print("already patched"); sys.exit(0)

helper = '''
// The game's allocator. CONFIRMED (round 9): nn::init::InitializeAllocator is never called by any
// path this port takes, so every `operator new` in main's static init returns null and
// nn::nex::WaterMark is constructed on a null `this`. The real SDK calls it during start-up before
// any static constructor; do the same here over a host buffer.
static void install_game_allocator(CPU& c) {
    uint64_t off = 0;
    if (!find_func_offset(nx_module_main, "_ZN2nn4init19InitializeAllocatorEPvm", off)) {
        log("InitializeAllocator symbol not found -- allocator NOT installed");
        return;
    }
    constexpr size_t kAllocSize = 64ull << 20;   // 64 MB of host memory for the game's heap
    void* buf = plat::reserve ? nullptr : nullptr; // keep the call explicit below instead
    buf = static_cast<void*>(::operator new(kAllocSize, std::nothrow));
    if (!buf) { log("could not allocate %zu bytes for the game heap", kAllocSize); return; }
    c.x[0] = reinterpret_cast<uint64_t>(buf);
    c.x[1] = kAllocSize;
    log("installing game allocator: buf=%p size=0x%zx via %s", buf, kAllocSize,
        describe(nx_module_main.base + off).c_str());
    call_preserving(c, nx_module_main.base + off);
    log("game allocator installed");
}

static void nn_main(CPU& c) {'''

s = s.replace('static void nn_main(CPU& c) {', helper, 1)

# Install it BEFORE main's constructors run.
s = s.replace('''static void nn_main(CPU& c) {
    init_module(c, nx_module_sdk);
    init_module(c, nx_module_main);''',
'''static void nn_main(CPU& c) {
    init_module(c, nx_module_sdk);
    install_game_allocator(c);   // PATCHED: the SDK would have done this before any static ctor
    init_module(c, nx_module_main);''', 1)

open(p, "w").write(s)
print("patched: install_game_allocator before main's constructors")
PY

echo
echo "=== add <new> for nothrow if absent ==="
grep -q '#include <new>' "$M" || sed -i 's|#include <string>|#include <new>\n#include <string>|' "$M"
grep -n '#include <new>' "$M" | head -2

echo
echo "=== rebuild + run ==="
cd "$P" || exit 1
g++ -std=c++20 -c -O1 -w -I runtime/include -I runtime/src runtime/src/main.cpp \
    -o obj-all/_runtime/main.o 2>a10.txt || { head -14 a10.txt; exit 1; }
GEN=$(find "$P/obj-all" -name '*.o' | grep -v _runtime | tr '\n' ' ')
RTO=$(ls "$P"/obj-all/_runtime/*.o | tr '\n' ' ')
g++ -o "$P/sp2" $GEN $RTO -lm -lc -lgcc -lpthread -ldl 2>a10l.txt || { head -8 a10l.txt; exit 1; }
echo "  linked: $(du -h "$P/sp2" | cut -f1)"
echo
timeout 120 "$P/sp2" 2>&1 | grep -vE '^  UNRESOLVED|^    #|^  x[0-9]' | tail -26
