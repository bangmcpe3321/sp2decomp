#!/usr/bin/env bash
# Extract the real procedure count from the rtld result and attempt a decompile,
# which is the final proof that function bodies are obtainable.
set -uo pipefail

export PATH="$HOME/tools/node/bin:$HOME/.npm-global/bin:$PATH"
export JAVA_HOME="$HOME/tools/jdk21"
export GHIDRA_INSTALL_DIR="/mnt/c/Users/Hexa/Documents/nintendo/ghidra_12.1.2_PUBLIC_20260605/ghidra_12.1.2_PUBLIC"

WORK="/mnt/c/Users/Hexa/Documents/nintendo/re-work"
OUT="$HOME/rea-out"

echo "== procedure count reported by the rtld analysis =="
python3 - <<'PY'
import json, os
d = json.load(open(os.path.expanduser('~/rea-out/rtld-inspect.json')))
nr = d.get('normalized_result', {})
print('  procedure_count   :', nr.get('procedure_count'))
print('  normalized keys   :', list(nr.keys())[:20])
print('  limitations       :', json.dumps(d.get('limitations'))[:300])
print('  confidence        :', d.get('confidence'))
PY

echo
echo "== native decompile CLI available? =="
rea --help 2>&1 | grep -iE '^\s+(decompile|function|disassemble|analyze)\b' | head -6

echo
echo "== attempt a decompile of the rtld entry (address 0x0) =="
timeout 900 rea decompile "$WORK/rtld.elf" 0x0 --provider ghidra --format json > "$OUT/rtld-decomp.json" 2>&1
echo "  exit=$?  bytes=$(stat -c%s "$OUT/rtld-decomp.json")"
head -c 700 "$OUT/rtld-decomp.json"; echo

echo
echo "== if that failed, try 'rea analyze' for a text overview =="
timeout 900 rea analyze "$WORK/rtld.elf" --provider ghidra --format md > "$OUT/rtld-analyze.md" 2>&1
echo "  exit=$?  bytes=$(stat -c%s "$OUT/rtld-analyze.md")"
head -c 1500 "$OUT/rtld-analyze.md"
