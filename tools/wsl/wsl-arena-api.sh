#!/usr/bin/env bash
# The proper bootstrap needs an Arena placed over a caller buffer, then HeapMgr::initialize(Arena*).
# Check whether Arena has an (void*, size_t) initialiser -- that is the missing non-circular piece.
set -uo pipefail
T="$HOME/sp2port/gen/main/table.cpp"

echo "=== every sead::Arena member ==="
grep -oE '"_ZN4sead5Arena[A-Za-z0-9_]*", 0x[0-9a-f]+' "$T" 2>/dev/null \
  | sed 's/"_ZN4sead5Arena//; s/", 0x/  0x/' | sort -k2

echo
echo "=== every sead::HeapMgr member (initialize variants) ==="
grep -oE '"_ZN4sead7HeapMgr[A-Za-z0-9_]*", 0x[0-9a-f]+' "$T" 2>/dev/null \
  | sed 's/"_ZN4sead7HeapMgr//; s/", 0x/  0x/' | grep -i 'initialize\|createRoot\|setCurrent\|addRoot' | sort -k2

echo
echo "=== ExpHeap tryCreate overloads (which take a buffer?) ==="
grep -oE '"_ZN4sead7ExpHeap9tryCreate[^"]*", 0x[0-9a-f]+' "$T" 2>/dev/null | sort -u
