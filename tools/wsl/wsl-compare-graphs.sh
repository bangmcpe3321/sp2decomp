#!/usr/bin/env bash
# Compare the two static-init graphs. Metric: distinct `PseudoGlobalVariable<T>` instantiations, and
# whether the nnos* era markers are present. Cheap: decompress + string-search, no recompile needed.
set -uo pipefail
E=/mnt/c/Users/Hexa/Documents/nintendo/proto-extract/exefs
W="$HOME/refs/wonder/tools/nso2bin.py"
O="$HOME/proto-nso"
mkdir -p "$O"

echo "=== decompress proto modules ==="
for m in main sdk subsdk0 subsdk1 subsdk2 subsdk3 subsdk4 subsdk9; do
  [ -f "$E/$m" ] || continue
  printf '  %-9s ' "$m"
  if [ -f "$O/$m.bin" ]; then echo "already"; continue; fi
  python3 "$W" "$E/$m" "$O/$m.bin" >/dev/null 2>&1 && echo "OK ($(du -h "$O/$m.bin" | cut -f1))" || echo "FAILED"
done

echo
echo "=== distinct PseudoGlobalVariable instantiations per module ==="
for m in main sdk subsdk0 subsdk1 subsdk2 subsdk3 subsdk4 subsdk9; do
  f="$O/$m.bin"
  [ -f "$f" ] || continue
  n=$(grep -ao '_ZN2nn3nex20PseudoGlobalVariableI[0-9A-Za-z_]*' "$f" 2>/dev/null | sort -u | wc -l)
  printf '  %-9s %3s distinct PGV types\n' "$m" "$n"
done

echo
echo "=== RETAIL (from the generated table, for comparison) ==="
for m in main sdk subsdk0 subsdk1 subsdk2 subsdk3; do
  t="$HOME/sp2port/gen/$m/table.cpp"
  [ -f "$t" ] || continue
  n=$(grep -o '_ZN2nn3nex20PseudoGlobalVariableI[0-9A-Za-z_]*' "$t" 2>/dev/null | sort -u | wc -l)
  printf '  %-9s %3s distinct PGV types\n' "$m" "$n"
done

echo
echo "=== era markers in proto main/sdk ==="
for m in main sdk; do
  f="$O/$m.bin"; [ -f "$f" ] || continue
  printf '  %-5s nnosInitialize=%s  nnos*=%s  nn4init5Start=%s\n' "$m" \
    "$(grep -ac 'nnosInitialize' "$f" 2>/dev/null || echo 0)" \
    "$(grep -ao '"*nnos[A-Za-z0-9_]*' "$f" 2>/dev/null | sort -u | wc -l)" \
    "$(grep -ac '_ZN2nn4init5StartEmmPFvvE' "$f" 2>/dev/null || echo 0)"
done
