#!/usr/bin/env bash
# Apply the g_fast[4] -> g_fast[8] module-limit patch to the port's runtime, as a DOCUMENTED patch
# so the modification to third-party MIT code is visible and reversible.
#
# Rationale: RECOMP_MODULE_LIMIT.md. Splatoon 2 has SIX modules; the runtime registers at most four
# for indirect-call resolution, silently dropping the rest. FastModule is 24 bytes, so 4 -> 8 costs
# 96 bytes.
set -uo pipefail

R="$HOME/sp2port/runtime/src/loader.cpp"
PATCHED="$HOME/sp2port/patches/0001-g_fast-module-limit.patch"
mkdir -p "$HOME/sp2port/patches"

if [ ! -f "$R" ]; then echo "missing $R"; exit 1; fi

echo "=== before ==="
grep -n 'FastModule g_fast\|g_fast_count < ' "$R"

# Back up the pristine file and produce a real diff for the record.
cp -f "$R" "$R.orig"

# The two edits. Kept narrow: only the array bound and its guard, nothing else.
sed -i 's/FastModule g_fast\[4\];/FastModule g_fast[8];          \/\/ PATCHED: was [4]; Splatoon 2 has 6 modules/' "$R"
sed -i 's/if (g_fast_count < 4) g_fast\[g_fast_count++\]/if (g_fast_count < 8) g_fast[g_fast_count++]/' "$R"

echo
echo "=== after ==="
grep -n 'FastModule g_fast\|g_fast_count < ' "$R"

echo
echo "=== write the patch file ==="
diff -u "$R.orig" "$R" > "$PATCHED" || true
{
  echo "Patch: raise the indirect-call module table from 4 to 8"
  echo
  echo "Target: runtime/src/loader.cpp in BelmanteGu/SuperMarioWonderRecomp (MIT,"
  echo "        Copyright (c) 2026 BelmanteGu)."
  echo
  echo "Why: FastModule g_fast[4] registers at most four modules for indirect-call resolution."
  echo "     The guard 'if (g_fast_count < 4)' silently skips the rest, so any indirect call"
  echo "     (blr / br) whose TARGET lives in a 5th or later module falls through to the HLE"
  echo "     thunk path and fails. Splatoon 2 has six modules (main, sdk, subsdk0..3)."
  echo "     FastModule is 24 bytes, so 4 -> 8 costs 96 bytes."
  echo
  echo "Scope: two lines. Nothing else is modified."
  echo
  cat "$PATCHED"
} > "$HOME/sp2port/patches/0001-README-and-diff.txt"

echo "  wrote: $PATCHED"
echo "  wrote: $HOME/sp2port/patches/0001-README-and-diff.txt"
echo
echo "=== verify it still looks sane ==="
sed -n '158,168p' "$R"
