#!/usr/bin/env bash
# Try to obtain a real function body from rtld, which already analyses in seconds.
#
# The previous attempt failed because 0x0 is not a procedure (Ghidra places the ELF
# header there). Rather than enumerate procedure names, walk candidate addresses in
# rtld's .text range and report the first that decompiles.
set -uo pipefail

export PATH="$HOME/tools/node/bin:$HOME/.npm-global/bin:$PATH"
export JAVA_HOME="$HOME/tools/jdk21"
export GHIDRA_INSTALL_DIR="/mnt/c/Users/Hexa/Documents/nintendo/ghidra_12.1.2_PUBLIC_20260605/ghidra_12.1.2_PUBLIC"

WORK="/mnt/c/Users/Hexa/Documents/nintendo/re-work"
OUT="$HOME/rea-out"
mkdir -p "$OUT"

# rtld .text spans 0x0..0x2e70 in the converted ELF (see the conversion output).
for addr in 0x1000 0x1100 0x1200 0x1400 0x1800 0x1c00 0x2000 0x2400 0x2800; do
  echo "== decompile $addr =="
  timeout 400 rea decompile "$WORK/rtld.elf" "$addr" --provider ghidra --format json \
    > "$OUT/rtld-dec-$addr.json" 2>&1
  code=$?
  size=$(stat -c%s "$OUT/rtld-dec-$addr.json" 2>/dev/null || echo 0)
  echo "   exit=$code bytes=$size"
  if [ "$code" -eq 0 ] && [ "$size" -gt 100 ]; then
    echo "   SUCCESS at $addr"
    head -c 1500 "$OUT/rtld-dec-$addr.json"
    echo
    break
  else
    head -c 300 "$OUT/rtld-dec-$addr.json" 2>/dev/null; echo
  fi
done
