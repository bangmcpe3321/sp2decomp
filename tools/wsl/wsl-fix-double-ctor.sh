#!/usr/bin/env bash
# ROOT CAUSE FOUND.
#   WRITE #1  main_00D2F404 sets node->m_pNext = 0   via  init_module -> main_00000024 -> main_00D1A3E8
#   WRITE #2  SetNext sets node->m_pNext = 0x7103650210  (pass 1, normal chain)
#   WRITE #3  main_00D2F404 sets node->m_pNext = 0   via  init_module -> main_00D1A3E8   (NO main_00000024!)
#   WRITE #4  SetNext sets node->m_pNext = 0x710304fb90   <== THE SELF-LINK
#
# main_00000024 IS `_init` (offset 0x24, the same offset `init_module` uses for `_init`).
# `_init` RUNS THE CONSTRUCTOR TABLE ITSELF.
# init_module then ALSO loops over init_array and calls every constructor AGAIN.
# => CONSTRUCTORS RUN TWICE => the PGV base ctor resets m_pNext to 0 (WRITE #3), then AddVariable
#    finds the node as the tail and self-links it (WRITE #4).
#
# FIX: run the constructors ONCE. Keep `_init` (it runs them), drop the init_array loop.
set -uo pipefail
P="$HOME/sp2port"
M="$P/runtime/src/main.cpp"

python3 - "$M" <<'PY'
import sys, re
p = sys.argv[1]
s = open(p).read()
if 'ROUND-FIX' in s:
    print("already patched"); sys.exit(0)

# Disable the init_array loop: _init already ran every constructor.
old = '''    if (status != 0)
        // PATCHED: log each entry BEFORE calling it.'''
new = '''    // ROUND-FIX: `_init` (main+0x24 / sdk+0x24) ALREADY RUNS THE CONSTRUCTOR TABLE. The loop below
    // called every constructor a SECOND time, which is what produced the duplicate PGV registration,
    // the reset of m_pNext to 0, and finally the self-link that hangs AddVariable.
    // Evidence: a write watchpoint on node+8 showed the same constructor reached twice -- once through
    // `main_00000024` (= `_init`) and once directly from init_array.
    if (getenv("NX_DOUBLE_CTOR") != nullptr && status != 0)
        // PATCHED: log each entry BEFORE calling it.'''
if old not in s:
    print("ANCHOR NOT FOUND", file=sys.stderr); sys.exit(1)
s = s.replace(old, new, 1)
open(p, "w").write(s)
print("patched: init_array loop disabled (_init already ran the constructors)")
PY

echo
echo "=== rebuild + run ==="
cd "$P" || exit 1
g++ -std=c++20 -c -O1 -w -I runtime/include -I runtime/src runtime/src/main.cpp \
    -o obj-all/_runtime/main.o 2>f1.txt || { head -12 f1.txt; exit 1; }
GEN=$(find "$P/obj-all" -name '*.o' | grep -v _runtime | tr '\n' ' ')
RTO=$(ls "$P"/obj-all/_runtime/*.o | tr '\n' ' ')
g++ -o "$P/sp2" $GEN $RTO -lm -lc -lgcc -lpthread -ldl 2>f1l.txt || { head -8 f1l.txt; exit 1; }
echo "  linked: $(du -h "$P/sp2" | cut -f1)"
echo
timeout 240 "$P/sp2" > /tmp/f1.txt 2>&1
echo "  exit: $? (124 = still running)"
echo "  main constructors logged: $(grep -c 'main init\[' /tmp/f1.txt)"
echo
echo "=== last 14 lines ==="
grep -vE '^  UNRESOLVED' /tmp/f1.txt | tail -14
