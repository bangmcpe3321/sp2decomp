#!/usr/bin/env bash
# Confirm the pipeline yields actual function bodies, not just metadata.
set -uo pipefail

export PATH="$HOME/tools/node/bin:$HOME/.npm-global/bin:$PATH"
export JAVA_HOME="$HOME/tools/jdk21"
export GHIDRA_INSTALL_DIR="/mnt/c/Users/Hexa/Documents/nintendo/ghidra_12.1.2_PUBLIC_20260605/ghidra_12.1.2_PUBLIC"

WORK="/mnt/c/Users/Hexa/Documents/nintendo/re-work"
OUT="$HOME/rea-out"
mkdir -p "$OUT"

echo "== what analysis views does the rtld result offer? =="
python3 - <<'PY'
import json, os
p = os.path.expanduser('~/rea-out/rtld-inspect.json')
try:
    d = json.load(open(p))
except Exception as e:
    print('  could not parse:', e); raise SystemExit
print('  top-level keys:', list(d.keys()))
sub = d.get('subject', {})
print('  subject format/arch:', sub.get('format'), sub.get('architecture'))
# look for anything function-like
def walk(o, path='', depth=0):
    if depth > 3: return
    if isinstance(o, dict):
        for k, v in o.items():
            if 'function' in k.lower() or 'procedure' in k.lower():
                print(f'  key at {path}.{k}: {type(v).__name__}')
            walk(v, f'{path}.{k}', depth+1)
    elif isinstance(o, list) and o:
        walk(o[0], f'{path}[0]', depth+1)
walk(d)
PY

echo
echo "== list_procedures on rtld (real function inventory) =="
timeout 900 rea list-procedures "$WORK/rtld.elf" --provider ghidra --format json > "$OUT/rtld-procs.json" 2>&1
echo "  exit=$?  bytes=$(stat -c%s "$OUT/rtld-procs.json")"
python3 - <<'PY'
import json, os
p = os.path.expanduser('~/rea-out/rtld-procs.json')
try:
    d = json.load(open(p))
except Exception as e:
    print('  parse failed:', e)
    print(open(p).read()[:600]); raise SystemExit
# find the procedure list wherever it lives
found = []
def walk(o):
    if isinstance(o, dict):
        for k, v in o.items():
            if k in ('procedures','functions','items') and isinstance(v, list) and v:
                found.append((k, v))
            walk(v)
    elif isinstance(o, list):
        for x in o: walk(x)
walk(d)
for k, v in found[:2]:
    print(f'  {k}: {len(v)} entries')
    for e in v[:12]:
        if isinstance(e, dict):
            print('   ', {kk: e[kk] for kk in list(e)[:4]})
        else:
            print('   ', e)
if not found:
    print('  keys:', list(d.keys())[:12])
    print('  head:', json.dumps(d)[:500])
PY
