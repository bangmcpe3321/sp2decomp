#!/usr/bin/env bash
set -uo pipefail
echo "=== ordering: game log milestones vs the HeapMgr::initialize hit ==="
grep -n '' /tmp/hm.txt | grep -E 'HeapMgr::initialize|entering nnMain|_init at|allocator installed|nnosInitialize returned|HOST SIGSEGV|fault address|guest lr' | head -14
