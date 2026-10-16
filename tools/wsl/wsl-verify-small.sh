#!/usr/bin/env bash
# Verify the decompilation route end-to-end on a small module.
#
# hactool.exe is a Windows binary invoked through WSL interop, so it requires
# Windows-style paths (C:\...), not /mnt/c/... paths.
set -uo pipefail

export PATH="$HOME/tools/node/bin:$HOME/.npm-global/bin:$PATH"
export JAVA_HOME="$HOME/tools/jdk21"
export GHIDRA_INSTALL_DIR="/mnt/c/Users/Hexa/Documents/nintendo/ghidra_12.1.2_PUBLIC_20260605/ghidra_12.1.2_PUBLIC"

# Linux-style path used by node/rea
WORK="/mnt/c/Users/Hexa/Documents/nintendo/re-work"
# Windows-style path used by hactool.exe
WORKWIN='C:\Users\Hexa\Documents\nintendo\re-work'
EXEFSWIN='C:\Users\Hexa\Documents\nintendo\hactool-1.4.0-win\exefs'
HACTOOL='/mnt/c/Users/Hexa/Documents/nintendo/hactool-1.4.0-win/hactool.exe'
OUT="$HOME/rea-out"
mkdir -p "$OUT"

echo "== candidate modules =="
for m in rtld subsdk1 subsdk2; do
  p="$WORK/../../nintendo/hactool-1.4.0-win/exefs/$m"
  p="/mnt/c/Users/Hexa/Documents/nintendo/hactool-1.4.0-win/exefs/$m"
  if [ -f "$p" ]; then
    printf "  %-9s %8s bytes  magic=%s\n" "$m" "$(stat -c%s "$p")" "$(head -c4 "$p" | tr -d '\0')"
  else
    printf "  %-9s MISSING\n" "$m"
  fi
done

echo
echo "== decompress rtld NSO with hactool (Windows paths) =="
"$HACTOOL" -t nso "${EXEFSWIN}\\rtld" --uncompressed="${WORKWIN}\\rtld.decompressed" 2>&1 | tail -8
echo "  decompressed exists: $([ -f "$WORK/rtld.decompressed" ] && echo yes || echo NO)"

echo
echo "== rebuild as ELF64 AArch64 =="
if [ -f "$WORK/rtld.decompressed" ]; then
  node "$WORK/nso2elf.mjs" "$WORK/rtld.decompressed" "$WORK/rtld.elf" 2>&1 | tail -8
  node "$WORK/validate-elf.mjs" "$WORK/rtld.elf" 2>&1 | tail -3
fi

echo
echo "== rea inspect rtld (proof the pipeline yields a result) =="
if [ -f "$WORK/rtld.elf" ]; then
  timeout 900 rea inspect "$WORK/rtld.elf" --provider ghidra --format json > "$OUT/rtld-inspect.json" 2>&1
  echo "  exit=$?  bytes=$(stat -c%s "$OUT/rtld-inspect.json")"
  head -c 900 "$OUT/rtld-inspect.json"; echo
fi
