#!/usr/bin/env bash
# #1: the allocator is a FIXED 64 MB. `nex` allocates heavily and the hang is inside nex. Exhaustion
# is the leading untested alternative. Change one number and see whether the hang moves.
set -uo pipefail
P="$HOME/sp2port"
M="$P/runtime/src/main.cpp"

echo "=== before ==="
grep -n 'kAllocSize' "$M"

sed -i 's|constexpr size_t kAllocSize = 64ull << 20;.*|constexpr size_t kAllocSize = 512ull << 20;  // was 64 MB -- BISECT: does the nex hang move?|' "$M"

echo "=== after ==="
grep -n 'kAllocSize' "$M"

echo
echo "=== rebuild ==="
cd "$P" || exit 1
g++ -std=c++20 -c -O1 -w -I runtime/include -I runtime/src runtime/src/main.cpp \
    -o obj-all/_runtime/main.o 2>b1.txt || { head -10 b1.txt; exit 1; }
GEN=$(find "$P/obj-all" -name '*.o' | grep -v _runtime | tr '\n' ' ')
RTO=$(ls "$P"/obj-all/_runtime/*.o | tr '\n' ' ')
g++ -o "$P/sp2" $GEN $RTO -lm -lc -lgcc -lpthread -ldl 2>b1l.txt || { head -8 b1l.txt; exit 1; }
echo "  linked: $(du -h "$P/sp2" | cut -f1)"

echo
echo "=== run 240s ==="
timeout 240 "$P/sp2" > /tmp/run11.txt 2>&1
echo "  exit: $? (124 = still running)"
echo "  main init[N]: $(grep -c 'main init\[' /tmp/run11.txt)"
echo "  last constructor:"
grep 'main init\[' /tmp/run11.txt | tail -1 | cut -c1-140
echo
echo "=== milestones / faults ==="
grep -E 'allocator installed|SIGSEGV|FATAL|fault address|guest lr' /tmp/run11.txt | head -8
