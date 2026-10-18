#!/usr/bin/env bash
# Round 14d: the FOUR subsdk modules have constructor tables too (subsdk0: 23 entries -- the NVN driver's
# statics). The port only ran sdk + main _init, so the driver's NvOs mutex at [0x718019fe68] was never
# created and the first driver operation locked it (NvOsMutexLock(null) -> fault addr 0x1, subsdk0+30eb0).
# Run every module's _init in dependency order: sdk -> subsdk0..3 -> main.
set -uo pipefail
P="$HOME/sp2port"

python3 - "$P/runtime/src/main.cpp" <<'PY'
import sys
p = sys.argv[1]
s = open(p).read()
anchor = "    init_module(c, nx_module_main);\n    game::after_init();"
add = """    // PATCHED (round 14d): the FOUR subsdk modules have constructor tables too (subsdk0: 23 entries -- the
    // NVN driver's statics). The console loader runs every module's _init before nnMain; this port ran only
    // sdk and main, so subsdk0's driver state was never constructed and the first driver call locked an
    // uninitialised NvOs mutex at [0x718019fe68] (NvOsMutexLock(null), fault addr 0x1). Run them after the
    // allocator exists (nninitStartup) and before main's 1604 statics, in dependency order.
    init_module(c, nx_module_subsdk0);
    init_module(c, nx_module_subsdk1);
    init_module(c, nx_module_subsdk2);
    init_module(c, nx_module_subsdk3);
    init_module(c, nx_module_main);
    game::after_init();"""
if 'init_module(c, nx_module_subsdk0);' in s:
    print('already patched')
else:
    assert anchor in s, 'anchor not found'
    s = s.replace(anchor, add, 1)
    print('subsdk0..3 init_module calls added')
open(p, 'w').write(s)
PY

echo
echo "=== rebuild + run ==="
cd "$P" || exit 1
g++ -std=c++20 -c -O1 -w -I runtime/include -I runtime/src runtime/src/main.cpp \
    -o obj-all/_runtime/main.o 2>sub.txt || { echo "COMPILE FAILED"; head -30 sub.txt; exit 1; }
GEN=$(find "$P/obj-all" -name '*.o' | grep -v _runtime | tr '\n' ' ')
RTO=$(ls "$P"/obj-all/_runtime/*.o | tr '\n' ' ')
g++ -o "$P/sp2" $GEN $RTO -lm -lc -lgcc -lpthread -ldl 2>subl.txt || { head -20 subl.txt; exit 1; }
echo "  linked: $(du -h "$P/sp2" | cut -f1)"
echo
timeout 300 "$P/sp2" > "$P/sub.log" 2>&1
echo "  exit: $?"
echo
echo "=== signal ==="
grep -nE 'constructors|_init at|fault address|guest lr|missing import|vi:|SIGSEGV|SIGILL|SIGABRT|assert' "$P/sub.log" | head -60
echo "=== tail ==="
tail -40 "$P/sub.log"
