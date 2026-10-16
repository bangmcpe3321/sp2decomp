#!/usr/bin/env bash
# Install capstone 5.0.9 -- it ships a py3-none-manylinux wheel, so it is Python-version
# independent and DOES work on 3.14. An earlier filter looked for cp314/abi3/py3-none-any and
# missed 'py3-none-manylinux', which is why this looked impossible.
set -uo pipefail

SITE=$(python3 -c 'import site; print(site.getusersitepackages())')
echo "user site: $SITE"

echo "=== remove the 6.x install that shadowed 5.x ==="
rm -rf "$SITE/capstone" "$SITE/capstone-"*.dist-info 2>/dev/null
rm -rf /mnt/c/Users/Hexa/Documents/nintendo/re-work/capstone-shim/capstone/__pycache__ 2>/dev/null

URL=$(timeout 40 curl -sS https://pypi.org/pypi/capstone/5.0.9/json | python3 -c '
import json,sys
d=json.load(sys.stdin)
for f in d["urls"]:
    n=f["filename"]
    if n.endswith(".whl") and "manylinux" in n and "x86_64" in n and "i686" not in n:
        print(f["url"]); break
')
echo "wheel: $URL"
timeout 180 curl -sSL -o /tmp/cs509.whl "$URL" && python3 -m zipfile -e /tmp/cs509.whl "$SITE"
echo "unpacked"

echo
echo "=== verify: version AND the constant the recompiler needs ==="
python3 - <<'PY'
import capstone
print("capstone", capstone.__version__, "from", capstone.__file__)
from capstone import arm64_const as A
for n in ("ARM64_VAS_16B","ARM64_VAS_1Q","ARM64_VAS_4B","ARM64_VAS_1B","ARM64_VAS_2D"):
    print("  %-18s %s" % (n, getattr(A, n, "MISSING")))
PY
