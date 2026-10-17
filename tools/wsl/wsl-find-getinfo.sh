#!/usr/bin/env bash
set -uo pipefail
R="$HOME/sp2port/runtime"
echo "=== get_info definition (any file) ==="
grep -rn 'get_info' "$R/src" "$R/include" 2>/dev/null | head -8
echo
echo "=== if defined, show its body ==="
F=$(grep -rln 'uint64_t get_info' "$R/src" 2>/dev/null | head -1)
echo "  file: ${F:-none}"
if [ -n "${F:-}" ]; then
  L=$(grep -n 'uint64_t get_info' "$F" | head -1 | cut -d: -f1)
  sed -n "${L},$((L+46))p" "$F"
fi
