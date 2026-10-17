#!/usr/bin/env bash
# STEP 1: use the MEASURED heap size. The game asks svcSetHeapSize for 0xC9200000 (3218 MB); the port was
# giving 512 MB. get_info type 7/22 also returns heap_size()+0x4000000, so this fixes what the game sees too.
set -uo pipefail
P="$HOME/sp2port"
M="$P/runtime/src/main.cpp"

echo "=== before ==="
grep -n 'kAllocSize' "$M" | head -3

sed -i 's|constexpr size_t kAllocSize = 512ull << 20;.*|constexpr size_t kAllocSize = 0xC9200000ull;  // MEASURED from the real game (svcSetHeapSize x1)|' "$M"
sed -i 's|constexpr size_t kAllocSize = 64ull << 20;.*|constexpr size_t kAllocSize = 0xC9200000ull;  // MEASURED from the real game|' "$M"

echo "=== after ==="
grep -n 'kAllocSize =' "$M" | head -3

echo
echo "=== rebuild + run ==="
cd "$P" || exit 1
g++ -std=c++20 -c -O1 -w -I runtime/include -I runtime/src runtime/src/main.cpp \
    -o obj-all/_runtime/main.o 2>h8.txt || { head -12 h8.txt; exit 1; }
GEN=$(find "$P/obj-all" -name '*.o' | grep -v _runtime | tr '\n' ' ')
RTO=$(ls "$P"/obj-all/_runtime/*.o | tr '\n' ' ')
g++ -o "$P/sp2" $GEN $RTO -lm -lc -lgcc -lpthread -ldl 2>h8l.txt || { head -8 h8l.txt; exit 1; }
echo "  linked: $(du -h "$P/sp2" | cut -f1)"
echo
timeout 300 "$P/sp2" > /tmp/h8.txt 2>&1
echo "  exit: $?"
echo
echo "=== heap / milestones / fault ==="
grep -E 'installing game allocator|allocator installed|entering nnMain|bootstrap|HOST SIGSEGV|fault address|guest lr|FATAL' /tmp/h8.txt | head -14
