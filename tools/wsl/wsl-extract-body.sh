#!/usr/bin/env bash
# Extract the pseudocode and assembly text from the successful rtld decompile.
# This is the final proof: an actual function BODY from a Nintendo Switch module.
set -uo pipefail

python3 - <<'PY'
import json, os

p = os.path.expanduser('~/rea-out/rtld-dec-0x1000.json')
d = json.load(open(p))
print("evidence_id :", d.get('evidence_id'))
print("operation   :", d.get('operation'))
print("provider    :", d.get('provider', {}).get('id'), d.get('provider', {}).get('version'))

nr = d.get('normalized_result', {})
print("normalized keys:", list(nr.keys())[:16])

# print the whole normalized result tree shallowly to find the body fields
def show(o, path='', depth=0):
    if depth > 2:
        return
    if isinstance(o, dict):
        for k, v in o.items():
            if isinstance(v, str) and len(v) > 60:
                print(f"  {path}.{k}  <str {len(v)} chars>")
            elif isinstance(v, list):
                print(f"  {path}.{k}  <list {len(v)}>")
            elif isinstance(v, dict):
                show(v, f"{path}.{k}", depth + 1)
            else:
                print(f"  {path}.{k} = {v}")
show(nr, 'nr')

print()
print("=" * 70)
print("PSEUDOCODE")
print("=" * 70)
for key in ('pseudo_code', 'pseudocode', 'decompiled', 'pseudoCode', 'code'):
    if key in nr and isinstance(nr[key], str):
        print(nr[key][:4000])
        break
else:
    print("(no pseudocode string field at normalized_result top level)")

print()
print("=" * 70)
print("ASSEMBLY / mixed listing (if present)")
print("=" * 70)
for key in ('assembly', 'disassembly', 'listing', 'instructions'):
    if key in nr:
        v = nr[key]
        if isinstance(v, str):
            print(v[:3000])
        elif isinstance(v, list):
            for e in v[:40]:
                print("  ", e if isinstance(e, str) else json.dumps(e)[:200])
        break
PY
