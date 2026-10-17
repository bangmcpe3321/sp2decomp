#!/usr/bin/env bash
set -uo pipefail
cd "$HOME/sp2port" || exit 1

echo "=== recompile main.cpp ==="
g++ -std=c++20 -c -O1 -w -I runtime/include -I runtime/src \
    runtime/src/main.cpp -o obj-all/_runtime/main.o 2>m.txt
echo "  exit=$?"
head -8 m.txt 2>/dev/null | sed 's/^/    /'

echo
echo "=== relink ==="
GEN=$(find obj-all -name 'code_*.o' -o -name 'table.o' | grep -v _runtime | tr '\n' ' ')
RT=$(ls obj-all/_runtime/*.o 2>/dev/null | tr '\n' ' ')
g++ -o sp2 $GEN $RT -lm -lc -lgcc -lpthread -ldl 2>le.txt
RC=$?
echo "  link exit=$RC"
if [ $RC -ne 0 ]; then head -8 le.txt | sed 's/^/    /'; exit 1; fi
echo "  binary: $(du -h sp2 | cut -f1)"

echo
echo "=== RUN (60 s) ==="
timeout 60 ./sp2 2>&1 | head -40
echo
echo "=== exit: ${PIPESTATUS[0]} (124 = still running at timeout) ==="
