#!/usr/bin/env bash
# Decompile main's call sites for every platform import.
#
# The platform implementations are absent from this dump, so the contract each import
# must satisfy is only observable from how main calls it. This walks each of the 51
# thunks, finds its callers inside main, and decompiles them.
set -uo pipefail

export JAVA_HOME="$HOME/tools/jdk21"
export GHIDRA_INSTALL_DIR="/mnt/c/Users/Hexa/Documents/nintendo/ghidra_12.1.2_PUBLIC_20260605/ghidra_12.1.2_PUBLIC"

SC="/mnt/c/Users/Hexa/Documents/nintendo/re-work"
BUILD="$HOME/sp2/scriptbuild"
mkdir -p "$BUILD"

CP="$(find "$GHIDRA_INSTALL_DIR/Ghidra" -name '*.jar' 2>/dev/null | tr '\n' ':')"

echo "== compile PlatformCallSites.java =="
"$JAVA_HOME/bin/javac" -nowarn -cp "$CP" -d "$BUILD" "$SC/PlatformCallSites.java" 2>&1 | grep -v '^Note:' | head -10
echo "   done"
cp -f "$BUILD"/*.class "$SC/" 2>/dev/null && echo "   classes placed"

ADDRS="$(tr -d '\n' < "$SC/platform-addrs.txt")"
echo "   platform imports: $(echo "$ADDRS" | tr ',' '\n' | wc -l)"

echo
echo "== find callers and decompile (main project) =="
timeout 1800 "$GHIDRA_INSTALL_DIR/support/analyzeHeadless" \
  "$HOME/sp2/proj" Sp2Main \
  -process main.elf -noanalysis \
  -scriptPath "$SC" \
  -postScript PlatformCallSites.java "$HOME/sp2/platform-callsites.txt" "$ADDRS" \
  > "$HOME/sp2/callsites.log" 2>&1
echo "   exit=$?"
grep -E 'PlatformCallSites|SCRIPT ERROR' "$HOME/sp2/callsites.log" | head -3

echo
if [ -f "$HOME/sp2/platform-callsites.txt" ]; then
  stat -c'%s bytes' "$HOME/sp2/platform-callsites.txt"
  echo "--- imports with callers ---"
  grep -c '^IMPORT' "$HOME/sp2/platform-callsites.txt"
  grep 'distinct callers' "$HOME/sp2/platform-callsites.txt" | head -20
else
  echo "NONE"
  tail -8 "$HOME/sp2/callsites.log"
fi
