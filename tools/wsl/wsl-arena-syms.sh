#!/usr/bin/env bash
# Chase the arena. sead::HeapMgr::sDefaultArena (0x3663e98) is what HeapMgr::initialize(size) carves the root
# heap from. Find the Arena API, then check whether any Arena initialisation ever runs.
set -uo pipefail
T="$HOME/sp2port/gen/main/table.cpp"

echo "=== sead::Arena symbols in main ==="
grep -oE '"_ZN4sead5Arena[A-Za-z0-9_]*", 0x[0-9a-f]+' "$T" 2>/dev/null \
  | sed 's/"_ZN4sead5Arena//; s/", 0x/  0x/' | sort -k2 | head -24

echo
echo "=== key offsets ==="
for s in '_ZN4sead5Arena10initializeEm' '_ZN4sead5Arena11initializeEPvm' '_ZN4sead5ArenaC1Ev' '_ZN4sead5ArenaC2Ev'; do
  grep -oE "\"$s\", 0x[0-9a-f]+" "$T" 2>/dev/null | head -1
done
