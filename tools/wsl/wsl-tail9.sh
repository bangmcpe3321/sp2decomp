#!/usr/bin/env bash
set -uo pipefail
cd "$HOME/sp2port" || exit 1
timeout 180 ./sp2 > /tmp/run9.txt 2>&1
RC=$?
echo "=== exit: $RC (124 = still running at 180s timeout) ==="
echo "=== total output lines: $(wc -l < /tmp/run9.txt) ==="
echo
echo "=== constructor progress ==="
echo "  sdk  init[N]: $(grep -c 'sdk init\[' /tmp/run9.txt)"
echo "  main init[N]: $(grep -c 'main init\[' /tmp/run9.txt)"
grep -E 'sdk constructors|main constructors|allocator|entering nnMain|returned' /tmp/run9.txt | head -8
echo
echo "=== the tail: where it actually stopped ==="
grep -vE '^    #|^  x[0-9]|^  UNRESOLVED' /tmp/run9.txt | tail -16
