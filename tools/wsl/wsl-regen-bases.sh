#!/usr/bin/env bash
# Regenerate all six Splatoon 2 modules with NON-OVERLAPPING bases.
#
# The 16 MB stride used before is smaller than main's own span (text 0x1415068 + data + bss =
# ~0x3699e50 = 57 MB), so sdk and the subsdks were mapped OVER main. That is what produced
# "call into the middle of a function: main+1000030" -- 0x7101000030 is inside sdk's range.
#
# A 64 MB (0x4000000) stride is ample for main's 57 MB span.
set -uo pipefail

W="$HOME/refs/wonder"
SRC="$HOME/sp2recomp"          # where the raw NSOs were copied
OUT="$HOME/sp2recomp"          # regenerate in place
cd "$W" || exit 1

declare -A BASE=(
  [main]=0x7100000000
  [sdk]=0x7140000000
  [subsdk0]=0x7180000000
  [subsdk1]=0x71c0000000
  [subsdk2]=0x7200000000
  [subsdk3]=0x7240000000
)
# Output dir per module: gen (main), gen_sdk, gen_subsdk0..3
declare -A DIR=(
  [main]=gen [sdk]=gen_sdk [subsdk0]=gen_subsdk0
  [subsdk1]=gen_subsdk1 [subsdk2]=gen_subsdk2 [subsdk3]=gen_subsdk3
)

echo "=== regenerating with a 64 MB stride ==="
for m in main sdk subsdk0 subsdk1 subsdk2 subsdk3; do
  [ -f "$SRC/$m" ] || { echo "  $m: no NSO -- skipped"; continue; }
  printf '  %-9s base %-14s -> ' "$m" "${BASE[$m]}"
  rm -rf "$OUT/${DIR[$m]}"
  if python3 -m recomp "$SRC/$m" "$OUT/${DIR[$m]}" --name "$m" --base "${BASE[$m]}" \
       >/tmp/rg_$m.log 2>&1; then
    echo "OK ($(cat "$OUT/${DIR[$m]}/report.txt" 2>/dev/null | head -1))"
  else
    echo "FAILED"; tail -3 /tmp/rg_$m.log | sed 's/^/      /'
  fi
done

echo
echo "=== confirm the new bases in the generated tables ==="
for m in main sdk subsdk0 subsdk1 subsdk2 subsdk3; do
  t="$OUT/${DIR[$m]}/table.cpp"
  [ -f "$t" ] && printf '  %-9s %s\n' "$m" "$(grep -o 'NX_BASE + 0x[0-9a-f]*' "$t" | head -1)"
done
