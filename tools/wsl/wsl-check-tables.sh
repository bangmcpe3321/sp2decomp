#!/usr/bin/env bash
set -uo pipefail
cd "$HOME/sp2port" || exit 1
echo "=== table.o objects present ==="
find obj-all -name 'table.o' 2>/dev/null | sort

echo
echo "=== nx_module symbol each defines ==="
for o in $(find obj-all -name 'table.o' 2>/dev/null | sort); do
  printf '  %-28s ' "$o"
  nm -C "$o" 2>/dev/null | grep -o 'nx_module_[a-z0-9]*' | sort -u | tr '\n' ' '
  echo
done

echo
echo "=== does subsdk0's table.cpp even have an extern ModuleInfo? ==="
grep -c 'extern const nx::ModuleInfo' gen/subsdk0/table.cpp 2>/dev/null || echo 0
tail -10 gen/subsdk0/table.cpp 2>/dev/null
