#!/usr/bin/env bash
set -uo pipefail
cd "$HOME/sp2port" || exit 1
timeout 120 ./sp2 > /tmp/run8.txt 2>&1
echo "=== total lines: $(wc -l < /tmp/run8.txt) ==="
echo
echo "=== how many sdk constructors ran? ==="
echo "  sdk init[N] lines: $(grep -c 'sdk init\[' /tmp/run8.txt)"
echo "  main init[N] lines: $(grep -c 'main init\[' /tmp/run8.txt)"
echo
echo "=== the tail: where it stopped ==="
grep -vE '^    #' /tmp/run8.txt | tail -24
