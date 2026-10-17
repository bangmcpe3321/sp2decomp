#!/usr/bin/env bash
set -uo pipefail
cd "$HOME/sp2port/gen" || exit 1

echo "=== entry-name counts across all six tables ==="
for n in nnMain nnosInitialize nnosStartup nnosThreadCreate; do
  c=$(grep -oh "\"$n\"" */table.cpp 2>/dev/null | wc -l)
  printf '  %-16s %s\n' "$n" "$c"
done

echo
echo "=== how many distinct nnos* symbols? ==="
grep -oh '"nnos[A-Za-z0-9_]*"' */table.cpp 2>/dev/null | sort -u | wc -l

echo
echo "=== the nnos* surface, first 24 ==="
grep -oh '"nnos[A-Za-z0-9_]*"' */table.cpp 2>/dev/null | sort -u | head -24

echo
echo "=== is there an 'nnMain' at all? ==="
grep -l '"nnMain"' */table.cpp 2>/dev/null
