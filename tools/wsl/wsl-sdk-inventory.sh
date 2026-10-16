#!/usr/bin/env bash
# Export the sdk function/symbol inventory from the analysed project.
set -uo pipefail

export PATH="$HOME/tools/node/bin:$HOME/.npm-global/bin:$PATH"
export JAVA_HOME="$HOME/tools/jdk21"
export GHIDRA_INSTALL_DIR="/mnt/c/Users/Hexa/Documents/nintendo/ghidra_12.1.2_PUBLIC_20260605/ghidra_12.1.2_PUBLIC"

W="$HOME/sp2"
SC="/mnt/c/Users/Hexa/Documents/nintendo/re-work"

echo "== files before =="
ls -la "$W" | head -12

echo
echo "== run ExportSdkInventory via PyGhidra =="
# PyGhidra is not yet installed on the Linux side and its launcher asks
# interactively; feed confirmations through stdin so this can run headless.
printf 'y\ny\ny\ny\ny\n' | timeout 1500 "$GHIDRA_INSTALL_DIR/support/pyghidraRun" -H "$W/proj-sdk" Sp2Sdk \
  -process sdk.elf -noanalysis \
  -scriptPath "$SC" \
  -postScript ExportSdkInventory.py "$W/sdk-inventory.tsv" \
  > "$W/sdk-inv.log" 2>&1
echo "   exit=$?"
grep -E 'ExportSdkInventory|SCRIPT ERROR|Traceback|Creating Ghidra virtual' "$W/sdk-inv.log" | head -5

echo
echo "== inventory =="
if [ -f "$W/sdk-inventory.tsv" ]; then
  stat -c'%s bytes' "$W/sdk-inventory.tsv"
  head -3 "$W/sdk-inventory.tsv"
  echo "   lines: $(wc -l < "$W/sdk-inventory.tsv")"
  echo "   functions: $(grep -c '^FUNCTION' "$W/sdk-inventory.tsv")"
  echo "   symbols:   $(grep -c '^SYMBOL' "$W/sdk-inventory.tsv")"
  echo
  echo "== does it have real platform names? =="
  grep -oE 'nn::(os|mem|init|vi|fs|time|diag|util|nifm|oe)::[A-Za-z0-9_]+' "$W/sdk-inventory.tsv" 2>/dev/null | sort -u | head -20
else
  echo "   NONE"
  tail -6 "$W/sdk-inv.log"
fi
