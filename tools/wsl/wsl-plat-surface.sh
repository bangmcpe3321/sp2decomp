#!/usr/bin/env bash
# What is the EXACT platform surface a Linux port must provide?
# This is the work list: nx::plat::* is the only genuinely missing layer.
set -uo pipefail
P="$HOME/sp2port"

echo "=== distinct undefined symbols from the link attempt ==="
grep -oE "undefined reference to \`[^']*'" "$P/link-err.txt" 2>/dev/null \
  | sed -E "s/.*\`//; s/'$//" | sort -u > "$P/link-undef.txt"
echo "  total: $(wc -l < "$P/link-undef.txt")"

echo
echo "=== categorised ==="
printf '  %-32s %s\n' "nx::plat::*  (PLATFORM - the work)" "$(grep -c '^nx::plat::' "$P/link-undef.txt")"
printf '  %-32s %s\n' "main" "$(grep -cx 'main' "$P/link-undef.txt")"
printf '  %-32s %s\n' "nn::*  (HLE)" "$(grep -c '^nn::' "$P/link-undef.txt")"
printf '  %-32s %s\n' "nx::* (non-plat)" "$(grep -c '^nx::' "$P/link-undef.txt")"
printf '  %-32s %s\n' "nvn/NVN" "$(grep -ciE '^nvn|NVN' "$P/link-undef.txt")"
printf '  %-32s %s\n' "other" "$(grep -vcE '^nx::plat::|^main$|^nn::|^nx::' "$P/link-undef.txt")"

echo
echo "=== THE PLATFORM SURFACE, complete ==="
grep '^nx::plat::' "$P/link-undef.txt" | sed 's/^/  /'

echo
echo "=== any non-platform stragglers? ==="
grep -vE '^nx::plat::' "$P/link-undef.txt" | sed 's/^/  /' | head -24
