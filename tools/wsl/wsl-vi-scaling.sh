#!/usr/bin/env bash
# Round 14c: nn::vi::SetLayerScalingMode -- the last call in sead::GameFrameworkNx::initializeGraphicsSystem
# that still landed in subsdk1's REAL vi client library. That path needs the live vi:u IPC service
# (GetService() returned an empty holder -> null deref at subsdk1+aaf4). HLE it as a no-op like its five
# neighbours (Initialize / OpenDefaultDisplay / CreateLayer / GetDisplayVsyncEvent / GetNativeWindow);
# scaling only affects presentation, not game state.
set -uo pipefail
P="$HOME/sp2port"

python3 - "$P/runtime/src/hle_vi.cpp" <<'PY'
import sys
p = sys.argv[1]
s = open(p).read()
anchor = '''void GetNativeWindow(CPU& c) {  // (void** out, Layer*)
    st<uint64_t>(c.x[0], uint64_t(plat::create_window()));
    c.x[0] = 0;
}
'''
add = anchor + '''
void SetLayerScalingMode(CPU& c) { c.x[0] = 0; }  // no-op: presentation only, the vi service is emulated at this level
'''
if 'SetLayerScalingMode' not in s:
    assert anchor in s, 'anchor not found'
    s = s.replace(anchor, add, 1)
    s = s.replace('NX_HLE("_ZN2nn2vi15GetNativeWindowEPPvPNS0_5LayerE", GetNativeWindow);',
                  'NX_HLE("_ZN2nn2vi15GetNativeWindowEPPvPNS0_5LayerE", GetNativeWindow);\n'
                  'NX_HLE("_ZN2nn2vi19SetLayerScalingModeEPNS0_5LayerENS0_11ScalingModeE", SetLayerScalingMode);', 1)
    print('SetLayerScalingMode HLE added')
else:
    print('already present')
open(p, 'w').write(s)
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
timeout 300 "$P/sp2" > "$P/vi2.log" 2>&1
echo "  exit: $?"
echo
echo "=== signal ==="
grep -nE 'vi:|fault address|guest lr|missing import|assert|Assert|abort|SIGSEGV|SIGILL|SIGBUS|SIGABRT|nvn|vulkan|Vulkan' "$P/vi2.log" | head -50
echo "=== tail ==="
tail -40 "$P/vi2.log"
