#!/usr/bin/env bash
# Analyse sdk via the ELF route, on the Linux side.
#
# Fixes over the first attempt:
#   - node must be on PATH (it lives in ~/tools/node/bin)
#   - analyzeHeadless requires the project DIRECTORY to exist already
set -uo pipefail

export PATH="$HOME/tools/node/bin:$HOME/.npm-global/bin:$PATH"
export JAVA_HOME="$HOME/tools/jdk21"
export GHIDRA_INSTALL_DIR="/mnt/c/Users/Hexa/Documents/nintendo/ghidra_12.1.2_PUBLIC_20260605/ghidra_12.1.2_PUBLIC"

WIN="/mnt/c/Users/Hexa/Documents/nintendo"
WORK="$HOME/sp2"
mkdir -p "$WORK/proj-sdk"

echo "== toolchain =="
echo "  node   : $(node --version)"
echo "  java   : $("$JAVA_HOME/bin/java" --version 2>&1 | head -1)"

echo
echo "== rebuild sdk as ELF64 AArch64 =="
node "$WIN/re-work/nso2elf.mjs" "$WIN/re-work/sdk.decompressed" "$WORK/sdk.elf" 2>&1 | tail -7
node "$WIN/re-work/validate-elf.mjs" "$WORK/sdk.elf" 2>&1 | tail -2

echo
echo "== uncapped Ghidra analysis =="
echo "   start: $(date)"
"$GHIDRA_INSTALL_DIR/support/analyzeHeadless" \
  "$WORK/proj-sdk" Sp2Sdk \
  -import "$WORK/sdk.elf" \
  -scriptPath "$WIN/re-work" \
  -postScript ExportInventory.py "$WORK/sdk-inventory.txt" \
  > "$WORK/sdk-analysis.log" 2>&1
echo "   analyzeHeadless exit=$? at $(date)"
tail -6 "$WORK/sdk-analysis.log"
echo "inventory: $([ -f "$WORK/sdk-inventory.txt" ] && stat -c%s "$WORK/sdk-inventory.txt" || echo NONE) bytes"
