#!/usr/bin/env bash
set -uo pipefail
cd "$HOME/sp2port" || { echo "cd failed"; exit 1; }
pwd
g++ -std=c++20 -c -O1 -w -I runtime/include -I runtime/src runtime/src/main.cpp \
    -o obj-all/_runtime/main.o 2>/tmp/z1.txt || { echo "COMPILE FAILED"; head -10 /tmp/z1.txt; exit 1; }
GEN=$(find . -name '*.o' -path './obj-all/*' | grep -v _runtime | tr '\n' ' ')
RTO=$(ls obj-all/_runtime/*.o | tr '\n' ' ')
g++ -o sp2 $GEN $RTO -lm -lc -lgcc -lpthread -ldl 2>/tmp/z1l.txt || { echo "LINK FAILED"; head -6 /tmp/z1l.txt; exit 1; }
echo "linked $(du -h sp2 | cut -f1)"
timeout 300 ./sp2 > /tmp/z1.txt 2>&1
echo "exit=$?"
grep -E 'bootstrap|entering nnMain|HOST SIGSEGV|fault address|guest lr' /tmp/z1.txt | head -12
