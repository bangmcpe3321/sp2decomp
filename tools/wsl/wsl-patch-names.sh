#!/usr/bin/env bash
# The runtime reports "34 unresolved" but not WHICH. Patch the loader to name them -- that list is
# the concrete work item for the next round.
set -uo pipefail
P="$HOME/sp2port"
L="$P/runtime/src/loader.cpp"

echo "=== the logging site ==="
sed -n '270,285p' "$L"

python3 - "$L" <<'PY'
import sys
p = sys.argv[1]
s = open(p).read()
old = '    log("linked: %zu to HLE, %zu across modules, %zu unresolved", hle, linked, missing);'
new = ('    log("linked: %zu to HLE, %zu across modules, %zu unresolved", hle, linked, missing);\n'
       '    // PATCHED: name the unresolved imports -- a count alone is not a work item.\n'
       '    for (auto& kv : g_exports_missing) log("  UNRESOLVED %s", kv.c_str());')
if old not in s:
    print("ANCHOR NOT FOUND", file=sys.stderr)
    sys.exit(1)
s = s.replace(old, new)
# Provide the container the new line iterates.
s = s.replace('void load_modules(', 'static std::vector<std::string> g_exports_missing;\n\nvoid load_modules(', 1)
open(p, "w").write(s)
print("patched")
PY

echo
echo "=== find where 'missing' is incremented, to also record the name ==="
grep -n 'missing' "$L" | head -10
