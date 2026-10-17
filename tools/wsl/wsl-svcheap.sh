#!/usr/bin/env bash
# svcSetHeapSize (SVC 0x01) is in the app's allowed SVC list. On hardware the SDK's startup calls it to
# obtain the heap, and THEN calls nn::init::InitializeAllocator with that buffer. Our port skipped that
# chain and hand-installed a 64 MB allocator instead -- which is why InitializeAllocator was "never called".
# Check what the runtime actually does with svcSetHeapSize.
set -uo pipefail
R="$HOME/sp2port/runtime/src"

echo "=== svcSetHeapSize implementation ==="
grep -rn 'SetHeapSize\|svc_set_heap\|set_heap_size\|0x01' "$R"/svc_process.cpp "$R"/kernel.cpp 2>/dev/null | head -10

echo
echo "=== the SVC table / dispatch ==="
grep -rn 'case 0x01\|svc_table\|kSvc' "$R"/*.cpp 2>/dev/null | head -10

echo
echo "=== heap model constants ==="
grep -rn 'kHeapBase\|kHeapMax\|heap_base' "$R"/../include/nx/runtime.h 2>/dev/null | head -6

echo
echo "=== does anything reference the heap at runtime? ==="
grep -rn 'g_heap\|bump\|allocator' "$R"/kernel.cpp 2>/dev/null | head -8
