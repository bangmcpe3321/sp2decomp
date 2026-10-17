#!/usr/bin/env bash
# Two facts that reframe the bug:
#   1. 0x304fb90 is in .bss (bss starts 0x2fdb1b0), so it is ZERO-initialised at load.
#   2. It sits 0xDC past the last named symbol, in the same TU as nn::nex::WaterMark.
# If .bss is zero at load and the word at +8 is the node's OWN ADDRESS at the hang, SOMETHING WROTE IT
# AT RUNTIME. That is the defect -- not a bad list, but a self-pointer written by a constructor.
set -uo pipefail
echo "=== main's section layout (from the NSO) ==="
echo "  text  0x0000000 .. 0x1415068"
echo "  ro    0x1416000 .. 0x2d5a063"
echo "  data  0x2d63000 .. 0x2fdb1b0"
echo "  bss   0x2fdb1b0 .. +0x6bde50"
printf '  0x304fb90 is in: '
awk 'BEGIN{ v=strtonum("0x304fb90");
           if (v>=0x2fdb1b0) print "BSS (zero-initialised at load)";
           else if (v>=0x2d63000) print "DATA";
           else print "other" }'

echo
echo "=== distance from the last symbol before it ==="
printf '  0x304fb90 - 0x304fab4 (WaterMark::m_bDisableRegisteringE) = 0x%x (%d bytes)\n' \
  $((0x304fb90 - 0x304fab4)) $((0x304fb90 - 0x304fab4))

echo
echo "=== so at LOAD the node is all zeros. At the HANG: ==="
echo "  +0x00 = 0x7102ef98a8   (a pointer into .data)"
echo "  +0x08 = 0x710304fb90   (THE NODE'S OWN ADDRESS)  <- written at runtime"
echo
echo "=== any nn::nex::WaterMark-adjacent PseudoGlobalVariable in main's symbols? ==="
grep -oE '"_ZN2nn3nex[0-9A-Za-z_]*PseudoGlobalVariable[0-9A-Za-z_]*"' "$HOME/sp2port/gen/main/table.cpp" 2>/dev/null | sort -u | head -8
