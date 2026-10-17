#!/usr/bin/env bash
# RUN IT. How far does the actual game get?
set -uo pipefail
P="$HOME/sp2port"
cd "$P" || exit 1

echo "=== the binary ==="
ls -la sp2 | awk '{print "  ", $5, "bytes"}'
file -b sp2 | sed 's/^/   /'

echo
echo "=== it needs the game image at data_root/main.bin (the loader reads it) ==="
mkdir -p private/sp2
if [ ! -f private/sp2/main.bin ]; then
  echo "  main.bin missing -- the loader wants the module image extracted; see tools/nso2bin.py"
  ls "$HOME/refs/wonder/tools/nso2bin.py" 2>/dev/null || echo "  (nso2bin.py not found)"
fi

echo
echo "=== RUN with a 30 s timeout ==="
timeout 30 ./sp2 2>&1 | head -60
RC=${PIPESTATUS[0]}
echo
echo "=== exit status: $RC (124 = timeout, which is EXPECTED if it is running) ==="
