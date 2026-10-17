#!/usr/bin/env bash
# Insert the global-scope externs for the four subsdk ModuleInfo tables at line 17 (after the
# includes, before `namespace nx {` at line 18). The tables define them at GLOBAL scope:
#   extern const nx::ModuleInfo nx_module_subsdk0 = {...};   ->  symbol ::nx_module_subsdk0
# Declaring them inside namespace nx named nx::nx_module_subsdk0, which did not match.
set -uo pipefail
M="$HOME/sp2port/runtime/src/main.cpp"

if grep -q 'extern const nx::ModuleInfo nx_module_subsdk0;' "$M"; then
  echo "already inserted"
else
  python3 - "$M" <<'PY'
import sys
p = sys.argv[1]
lines = open(p).read().split('\n')
out = []
inserted = False
for i, ln in enumerate(lines):
    if not inserted and ln.strip() == 'namespace nx {':
        out.append('// PATCHED: the generated tables define these at GLOBAL scope, so declare them')
        out.append('// the same way. Inside namespace nx they would name nx::nx_module_subsdkN and')
        out.append('// would not match the objects (verified with nm).')
        for k in range(4):
            out.append('extern const nx::ModuleInfo nx_module_subsdk%d;' % k)
        out.append('')
        inserted = True
    out.append(ln)
open(p, 'w').write('\n'.join(out))
print("inserted" if inserted else "ANCHOR MISSING")
PY
fi

echo
echo "=== verify ==="
grep -n 'extern const nx::ModuleInfo nx_module_subsdk' "$M" | head -5
grep -n 'load_modules(mods, 6' "$M"
