#!/usr/bin/env bash
# Confirm the generated table for Splatoon 2 is a real offset->Fn table the loader can consume.
set -uo pipefail
T="$HOME/sp2recomp/gen/table.cpp"

echo "=== table.cpp size and line count ==="
ls -la "$T" | awk '{print "  bytes:", $5}'
echo "  lines: $(wc -l < "$T")"

echo
echo "=== first 8 lines ==="
head -8 "$T"

echo
echo "=== the shape of an entry (middle of the file) ==="
sed -n '2000000,2000006p' "$T" 2>/dev/null

echo
echo "=== counts ==="
echo "  entries naming a main_ function : $(grep -c 'main_' "$T" 2>/dev/null)"
echo "  null entries (0x0 / nullptr)    : $(grep -oc 'nullptr\|{0,\| 0,' "$T" 2>/dev/null || echo '?')"
echo "  distinct main_* referenced      : $(grep -o 'main_[0-9A-Fa-f]*' "$T" | sort -u | wc -l)"

echo
echo "=== does funcs.h declare the ModuleInfo the loader wants? ==="
grep -n -A12 'ModuleInfo\|func_count\|const Fn\* funcs\|struct Symbol' "$HOME/sp2recomp/gen/funcs.h" 2>/dev/null | head -30
