#!/usr/bin/env bash
# Install the recompiler's Python deps WITHOUT sudo, by fetching wheels straight from PyPI into
# the user site. apt needs a password we cannot supply, and pip/ensurepip are absent, so this
# bypasses both.
#
# Usage: wsl-wheel-install.sh <package> [<import-name>]
set -uo pipefail

SITE=$(python3 -c 'import site; print(site.getusersitepackages())')
mkdir -p "$SITE"

install_one() {
  local PKG="$1" IMPORT="$2"
  if python3 -c "import $IMPORT" 2>/dev/null; then
    echo "  $PKG: already importable"
    return 0
  fi
  echo "  $PKG: fetching wheel..."
  local URL
  URL=$(timeout 40 curl -sS "https://pypi.org/pypi/$PKG/json" | python3 -c '
import json, sys, re
d = json.load(sys.stdin)
best = None
for ver, files in d["releases"].items():
    for f in files:
        n = f["filename"]
        if not n.endswith(".whl"):
            continue
        if "manylinux" not in n and "any.whl" not in n:
            continue
        if "x86_64" not in n and "any.whl" not in n:
            continue
        # prefer cp314 explicitly, then abi3, then pure-python
        score = 0
        if "cp314" in n: score = 3
        elif "abi3" in n: score = 2
        elif n.endswith("-py3-none-any.whl"): score = 1
        if score and (best is None or score > best[0]):
            best = (score, f["url"])
print(best[1] if best else "")
' 2>/dev/null)
  if [ -z "${URL:-}" ]; then
    echo "  $PKG: NO COMPATIBLE WHEEL FOUND"
    return 1
  fi
  echo "  $PKG: $(basename "$URL")"
  timeout 120 curl -sSL -o /tmp/pkg.whl "$URL" || return 1
  python3 -m zipfile -e /tmp/pkg.whl "$SITE" || return 1
  if python3 -c "import $IMPORT" 2>/dev/null; then
    echo "  $PKG: INSTALLED"
  else
    echo "  $PKG: unpacked but not importable (may need a native dependency)"
    return 1
  fi
}

install_one "$1" "${2:-$1}"
