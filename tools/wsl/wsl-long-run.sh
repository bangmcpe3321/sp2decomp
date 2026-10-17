#!/usr/bin/env bash
# Does main's constructor list COMPLETE, and is nnMain reached?
# Round 9 stopped at "still running" with 1,368 constructors. Run much longer and record the end.
set -uo pipefail
cd "$HOME/sp2port" || exit 1

SECS="${1:-600}"
echo "=== running for ${SECS}s ==="
timeout "$SECS" ./sp2 > /tmp/run10.txt 2>&1
RC=$?
echo "exit: $RC  (124 = still running at the timeout)"
echo "lines: $(wc -l < /tmp/run10.txt)"
echo
echo "=== construction progress ==="
echo "  sdk  init[N]: $(grep -c 'sdk init\[' /tmp/run10.txt)"
echo "  main init[N]: $(grep -c 'main init\[' /tmp/run10.txt)"
echo
echo "=== milestones ==="
grep -E 'allocator installed|main constructors|entering nnMain|returned from nnMain|nn::init::Start|SIGSEGV|FATAL' /tmp/run10.txt | head -12
echo
echo "=== last 12 non-register lines ==="
grep -vE '^    #|^  x[0-9]|^  UNRESOLVED' /tmp/run10.txt | tail -12
