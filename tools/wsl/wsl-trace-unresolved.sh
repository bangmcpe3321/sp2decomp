#!/usr/bin/env bash
# The base collision is fixed (modules now load 64 MB apart). The failure moved EARLIER, to
# sdk+30 (_init+c) -- an indirect call to a non-function address. The prime suspect is the
# 34 unresolved imports the linker reported. Enumerate them.
set -uo pipefail
P="$HOME/sp2port"
cd "$P" || exit 1

echo "=== run with NX_TRACE=1 to surface the unresolved list ==="
NX_TRACE=1 timeout 60 ./sp2 2>&1 | grep -iE 'unresolved|missing|hle|import' | head -50

echo
echo "=== how does the runtime report unresolved imports? ==="
grep -n 'unresolved' "$P/runtime/src/loader.cpp" | head -6
