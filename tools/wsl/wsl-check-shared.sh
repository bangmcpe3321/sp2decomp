#!/usr/bin/env bash
# Step 1 of the goal: resolve the g_fast[4] limit.
# Check the sibling SwitchGamesRecomp repo (where the SHARED runtime lives) for a newer version
# before patching locally -- that was a flagged unknown in RECOMP_MODULE_LIMIT.md.
set -uo pipefail
cd "$HOME/refs" || exit 1

echo "=== is SwitchGamesRecomp reachable? ==="
if [ -d SwitchGamesRecomp ]; then
  echo "  already cloned"
else
  timeout 120 git clone --depth 1 -q https://github.com/BelmanteGu/SwitchGamesRecomp.git 2>&1 | tail -3
fi

if [ -d SwitchGamesRecomp ]; then
  echo
  echo "=== does its runtime have a larger g_fast? ==="
  grep -rn 'g_fast\[' SwitchGamesRecomp/runtime/src/loader.cpp 2>/dev/null | head -5
  echo "  --- guard ---"
  grep -rn 'g_fast_count <' SwitchGamesRecomp/runtime/src/loader.cpp 2>/dev/null | head -3
  echo
  echo "=== compare with the Wonder copy ==="
  echo "  wonder : $(grep -n 'FastModule g_fast' wonder/runtime/src/loader.cpp 2>/dev/null)"
  echo "  shared : $(grep -n 'FastModule g_fast' SwitchGamesRecomp/runtime/src/loader.cpp 2>/dev/null)"
  echo
  echo "=== do the two loaders differ at all? ==="
  if diff -q wonder/runtime/src/loader.cpp SwitchGamesRecomp/runtime/src/loader.cpp >/dev/null 2>&1; then
    echo "  IDENTICAL"
  else
    echo "  DIFFERENT -- diff summary:"
    diff wonder/runtime/src/loader.cpp SwitchGamesRecomp/runtime/src/loader.cpp 2>/dev/null | head -20
  fi
else
  echo "  NOT AVAILABLE -- will patch the Wonder copy locally"
fi
