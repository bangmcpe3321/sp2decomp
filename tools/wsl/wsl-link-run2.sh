#!/usr/bin/env bash
set -uo pipefail
P="$HOME/sp2port"
cd "$P" || exit 1
GEN=$(find "$P/obj-all" -name '*.o' | grep -v _runtime | tr '\n' ' ')
RTO=$(ls "$P"/obj-all/_runtime/*.o | tr '\n' ' ')
g++ -o "$P/sp2" $GEN $RTO -lm -lc -lgcc -lpthread -ldl 2>"$P/pl.txt"
RC=$?
echo "link=$RC  $(du -h "$P/sp2" 2>/dev/null | cut -f1)"
[ $RC -ne 0 ] && { head -8 "$P/pl.txt"; exit 1; }
echo
echo "=== RUN ==="
timeout 90 "$P/sp2" 2>&1 | grep -vE '^  UNRESOLVED' | head -48
