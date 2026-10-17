#!/usr/bin/env bash
# The references inside boot() are unqualified, so inside `namespace nx` they still resolve to
# nx::nx_module_subsdkN even though the externs are at global scope (a C++ name-lookup subtlety
# when a same-named entity exists in the enclosing namespace). Qualify explicitly with `::`.
set -uo pipefail
M="$HOME/sp2port/runtime/src/main.cpp"

python3 - "$M" <<'PY'
import sys, re
p = sys.argv[1]
s = open(p).read()

s = s.replace(
    '    const ModuleInfo* mods[] = {&nx_module_main, &nx_module_sdk,\n'
    '                                &nx_module_subsdk0, &nx_module_subsdk1,\n'
    '                                &nx_module_subsdk2, &nx_module_subsdk3};',
    '    const ModuleInfo* mods[] = {&nx_module_main, &nx_module_sdk,\n'
    '                                &::nx_module_subsdk0, &::nx_module_subsdk1,\n'
    '                                &::nx_module_subsdk2, &::nx_module_subsdk3};'
)
open(p, 'w').write(s)
print("qualified")
PY

echo "=== the module list now ==="
sed -n '/const ModuleInfo\* mods/,+3p' "$M"
