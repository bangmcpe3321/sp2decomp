#!/usr/bin/env bash
# Does the GAME call svcSetHeapSize (SVC 0x01)? If it does, the heap already exists at kHeapBase and our
# hand-installed malloc-based allocator is OVERRIDING it with a host pointer outside the guest address
# space -- a plausible cause of subtle corruption.
set -uo pipefail
cd "$HOME/sp2port" || exit 1
NX_TRACE=1 timeout 120 ./sp2 > /tmp/tr.txt 2>&1
echo "trace lines: $(wc -l < /tmp/tr.txt)"
echo
echo "=== SVC 0x01 (SetHeapSize) calls ==="
grep -c 'svc 0x1 ' /tmp/tr.txt || echo 0
grep 'svc 0x1 ' /tmp/tr.txt | head -5
echo
echo "=== which SVCs were seen at all ==="
grep -o 'svc 0x[0-9a-f]*' /tmp/tr.txt | sort | uniq -c | sort -rn | head -14
echo
echo "=== did our allocator install happen? ==="
grep -E 'installing game allocator|game allocator installed' /tmp/tr.txt | head -3
