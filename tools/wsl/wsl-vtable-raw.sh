#!/usr/bin/env bash
# Two things:
#  1. CONFIRM SetNext writes +8  (done: main_00D181E0 = *(this+8) = x1)
#  2. AddVariable's NON-EMPTY insertion path (+259..) calls vtable slot +0x30 with x1 = the NEW node.
#     Slot +0x30 was never named. Read it straight out of the raw .data image -- no running process.
set -uo pipefail
P="$HOME/sp2port"
IMG="$P/private/analysis/main.bin"
VT=0x2ef98a8          # guest offset of the PseudoGlobalVariable<SendMultiParameter> vtable
DATA=0x2d63000        # where .data starts in the flat image

echo "=== vtable slots from the RAW image (unrelocated) ==="
for off in 0x00 0x08 0x10 0x18 0x20 0x28 0x30 0x38; do
  fo=$(( VT + off ))
  printf '  vtable+%s (img 0x%x): ' "$off" "$fo"
  od -An -tx8 -j "$fo" -N 8 "$IMG" 2>/dev/null | tr -d ' \n'
  echo
done

echo
echo "=== known slots for comparison ==="
echo "  +0x00 ~PseudoGlobalVariable (D2)   0xd0cc20"
echo "  +0x08 ~PseudoGlobalVariable (D0)   0xd17f60"
echo "  +0x10 AllocateExtraContexts        0xd17fcc"
echo "  +0x18 FreeExtraContexts            0xd18108"
echo "  +0x20 ResetContext                 0xd18198"
echo "  +0x28 GetNext                      0xd181d8"
echo "  +0x30 ???  <-- SetNext should be 0xd181e0"
