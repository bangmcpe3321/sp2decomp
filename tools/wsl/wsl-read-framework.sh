#!/usr/bin/env bash
# Read the sead reference definitions for the NEXT boot-root target BEFORE attempting a
# port. This is the reordering round 4/5/6 established as necessary.
set -uo pipefail

SEAD="$HOME/refs/sead"
cd "$SEAD"

echo "=== seadFramework.h: InitializeArg / RunArg / CreateSystemTaskArg ==="
sed -n '25,90p' include/framework/seadFramework.h

echo
echo "=== does InitializeArg depend on anything already ported? ==="
grep -nE 'include|class |struct |Heap|Arena|FrameBuffer|TaskMgr|MethodTree' include/framework/seadFramework.h | head -30
