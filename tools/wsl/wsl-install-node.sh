#!/usr/bin/env bash
# Install a self-contained Node runtime under ~/tools (no root required).
# Written as a file rather than an inline command because PowerShell mangles
# shell variable expansion inside wsl.exe argument strings.
set -euo pipefail

VERSION="v24.22.0"
ARCH="linux-x64"
TARBALL="node-${VERSION}-${ARCH}.tar.xz"
URL="https://nodejs.org/dist/${VERSION}/${TARBALL}"

mkdir -p "$HOME/tools"
cd "$HOME/tools"

echo "== downloading Node ${VERSION} (${ARCH}) =="
curl -fsSL -o "$TARBALL" "$URL"
echo "   size: $(stat -c%s "$TARBALL") bytes"

# verify it is really an xz archive before extracting
if ! file "$TARBALL" | grep -qi 'xz'; then
  echo "ERROR: downloaded file is not an xz archive; first bytes:"
  head -c 120 "$TARBALL"; echo
  exit 1
fi

echo "== extracting =="
rm -rf "node-${VERSION}-${ARCH}"
tar -xf "$TARBALL"
rm -f "$TARBALL"
rm -rf node
mv "node-${VERSION}-${ARCH}" node

echo "== installed =="
"$HOME/tools/node/bin/node" --version
"$HOME/tools/node/bin/npm" --version
