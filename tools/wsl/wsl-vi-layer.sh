#!/usr/bin/env bash
# Round 14b: hle_vi.cpp handed the game UNMAPPED sentinel pointers (kKernelBase-0x1000 / -0x2000) as the
# Display and Layer objects, on the assumption they are "opaque pointers, never dereferenced by the game".
# The engine does dereference them: nn::vi::GetLayerIdWithValidation (real subsdk1 code at 71c000b208)
# executes `ldr x19, [layer, #0x20]` -> SIGSEGV at 0x69ffffe020 (= kFakeLayer + 0x20).
# Fix: real, zeroed, writable guest memory (kernel region) for both objects; log the caller of CreateLayer.
set -uo pipefail
P="$HOME/sp2port"

python3 - "$P/runtime/src/hle_vi.cpp" <<'PY'
import sys
p = sys.argv[1]
s = open(p).read()

old = '''constexpr uint64_t kFakeDisplay = kKernelBase - 0x1000;  // opaque pointers, never dereferenced by the game
constexpr uint64_t kFakeLayer = kKernelBase - 0x2000;
'''
new = '''// The game DOES read fields of these objects: nn::vi::GetLayerIdWithValidation (real subsdk1 code)
// executes `ldr x19, [layer, #0x20]`, and SDK display code reads display fields too. Hand out real,
// zeroed, writable guest memory (kernel region) -- never an unmapped sentinel; a sentinel is exactly
// what faulted at 0x69ffffe020 (kFakeLayer + 0x20) before this fix.
uint64_t fake_display() {
    static uint64_t p = 0;
    if (!p) p = kernel_alloc(0x1000);
    return p;
}
uint64_t fake_layer() {
    static uint64_t p = 0;
    if (!p) p = kernel_alloc(0x1000);
    return p;
}
'''
if old not in s:
    print("!!! constants pattern not found")
else:
    s = s.replace(old, new)
    print("constants -> kernel_alloc'd pages")
n = s.count("kFakeDisplay")
s = s.replace("st<uint64_t>(c.x[0], kFakeDisplay);", "st<uint64_t>(c.x[0], fake_display());")
s = s.replace("st<uint64_t>(c.x[0], kFakeLayer);", "st<uint64_t>(c.x[0], fake_layer());")
print("usages replaced:", n + s.count("kFakeLayer") == 0)
s = s.replace('log("vi: layer created -> native window %p", w);',
              'log("vi: layer created -> native window %p (from %s)", w, describe(c.x[30]).c_str());')
open(p, "w").write(s)
PY

echo
echo "=== rebuild + run ==="
cd "$P" || exit 1
g++ -std=c++20 -c -O1 -w -I runtime/include -I runtime/src runtime/src/hle_vi.cpp \
    -o obj-all/_runtime/hle_vi.o 2>vi.txt || { echo "COMPILE FAILED"; head -30 vi.txt; exit 1; }
GEN=$(find "$P/obj-all" -name '*.o' | grep -v _runtime | tr '\n' ' ')
RTO=$(ls "$P"/obj-all/_runtime/*.o | tr '\n' ' ')
g++ -o "$P/sp2" $GEN $RTO -lm -lc -lgcc -lpthread -ldl 2>vil.txt || { head -20 vil.txt; exit 1; }
echo "  linked: $(du -h "$P/sp2" | cut -f1)"
echo
timeout 300 "$P/sp2" > "$P/vi.log" 2>&1
echo "  exit: $?"
echo
echo "=== signal ==="
grep -nE 'vi:|layer|SIGSEGV|fault address|guest lr|missing import|assert|Assert|abort|entering nnMain' "$P/vi.log" | head -50
echo "=== tail ==="
tail -40 "$P/vi.log"
