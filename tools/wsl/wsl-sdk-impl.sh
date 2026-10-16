#!/usr/bin/env bash
# Decompile the sdk functions identified by symbol-free instruction markers:
# the time-counter readers, the core-id readers, and the SVC dispatcher.
set -uo pipefail

export JAVA_HOME="$HOME/tools/jdk21"
export GHIDRA_INSTALL_DIR="/mnt/c/Users/Hexa/Documents/nintendo/ghidra_12.1.2_PUBLIC_20260605/ghidra_12.1.2_PUBLIC"

W="$HOME/sp2"
SC="/mnt/c/Users/Hexa/Documents/nintendo/re-work"

# addresses found by sdk-anchors.mjs
ADDRS="0x7f8e4,0x80130,0x7ee80,0x841d8,0x80b68,0x85e3c,0x81ab4,0x833cc,0x27b994,0x27bc0c,0x9e648"

echo "== decompiling $(echo "$ADDRS" | tr ',' '\n' | wc -l) marker-identified functions =="
timeout 900 "$GHIDRA_INSTALL_DIR/support/analyzeHeadless" \
  "$W/proj-sdk" Sp2Sdk \
  -process sdk.elf -noanalysis \
  -scriptPath "$SC" \
  -postScript ExtractDecompiled.py "$W/sdk-impl.txt" "$ADDRS" \
  > "$W/sdk-impl.log" 2>&1
echo "   exit=$?"
grep -E 'ExtractDecompiled|SCRIPT ERROR' "$W/sdk-impl.log" | head -3

echo
if [ -f "$W/sdk-impl.txt" ]; then
  stat -c'%s bytes' "$W/sdk-impl.txt"
  echo "--- signatures recovered ---"
  grep -nE '^\s*(void|int|uint|long|ulong|bool|undefined|char|float)' "$W/sdk-impl.txt" | head -14
else
  echo "NONE"
  tail -6 "$W/sdk-impl.log"
fi
