#!/usr/bin/env bash
# Build and run the minimal execution harness: one generated TU + our own nx stubs.
#
# Deliberately cheap: ONE translation unit, with --gc-sections and unresolved symbols tolerated,
# because the question is "does generated guest code execute", not "does the whole game link".
set -uo pipefail

P="$HOME/sp2port"
H="/mnt/c/Users/Hexa/Documents/nintendo/re-work/harness"
OBJ="$P/harness-bin"
mkdir -p "$OBJ"

INC="$P/runtime/include"
GEN="$P/gen/main"

echo "=== inputs ==="
echo "  include : $INC/nx/cpu.h  $([ -f "$INC/nx/cpu.h" ] && echo OK || echo MISSING)"
echo "  generated: $GEN/code_000.cpp  $([ -f "$GEN/code_000.cpp" ] && echo OK || echo MISSING)"
echo "  harness : $H/harness.cpp"

echo
echo "=== compile the generated TU (function sections so --gc-sections can drop the rest) ==="
cd "$GEN" || exit 1
timeout 600 g++ -std=c++20 -c -O1 -w -ffunction-sections -fdata-sections \
  -I "$INC" -I . code_000.cpp -o "$OBJ/code_000.o" 2>&1 | head -8
echo "  code_000.o: $([ -f "$OBJ/code_000.o" ] && du -h "$OBJ/code_000.o" | cut -f1 || echo FAILED)"

echo
echo "=== compile the harness ==="
timeout 300 g++ -std=c++20 -c -O1 -w -I "$INC" "$H/harness.cpp" -o "$OBJ/harness.o" 2>&1 | head -12
echo "  harness.o: $([ -f "$OBJ/harness.o" ] && echo OK || echo FAILED)"

echo
echo "=== link ==="
# --gc-sections keeps only what main() reaches. Symbols the dropped sections referenced are left
# unresolved on purpose: this is a SMOKE TEST of execution, not a full link.
timeout 300 g++ -std=c++20 -O1 -Wl,--gc-sections -Wl,--unresolved-symbols=ignore-all \
  "$OBJ/harness.o" "$OBJ/code_000.o" -o "$OBJ/harness" 2>&1 | head -12
if [ -f "$OBJ/harness" ]; then
  echo "  linked: $(du -h "$OBJ/harness" | cut -f1)"
else
  echo "  LINK FAILED"; exit 1
fi

echo
echo "=== RUN ==="
"$OBJ/harness"
echo "  exit=$?"
