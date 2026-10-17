#!/usr/bin/env bash
# The duplicate is PROVEN: 0x710304fb90 and 0x7103650210 are each registered TWICE, and the second
# registration of each happens at the END of the sequence -- i.e. the whole constructor set ran twice.
# Why? Check whether main's init_array itself contains duplicate entries.
set -uo pipefail
T="$HOME/sp2port/gen/main/table.cpp"

echo "=== main's init_array, extracted ==="
grep -oE 'init_array\[\] = \{[^}]*\}' "$T" 2>/dev/null | head -c 400
echo

echo "=== count and duplicates in init_array ==="
awk '/init_array\[\] = \{/{f=1; sub(/.*\{/,""); } f{ gsub(/[{};]/,""); n=split($0,a,","); for(i=1;i<=n;i++){ v=a[i]; gsub(/[^0-9a-fx]/,"",v); if(v!=""&&v!="0") print v } if(/};/) exit }' "$T" \
  | sort > /tmp/ia.txt
echo "  entries: $(wc -l < /tmp/ia.txt)"
echo "  duplicates:"
sort /tmp/ia.txt | uniq -d | sed 's/^/    /' | head -10

echo
echo "=== the init_count declared in the ModuleInfo ==="
grep -oE 'init_array, [0-9]+' "$T" | head -1
