#!/usr/bin/env bash
# Uncapped pre-analysis of the converted main ELF on the Linux side.
#
# Purpose: pay Ghidra's analysis cost ONCE and save the project, instead of hitting
# REA's 330 s per-request budget on every call. This is the step that yields real
# function bodies for `main`.
#
# Deliberately no wrapper timeout: a full auto-analysis of a 21 MB binary with
# 113,150 functions is expected to take a long time, and that is the point.
set -uo pipefail

export JAVA_HOME="$HOME/tools/jdk21"
export GHIDRA_INSTALL_DIR="/mnt/c/Users/Hexa/Documents/nintendo/ghidra_12.1.2_PUBLIC_20260605/ghidra_12.1.2_PUBLIC"

# Work on the Linux filesystem, not across /mnt/c, to avoid slow Windows I/O.
SRC_LINUX="/mnt/c/Users/Hexa/Documents/nintendo/re-work/main.converted.elf"
WORK="$HOME/sp2"
mkdir -p "$WORK/proj"

echo "== staging input into the Linux filesystem =="
cp -f "$SRC_LINUX" "$WORK/main.elf"
ls -la "$WORK/main.elf"

echo
echo "== launching uncapped analyzeHeadless =="
echo "   project : $WORK/proj"
echo "   log     : $WORK/analysis.log"
date

# ExportInventory.py writes a function/symbol/string inventory from the analysed
# program, which is what turns 'analysis ran' into usable evidence.
"$GHIDRA_INSTALL_DIR/support/analyzeHeadless" \
  "$WORK/proj" Sp2Main \
  -import "$WORK/main.elf" \
  -scriptPath /mnt/c/Users/Hexa/Documents/nintendo/re-work \
  -postScript ExportInventory.py "$WORK/inventory.txt" \
  > "$WORK/analysis.log" 2>&1

echo "== analyzeHeadless finished, exit=$? =="
date
tail -20 "$WORK/analysis.log"
