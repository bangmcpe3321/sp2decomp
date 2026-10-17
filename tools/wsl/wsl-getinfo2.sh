#!/usr/bin/env bash
set -uo pipefail
echo "=== get_info definition site ==="
grep -rn 'get_info' ~/sp2port/runtime/src/kernel.cpp | head -5
echo
L=$(grep -n 'get_info(uint32_t' ~/sp2port/runtime/src/kernel.cpp | head -1 | cut -d: -f1)
if [ -n "${L:-}" ]; then
  echo "=== get_info body (from line $L) ==="
  sed -n "${L},$((L+44))p" ~/sp2port/runtime/src/kernel.cpp
fi
