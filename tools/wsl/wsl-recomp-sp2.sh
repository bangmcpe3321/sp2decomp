#!/usr/bin/env bash
# THE EXPERIMENT: run the MIT recompiler (SuperMarioWonderRecomp) against Splatoon 2's main.
#
# Splatoon 2's main is image base 0x7100000000, which is why --base matters: the tool is
# parameterised for exactly this difference.
set -uo pipefail

SRC=/mnt/c/Users/Hexa/Documents/nintendo/hactool-1.4.0-win/exefs/main
WORK="$HOME/sp2recomp"
mkdir -p "$WORK"

echo "=== input ==="
ls -la "$SRC" 2>&1 | tail -1
cp -f "$SRC" "$WORK/main" && echo "copied to $WORK/main"
ls -la "$WORK/main" | tail -1

echo
echo "=== disk space ==="
df -h "$HOME" | tail -1

echo
echo "=== STEP 1: functional check on a few functions (fast, small output) ==="
cd "$HOME/refs/wonder" || exit 1
# Take a handful of addresses from the game's own symbol table so the subset is real code.
ADDRS=$(grep -m3 '^FUNCTION' /mnt/c/Users/Hexa/Documents/nintendo/re-work/inventory.txt \
        | awk '{print "0x"$2}' | tr '\n' ' ')
echo "  subset: $ADDRS"
timeout 900 python3 -m recomp "$WORK/main" "$WORK/gen_test" --name main --base 0x7100000000 \
  --only $ADDRS 2>&1 | tail -25
echo "  exit=$?"

echo
echo "=== did it emit anything? ==="
find "$WORK/gen_test" -type f 2>/dev/null | head -10
du -sh "$WORK/gen_test" 2>/dev/null
