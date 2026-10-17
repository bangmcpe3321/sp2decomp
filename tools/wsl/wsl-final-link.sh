#!/usr/bin/env bash
set -uo pipefail
cd "$HOME/sp2port" || exit 1
echo "=== compile platform_linux ==="
g++ -std=c++20 -c -O1 -w -I runtime/include -I runtime/src \
    runtime/src/platform_linux.cpp -o obj-all/_runtime/platform_linux.o 2>p4.txt
echo "  exit=$?"
head -8 p4.txt 2>/dev/null | sed 's/^/    /'
ls -la obj-all/_runtime/platform_linux.o 2>/dev/null | awk '{print "  object:", $5, "bytes"}'

echo
echo "=== FINAL LINK ==="
GEN=$(find obj-all -name 'code_*.o' -o -name 'table.o' | grep -v _runtime | tr '\n' ' ')
RT=$(ls obj-all/_runtime/*.o 2>/dev/null | tr '\n' ' ')
echo "  generated objects: $(echo "$GEN" | wc -w)"
echo "  runtime objects  : $(echo "$RT" | wc -w)"
g++ -o sp2 $GEN $RT -lm -lc -lgcc -lpthread -ldl 2>link-err3.txt
RC=$?
echo "  link exit: $RC"
if [ $RC -eq 0 ] && [ -f sp2 ]; then
  echo
  echo "  ************************************************************"
  echo "  ***  LINK SUCCEEDED -- a Splatoon 2 executable exists     ***"
  echo "  ************************************************************"
  echo "  size: $(du -h sp2 | cut -f1)"
  echo "  file: $(file -b sp2 | cut -c1-72)"
else
  echo "  errors: $(wc -l < link-err3.txt)"
  head -12 link-err3.txt | sed 's/^/    /'
fi
