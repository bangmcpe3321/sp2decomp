#!/usr/bin/env bash
# Find platform import thunks in main BY NAME and decompile their callers.
#
# The PORT_WORKLIST.md addresses are GOT slots that Ghidra promoted to functions, not
# code, so address lookup returns NO THUNK. Match on name instead.
set -uo pipefail

export JAVA_HOME="$HOME/tools/jdk21"
export GHIDRA_INSTALL_DIR="/mnt/c/Users/Hexa/Documents/nintendo/ghidra_12.1.2_PUBLIC_20260605/ghidra_12.1.2_PUBLIC"

SC="/mnt/c/Users/Hexa/Documents/nintendo/re-work"
BUILD="$HOME/sp2/scriptbuild"
mkdir -p "$BUILD"

CP="$(find "$GHIDRA_INSTALL_DIR/Ghidra" -name '*.jar' 2>/dev/null | tr '\n' ':')"

echo "== compile PlatformThunksByName.java =="
"$JAVA_HOME/bin/javac" -nowarn -cp "$CP" -d "$BUILD" "$SC/PlatformThunksByName.java" 2>&1 | grep -v '^Note:' | head -10
echo "   javac done"
cp -f "$BUILD"/*.class "$SC/" 2>/dev/null && echo "   classes placed"

echo
echo "== match by name, find callers, decompile (main project) =="
timeout 1800 "$GHIDRA_INSTALL_DIR/support/analyzeHeadless" \
  "$HOME/sp2/proj" Sp2Main \
  -process main.elf -noanalysis \
  -scriptPath "$SC" \
  -postScript PlatformThunksByName.java "$HOME/sp2/platform-thunks.txt" \
  > "$HOME/sp2/thunks.log" 2>&1
echo "   exit=$?"
grep -E 'PlatformThunksByName|SCRIPT ERROR' "$HOME/sp2/thunks.log" | head -3

echo
if [ -f "$HOME/sp2/platform-thunks.txt" ]; then
  stat -c'%s bytes' "$HOME/sp2/platform-thunks.txt"
  echo "--- header ---"
  head -6 "$HOME/sp2/platform-thunks.txt"
  echo "--- imports with callers ---"
  grep -c '^IMPORT' "$HOME/sp2/platform-thunks.txt"
  grep '^  callers' "$HOME/sp2/platform-thunks.txt" | head -18
  echo "--- tail ---"
  tail -2 "$HOME/sp2/platform-thunks.txt"
else
  echo "NONE"
  tail -8 "$HOME/sp2/thunks.log"
fi
