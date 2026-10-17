#!/usr/bin/env bash
# 62 AddVariable registrations observed. head never changes (=0x7103650160) and this never changes
# (=0x7103650170). The FIRST registered node is 0x710304fb90 -- the one that later self-links.
# Question: does any node get registered TWICE (duplicate registration)?
set -uo pipefail
F=/tmp/bpout.txt

echo "=== all 62 registrations ==="
grep -o 'x1(node)=0x[0-9a-f]*' "$F" | sed 's/x1(node)=//' > /tmp/nodes.txt
wc -l < /tmp/nodes.txt | xargs printf '  count: %s\n'

echo
echo "=== duplicates? ==="
sort /tmp/nodes.txt | uniq -d | sed 's/^/  DUP: /'
[ -z "$(sort /tmp/nodes.txt | uniq -d)" ] && echo "  (none -- every node registered once)"

echo
echo "=== first and last five ==="
head -5 /tmp/nodes.txt | sed 's/^/  /'
echo "  ..."
tail -5 /tmp/nodes.txt | sed 's/^/  /'

echo
echo "=== is 0x710304fb90 (the self-linker) registered more than once? ==="
grep -c '710304fb90' /tmp/nodes.txt

echo
echo "=== spacing between consecutive nodes ==="
awk 'NR>1 { printf "  0x%x\n", strtonum($0) - strtonum(prev) } { prev=$0 }' /tmp/nodes.txt | sort | uniq -c | sort -rn | head -4

echo
echo "=== did the run REACH the hang? ==="
grep -c 'main init\[1367\]' "$F"
grep -E 'SIGSEGV|fault address' "$F" | head -2
