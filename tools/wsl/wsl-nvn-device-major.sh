#!/usr/bin/env bash
# Round 18: nvnDeviceGetInteger(0) must be 53 (0x35) for Splatoon 2 -- its check at main+e67590 is
# `== 0x35`; the port's table carried 0x37 for the runtime's original game (Wonder). With 0x37 the check
# failed, initializeGraphicsSystem returned at its epilogue (main+e67cb0) before Graphics::initialize, and
# GameFrameworkNx::runImpl_ then called waitStartDisplayLoop_ on a null Graphics::sInstance.
set -uo pipefail
P="$HOME/sp2port"
cd "$P" || exit 1

python3 - "$P/runtime/src/nvn/nvn_device.cpp" <<'PY'
import sys
p = sys.argv[1]
s = open(p).read()
if '{0, 0x35}' in s:
    print('already patched')
    raise SystemExit
old = '''    {0, 0x37},'''
new = '''    {0, 0x35},  // 53: Splatoon 2 checks == 0x35 (main+e67590); Wonder wanted 0x37'''
assert old in s, 'anchor not found'
s = s.replace(old, new, 1)
# refresh the header comment to name both checks
old2 = "// minor >= 15 (main+5a7b48). The \"provisional\" ones are fields the real nvnDeviceInitialize fills in its device"
new2 = "// minor >= 15 (main+5a7b48); Splatoon 2 wants major == 53 and minor >= 5 (main+e6758c). The \"provisional\"\n// ones are fields the real nvnDeviceInitialize fills in its device"
if old2 in s:
    s = s.replace(old2, new2, 1)
open(p, 'w').write(s)
print('nvn_device.cpp patched: major 0x37 -> 0x35')
PY

echo
echo "=== rebuild + relink ==="
g++ -std=c++20 -c -O1 -w -I runtime/include -I runtime/src -I "$HOME/vkheaders/include" \
    runtime/src/nvn/nvn_device.cpp -o obj-all/_runtime/nvn_device.o 2> nd.err || { head -15 nd.err; exit 1; }
GEN=$(find "$P/obj-all" -name '*.o' | grep -v _runtime | tr '\n' ' ')
RTO=$(find "$P/obj-all/_runtime" -name '*.o' | tr '\n' ' ')
g++ -o "$P/sp2.new" $GEN $RTO -lm -lc -lgcc -lpthread -ldl 2> link4.txt || { echo LINK FAILED; head -15 link4.txt; exit 1; }
mv -f "$P/sp2.new" "$P/sp2"
echo "  linked: $(du -h "$P/sp2" | cut -f1)"

echo
echo "=== run ==="
VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/lvp_icd.json NX_HEADLESS=1 timeout 300 "$P/sp2" > "$P/dev.log" 2>&1
echo "  exit: $?"

echo
echo "=== crash? ==="
if grep -q '=== HOST\|FATAL' "$P/dev.log"; then
    sed -n '/=== HOST/,$p' "$P/dev.log" | head -45
    echo "..."
    grep -n 'FATAL' "$P/dev.log" | head -3
else
    echo "  none"
fi

echo
echo "=== nvn / signal lines ==="
grep -nE 'nvn|vi:|missing import|fault' "$P/dev.log" | head -40
echo
echo "=== tail ==="
tail -15 "$P/dev.log"
