#!/usr/bin/env bash
# Analyse the sdk module on the Linux side with the now-working REA + Ghidra stack.
#
# sdk is 3.0 MB (vs main's 23.7 MB), so it has a real chance of fitting REA's 330 s
# analysis budget. The ORIGINAL NSO is used rather than a converted ELF, because the
# NSO carries the module's own symbols -- which is what makes the output show
# nn::os::QueryMemoryInfo instead of FUN_00001234.
set -uo pipefail

export PATH="$HOME/tools/node/bin:$HOME/.npm-global/bin:$PATH"
export JAVA_HOME="$HOME/tools/jdk21"
export GHIDRA_INSTALL_DIR="/mnt/c/Users/Hexa/Documents/nintendo/ghidra_12.1.2_PUBLIC_20260605/ghidra_12.1.2_PUBLIC"

WORK="$HOME/sp2"
OUT="$HOME/rea-out"
mkdir -p "$OUT"

echo "== target =="
ls -la "$WORK/sdk.nso"

echo
echo "== rea inspect on the original sdk NSO (REA's own budget applies) =="
timeout 780 rea inspect "$WORK/sdk.nso" --provider ghidra --format json > "$OUT/sdk-inspect.json" 2>&1
echo "  exit=$?  bytes=$(stat -c%s "$OUT/sdk-inspect.json" 2>/dev/null || echo 0)"

python3 - <<'PY'
import json, os
p = os.path.expanduser('~/rea-out/sdk-inspect.json')
try:
    d = json.load(open(p))
except Exception as e:
    print('  not JSON:', e)
    print(open(p).read()[:800])
    raise SystemExit
if 'error' in d:
    print('  ERROR:', d.get('error'), '|', d.get('code'))
    print('  message:', str(d.get('message'))[:300])
    det = d.get('details', {})
    for k in ('timeout_ms', 'target_format', 'architecture', 'rejections'):
        if k in det:
            print(f'  {k}:', json.dumps(det[k])[:400])
else:
    sub = d.get('subject', {})
    nr = d.get('normalized_result', {})
    print('  format      :', sub.get('format'))
    print('  architecture:', sub.get('architecture'))
    print('  provider    :', d.get('provider', {}).get('id'), d.get('provider', {}).get('version'))
    if isinstance(nr, dict):
        for k in ('procedure_count', 'segment_count', 'string_count', 'image_base'):
            if k in nr:
                print(f'  {k:15}:', nr[k])
PY
