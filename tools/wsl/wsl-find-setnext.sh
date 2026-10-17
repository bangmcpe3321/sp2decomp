#!/usr/bin/env bash
# Which offset does SetNext() write? If it writes +8, it is the writer of m_pNext and the search for
# `SetNext(this)` is the whole remaining task. If it writes something else, +8 is written elsewhere and
# the suspect list changes immediately.
set -uo pipefail
P="$HOME/sp2port"
T="$P/gen/main/table.cpp"
cd "$P" || exit 1

echo "=== SetNext offsets in main ==="
grep -oE '"_ZN2nn3nex20PseudoGlobalVariableI[0-9A-Za-z_]+E7SetNextEPNS0_24PseudoGlobalVariableRootE", 0x[0-9a-f]+' "$T" 2>/dev/null \
  | sed 's/"_ZN2nn3nex20PseudoGlobalVariableI//; s/E7SetNextEPNS0_24PseudoGlobalVariableRootE", 0x/ | 0x/' \
  | head -12

echo
echo "=== the SendMultiParameter instantiation specifically ==="
grep -oE '"_ZN2nn3nex20PseudoGlobalVariableI18SendMultiParameterE7SetNextEPNS0_24PseudoGlobalVariableRootE", 0x[0-9a-f]+' "$T" 2>/dev/null

echo
echo "=== also: the ROOT (non-template) SetNext, if present ==="
grep -oE '"_ZN2nn3nex24PseudoGlobalVariableRoot7SetNextEPPS0_[^"]*", 0x[0-9a-f]+' "$T" 2>/dev/null | head -3
grep -oE '"_[^"]*24PseudoGlobalVariableRoot7SetNext[^"]*", 0x[0-9a-f]+' "$T" 2>/dev/null | head -3
