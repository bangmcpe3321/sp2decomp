#!/usr/bin/env bash
# Precompile a Ghidra Java script and run it headless.
#
# Ghidra 12's headless analyzer has no Jython ("Ghidra was not started with
# PyGhidra. Python is not available"), and PyGhidra cannot install here because the
# bundled jpype wheels are cp310/cp311 while this host has Python 3.14.
#
# The supported route is a Java script. Ghidra compiles those on demand, but that
# has been unreliable in this setup, so compile explicitly with javac against
# Ghidra's full jar classpath and place the .class beside the source.
set -uo pipefail

export JAVA_HOME="$HOME/tools/jdk21"
export GHIDRA_INSTALL_DIR="/mnt/c/Users/Hexa/Documents/nintendo/ghidra_12.1.2_PUBLIC_20260605/ghidra_12.1.2_PUBLIC"

W="$HOME/sp2"
SC="/mnt/c/Users/Hexa/Documents/nintendo/re-work"
BUILD="$W/scriptbuild"
mkdir -p "$BUILD"

echo "== build Ghidra classpath =="
CP="$(find "$GHIDRA_INSTALL_DIR/Ghidra" -name '*.jar' 2>/dev/null | tr '\n' ':')"
echo "   jars: $(echo "$CP" | tr ':' '\n' | grep -c jar)"

echo
echo "== compile ExportInventory.java =="
"$JAVA_HOME/bin/javac" -nowarn -cp "$CP" -d "$BUILD" "$SC/ExportInventory.java" 2>&1 | head -12
echo "   javac exit=$?"
ls -la "$BUILD" 2>&1 | head -5

echo
echo "== place the .class beside the script so Ghidra finds it =="
cp -f "$BUILD"/*.class "$SC/" 2>/dev/null && echo "   copied" || echo "   copy failed"
ls -la "$SC"/*.class 2>&1 | head -4

echo
echo "== run it against the analysed sdk project =="
timeout 1200 "$GHIDRA_INSTALL_DIR/support/analyzeHeadless" \
  "$W/proj-sdk" Sp2Sdk \
  -process sdk.elf -noanalysis \
  -scriptPath "$SC" \
  -postScript ExportInventory.java "$W/sdk-inventory.txt" \
  > "$W/sdk-inv3.log" 2>&1
echo "   exit=$?"
grep -E 'ExportInventory|SCRIPT ERROR|ClassNotFound' "$W/sdk-inv3.log" | head -4

echo
echo "== inventory =="
if [ -f "$W/sdk-inventory.txt" ]; then
  stat -c'%s bytes' "$W/sdk-inventory.txt"
  echo "   functions: $(grep -c '^FUNCTION' "$W/sdk-inventory.txt")"
  echo "   symbols:   $(grep -c '^SYMBOL' "$W/sdk-inventory.txt")"
else
  echo "   NONE"
  tail -8 "$W/sdk-inv3.log"
fi
