#!/usr/bin/env bash
set -uo pipefail
python3 /mnt/c/Users/Hexa/Documents/nintendo/re-work/impl-four-steps.py || exit 1
cd "$HOME/sp2port" || exit 1
g++ -std=c++20 -c -O1 -w -I runtime/include -I runtime/src runtime/src/main.cpp \
    -o obj-all/_runtime/main.o 2>/tmp/b10.txt || { echo "COMPILE FAILED"; head -14 /tmp/b10.txt; exit 1; }
GEN=$(find . -name '*.o' -path './obj-all/*' | grep -v _runtime | tr '\n' ' ')
RTO=$(ls obj-all/_runtime/*.o | tr '\n' ' ')
g++ -o sp2 $GEN $RTO -lm -lc -lgcc -lpthread -ldl 2>/tmp/b10l.txt || { echo "LINK FAILED"; head -6 /tmp/b10l.txt; exit 1; }
echo "linked $(du -h sp2 | cut -f1)"
timeout 300 ./sp2 > /tmp/b10r.txt 2>&1
echo "exit=$?"
grep -E 'bootstrap|entering nnMain|HOST SIGSEGV|fault address|guest lr' /tmp/b10r.txt | head -14
