#!/usr/bin/env bash
# Export the sdk inventory using analyzeHeadless (Jython), not PyGhidra.
#
# PyGhidra cannot install on this Linux side: Python 3.14 is present but the bundled
# jpype wheels are cp310/cp311 only. ExportInventory.py is written to be compatible
# with both Jython 2.7 and Python 3, so plain analyzeHeadless can run it.
set -uo pipefail

export JAVA_HOME="$HOME/tools/jdk21"
export GHIDRA_INSTALL_DIR="/mnt/c/Users/Hexa/Documents/nintendo/ghidra_12.1.2_PUBLIC_20260605/ghidra_12.1.2_PUBLIC"

W="$HOME/sp2"
SC="/mnt/c/Users/Hexa/Documents/nintendo/re-work"

echo "== analyzeHeadless -process sdk.elf -postScript ExportInventory.py =="
timeout 1200 "$GHIDRA_INSTALL_DIR/support/analyzeHeadless" \
  "$W/proj-sdk" Sp2Sdk \
  -process sdk.elf -noanalysis \
  -scriptPath "$SC" \
  -postScript ExportInventory.py "$W/sdk-inventory.txt" \
  > "$W/sdk-inv2.log" 2>&1
echo "   exit=$?"
grep -E 'ExportInventory|SCRIPT ERROR' "$W/sdk-inv2.log" | head -3

echo
echo "== inventory =="
if [ -f "$W/sdk-inventory.txt" ]; then
  stat -c'%s bytes' "$W/sdk-inventory.txt"
  echo "   functions: $(grep -c '^FUNCTION' "$W/sdk-inventory.txt")"
  echo "   symbols:   $(grep -c '^SYMBOL' "$W/sdk-inventory.txt")"
  echo
  echo "== platform names present? =="
  grep -oE '(nn::(os|mem|init|vi|fs|time|diag|util|nifm|oe)::[A-Za-z0-9_]+)' "$W/sdk-inventory.txt" | sort -u | head -24
else
  echo "   NONE"
  tail -6 "$W/sdk-inv2.log"
fi
