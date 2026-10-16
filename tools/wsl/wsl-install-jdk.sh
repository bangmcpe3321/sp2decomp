#!/usr/bin/env bash
# Install a self-contained JDK 21 under ~/tools (no root required).
# Resolves the asset URL from the Adoptium API rather than guessing a filename.
set -euo pipefail

mkdir -p "$HOME/tools"
cd "$HOME/tools"

echo "== resolving latest JDK 21 (temurin, linux x64) =="
API="https://api.adoptium.net/v3/assets/latest/21/hotspot?architecture=x64&image_type=jdk&os=linux&vendor=eclipse"
curl -fsSL "$API" -o /tmp/jdk21.json
python3 - <<'PY'
import json
d = json.load(open('/tmp/jdk21.json'))
a = d[0]['binary']['package']
print("  release:", d[0].get('release_name'))
print("  name   :", a['name'])
print("  size   :", a['size'])
open('/tmp/jdk_url.txt','w').write(a['link'])
open('/tmp/jdk_name.txt','w').write(a['name'])
PY

URL="$(cat /tmp/jdk_url.txt)"
NAME="$(cat /tmp/jdk_name.txt)"

echo "== downloading $NAME =="
curl -fsSL -o "$NAME" "$URL"
echo "   got $(stat -c%s "$NAME") bytes"

echo "== extracting =="
tar -xzf "$NAME"
rm -f "$NAME"
DIR="$(tar -tzf /dev/null 2>/dev/null || true)"
# the archive contains a single top-level directory
EXTRACTED="$(find . -maxdepth 1 -type d -name 'jdk-21*' | head -1)"
if [ -z "$EXTRACTED" ]; then
  echo "ERROR: could not find extracted jdk-21* directory"
  exit 1
fi
rm -rf jdk21
mv "$EXTRACTED" jdk21

echo "== installed =="
"$HOME/tools/jdk21/bin/java" -version 2>&1 | head -3
