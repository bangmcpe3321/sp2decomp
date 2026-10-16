#!/usr/bin/env bash
# Map sdk marker sites to their REAL containing functions using Ghidra's own
# function boundaries, then decompile each distinct function.
#
# This replaces the byte-scan for `stp x29,x30,[sp,#-N]!`, which misattributed
# sites because that instruction also opens secondary stack frames inside larger
# functions (round-1 evidence: a supposed 16-byte function "contained" 104 SVCs).
set -uo pipefail

export JAVA_HOME="$HOME/tools/jdk21"
export GHIDRA_INSTALL_DIR="/mnt/c/Users/Hexa/Documents/nintendo/ghidra_12.1.2_PUBLIC_20260605/ghidra_12.1.2_PUBLIC"

W="$HOME/sp2"
SC="/mnt/c/Users/Hexa/Documents/nintendo/re-work"
BUILD="$W/scriptbuild"
mkdir -p "$BUILD"

CP="$(find "$GHIDRA_INSTALL_DIR/Ghidra" -name '*.jar' 2>/dev/null | tr '\n' ':')"

echo "== compile MapMarkerSites.java =="
"$JAVA_HOME/bin/javac" -nowarn -cp "$CP" -d "$BUILD" "$SC/MapMarkerSites.java" 2>&1 | grep -v '^Note:' | head -8
echo "   javac done"
cp -f "$BUILD"/*.class "$SC/" 2>/dev/null && echo "   classes placed"

SITES="$(tr -d '\n' < "$SC/sdk-marker-sites.txt")"
echo "   marker sites: $(echo "$SITES" | tr ',' '\n' | wc -l)"

echo
echo "== map + decompile =="
timeout 1200 "$GHIDRA_INSTALL_DIR/support/analyzeHeadless" \
  "$W/proj-sdk" Sp2Sdk \
  -process sdk.elf -noanalysis \
  -scriptPath "$SC" \
  -postScript MapMarkerSites.java "$W/sdk-marker-functions.txt" "$SITES" \
  > "$W/sdk-map.log" 2>&1
echo "   exit=$?"
grep -E 'MapMarkerSites|SCRIPT ERROR' "$W/sdk-map.log" | head -3

echo
if [ -f "$W/sdk-marker-functions.txt" ]; then
  stat -c'%s bytes' "$W/sdk-marker-functions.txt"
  echo "--- summary block ---"
  sed -n '/=== SUMMARY ===/,/^$/p' "$W/sdk-marker-functions.txt" | head -30
else
  echo "NONE"
  tail -8 "$W/sdk-map.log"
fi
