#!/usr/bin/env bash
# Was sead::HeapMgr ever given a root heap? Find the HeapMgr API in main's symbols, then break on the
# setters to see whether any of them ever runs.
set -uo pipefail
T="$HOME/sp2port/gen/main/table.cpp"

echo "=== sead::HeapMgr symbols in main ==="
grep -oE '"_ZN4sead7HeapMgr[A-Za-z0-9_]*", 0x[0-9a-f]+' "$T" 2>/dev/null \
  | sed 's/"_ZN4sead7HeapMgr//; s/", 0x/  0x/' | sort -t' ' -k2 | head -30

echo
echo "=== ExpHeap::tryCreate and HeapMgr::getCurrentHeap offsets ==="
grep -oE '"_ZN4sead7ExpHeap9tryCreate[^"]*", 0x[0-9a-f]+' "$T" 2>/dev/null | head -3
grep -oE '"_ZNK4sead7HeapMgr14getCurrentHeapEv", 0x[0-9a-f]+' "$T" 2>/dev/null | head -2
grep -oE '"_ZN4sead7HeapMgr14setCurrentHeap[^"]*", 0x[0-9a-f]+' "$T" 2>/dev/null | head -3
grep -oE '"_ZN4sead7HeapMgr[0-9]*initialize[^"]*", 0x[0-9a-f]+' "$T" 2>/dev/null | head -3
