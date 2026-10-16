#!/usr/bin/env bash
# Clone the open-ead reference repositories needed for the reconstruction port.
set -uo pipefail

REFS="$HOME/refs"
mkdir -p "$REFS"
cd "$REFS"

clone() {
  local name="$1" url="$2"
  if [ -d "$name/.git" ]; then
    echo "  $name: already present"
  else
    echo "  cloning $name ..."
    git clone --depth 1 "$url" "$name" >/dev/null 2>&1 && echo "    ok" || echo "    FAILED"
  fi
}

echo "=== reference repositories ==="
clone sead   https://github.com/open-ead/sead.git
clone agl    https://github.com/open-ead/agl.git
clone nnware https://github.com/open-ead/nnware.git
clone eui    https://github.com/open-ead/eui.git

echo
echo "=== sizes ==="
for d in sead agl nnware eui; do
  if [ -d "$d" ]; then printf "  %-8s %s\n" "$d" "$(du -sh "$d" 2>/dev/null | cut -f1)"; fi
done

echo
echo "=== sead layout ==="
ls "$REFS/sead" 2>/dev/null | head -16

echo
echo "=== does sead carry a licence? (flagged as missing earlier) ==="
ls "$REFS/sead" 2>/dev/null | grep -iE 'licen|copying' || echo "  no licence file"

echo
echo "=== sead source-file count by area ==="
for area in framework heap thread gfx primitive container; do
  n=$(find "$REFS/sead" -ipath "*$area*" -name '*.cpp' 2>/dev/null | wc -l)
  printf "  %-12s %4s .cpp\n" "$area" "$n"
done
