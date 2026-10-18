#!/usr/bin/env bash
# Round 17: two diagnostics:
#  (a) crash report walks the guest x29 chain (guest addresses are host addresses here) -- shows the
#      REAL caller of waitStartDisplayLoop_, which no direct `bl` anywhere accounts for;
#  (b) nvn trace stubs log their first return value (nvnDeviceInitialize returning false would make
#      initializeGraphicsSystem return before Graphics::initialize and leave Graphics::sInstance null).
set -uo pipefail
P="$HOME/sp2port"
cd "$P" || exit 1

python3 - "$P/runtime/src/platform_linux.cpp" "$P/runtime/src/nvn/nvn_trace.cpp" <<'PY'
import sys

# ---- platform_linux.cpp: guest frame walk ----
p = sys.argv[1]
s = open(p).read()
if 'guest frames:' in s:
    print('frame walk: already present')
else:
    anchor = "    // Host backtrace: the fault happened in recompiled code, so these frames are generated C++."
    assert anchor in s, 'anchor not found'
    walk = '''    // Guest frames: guest addresses ARE host addresses in this port, so the saved-frame chain can be read
    // directly -- [fp] = caller's fp, [fp+8] = caller's lr -- which names the callers of the faulting code.
    nx::plat::log_line("  guest frames:");
    uint64_t fp = c.x[29];
    for (int k = 0; k < 24; ++k) {
        if (fp < 0x5000000000ull || fp >= 0x7300000000ull || (fp & 7) != 0) break;
        uint64_t next = *reinterpret_cast<const uint64_t*>(fp);
        uint64_t lr = *reinterpret_cast<const uint64_t*>(fp + 8);
        if (lr < 0x7100000000ull || lr >= 0x7250000000ull) break;
        std::snprintf(buf, sizeof buf, "    #%-2d 0x%llx %s", k, (unsigned long long)lr, nx::describe(lr).c_str());
        nx::plat::log_line(buf);
        fp = next;
    }

'''
    s = s.replace(anchor, walk + anchor, 1)
    open(p, 'w').write(s)
    print('frame walk: added')

# ---- nvn_trace.cpp: stub first-call log carries the return value ----
p = sys.argv[2]
s = open(p).read()
old = '''    if (n == 1) log("nvn: first call of %s (lr %s)", name, describe(c.x[30]).c_str());
    // Initialize functions return NVNboolean: false would make the engine give up at the first object.
    c.x[0] = std::strstr(name, "Initialize") ? 1 : 0;'''
new = '''    // Initialize functions return NVNboolean: false would make the engine give up at the first object.
    c.x[0] = std::strstr(name, "Initialize") ? 1 : 0;
    if (n == 1) log("nvn: first call of %s (lr %s) -> %llu", name, describe(c.x[30]).c_str(),
                    (unsigned long long)c.x[0]);'''
if old in s:
    s = s.replace(old, new, 1)
    open(p, 'w').write(s)
    print('stub log: patched')
elif '-> %llu", name' in s:
    print('stub log: already patched')
else:
    print('stub log: anchor NOT found -- check manually')
PY

echo
echo "=== rebuild + relink ==="
g++ -std=c++20 -c -O1 -w -I runtime/include -I runtime/src -I "$HOME/vkheaders/include" \
    runtime/src/platform_linux.cpp -o obj-all/_runtime/platform_linux.o 2> pl.err || { head -15 pl.err; exit 1; }
g++ -std=c++20 -c -O1 -w -I runtime/include -I runtime/src -I "$HOME/vkheaders/include" \
    runtime/src/nvn/nvn_trace.cpp -o obj-all/_runtime/nvn_trace.o 2> nt.err || { head -15 nt.err; exit 1; }
GEN=$(find "$P/obj-all" -name '*.o' | grep -v _runtime | tr '\n' ' ')
RTO=$(find "$P/obj-all/_runtime" -name '*.o' | tr '\n' ' ')
g++ -o "$P/sp2.new" $GEN $RTO -lm -lc -lgcc -lpthread -ldl 2> link3.txt || { echo LINK FAILED; head -15 link3.txt; exit 1; }
mv -f "$P/sp2.new" "$P/sp2"
echo "  linked: $(du -h "$P/sp2" | cut -f1)"

echo
echo "=== run ==="
VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/lvp_icd.json NX_HEADLESS=1 timeout 300 "$P/sp2" > "$P/walk.log" 2>&1
echo "  exit: $?"
echo
echo "=== crash report ==="
sed -n '/=== HOST/,$p' "$P/walk.log" | head -60
echo
echo "=== nvn lines ==="
grep -nE 'nvn' "$P/walk.log" | head -20
