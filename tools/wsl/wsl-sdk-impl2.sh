#!/usr/bin/env bash
# Compile ExtractDecompiled.java and decompile the marker-identified sdk functions.
#
# Java is mandatory here: Ghidra 12 headless has no Jython, and PyGhidra cannot
# install on this host (host Python 3.14 vs bundled cp310/cp311 jpype wheels).
set -uo pipefail

export JAVA_HOME="$HOME/tools/jdk21"
export GHIDRA_INSTALL_DIR="/mnt/c/Users/Hexa/Documents/nintendo/ghidra_12.1.2_PUBLIC_20260605/ghidra_12.1.2_PUBLIC"

W="$HOME/sp2"
SC="/mnt/c/Users/Hexa/Documents/nintendo/re-work"
BUILD="$W/scriptbuild"
mkdir -p "$BUILD"

CP="$(find "$GHIDRA_INSTALL_DIR/Ghidra" -name '*.jar' 2>/dev/null | tr '\n' ':')"

echo "== compile ExtractDecompiled.java =="
"$JAVA_HOME/bin/javac" -nowarn -cp "$CP" -d "$BUILD" "$SC/ExtractDecompiled.java" 2>&1 | head -10
echo "   javac exit=$?"
cp -f "$BUILD"/*.class "$SC/" 2>/dev/null && echo "   classes placed" || echo "   copy failed"

# addresses found by sdk-anchors.mjs: CNTPCT readers, MPIDR readers, SVC dispatcher
ADDRS="0x7f8e4,0x80130,0x7ee80,0x841d8,0x80b68,0x85e3c,0x81ab4,0x833cc,0x27b994,0x27bc0c,0x9e648"

echo
echo "== decompile $(echo "$ADDRS" | tr ',' '\n' | wc -l) functions =="
timeout 900 "$GHIDRA_INSTALL_DIR/support/analyzeHeadless" \
  "$W/proj-sdk" Sp2Sdk \
  -process sdk.elf -noanalysis \
  -scriptPath "$SC" \
  -postScript ExtractDecompiled.java "$W/sdk-impl.txt" "$ADDRS" \
  > "$W/sdk-impl.log" 2>&1
echo "   exit=$?"
grep -E 'ExtractDecompiled|SCRIPT ERROR' "$W/sdk-impl.log" | head -3

echo
if [ -f "$W/sdk-impl.txt" ]; then
  stat -c'%s bytes' "$W/sdk-impl.txt"
  echo "--- function headers found ---"
  grep -E '^0x[0-9a-f]+  |body size' "$W/sdk-impl.txt" | head -24
else
  echo "NONE"
  tail -6 "$W/sdk-impl.log"
fi
