#!/usr/bin/env bash
# Recompile Splatoon 2's sdk module, and work out a defensible --base.
#
# Wonder used main=0x4000000000, sdk=0x4010000000 -- a 0x1000000 gap. main is at
# 0x7100000000 here, so the same convention gives sdk=0x7101000000. The base affects how
# absolute addresses are REPRESENTED, not how instructions decode, so it can be revised later
# without regenerating for correctness -- but it must be distinct from main's.
set -uo pipefail

SRC=/mnt/c/Users/Hexa/Documents/nintendo/hactool-1.4.0-win/exefs/sdk
WORK="$HOME/sp2recomp"
mkdir -p "$WORK"

echo "=== sdk input ==="
ls -la "$SRC" | tail -1
cp -f "$SRC" "$WORK/sdk" && echo "copied to $WORK/sdk"

echo
echo "=== NSO segment table (from the header) ==="
python3 - "$WORK/sdk" <<'PY'
import struct, sys
b = open(sys.argv[1], "rb").read(0x100)
magic = b[0:4]
flags = struct.unpack_from("<I", b, 0x0C)[0]
print("  magic:", magic, " flags: 0x%x (compressed=%s)" % (flags, bool(flags & 1)))
names = ["text", "rodata", "data"]
for i, n in enumerate(names):
    off, mem, size = struct.unpack_from("<III", b, 0x10 + i * 12)
    print("  %-7s file=0x%-9x mem=0x%-8x size=0x%-8x" % (n, off, mem, size))
bss = struct.unpack_from("<I", b, 0x3C)[0]
print("  bss     size=0x%x" % bss)
# The module's total memory span, ignoring the load base.
data_mem, data_size = struct.unpack_from("<II", b, 0x34)
print("  module span (text..data+bss) = 0x%x (%.1f MB)"
      % (data_mem + data_size + bss, (data_mem + data_size + bss) / 1048576))
PY

echo
echo "=== RECOMPILE sdk, base 0x7101000000 ==="
cd "$HOME/refs/wonder" || exit 1
date -u +'start %H:%M:%S'
/usr/bin/time -f '  elapsed %E  peakRSS %MkB' \
  python3 -m recomp "$WORK/sdk" "$WORK/gen_sdk" --name sdk --base 0x7101000000 2>&1 | tail -20
date -u +'end   %H:%M:%S'

echo
echo "=== report ==="
cat "$WORK/gen_sdk/report.txt" 2>/dev/null
echo
echo "=== output ==="
du -sh "$WORK/gen_sdk" 2>/dev/null
ls "$WORK/gen_sdk"/code_*.cpp 2>/dev/null | wc -l
