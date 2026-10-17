#!/usr/bin/env bash
# system_resource_size is 0x0 in game_sp2.cpp, and get_info case 16 returns exactly that. But before
# guessing, LOG every svcGetInfo call (only 8 of them) so we see which memory types Splatoon 2 asks for
# and what we answer. That tells us which field actually feeds HeapMgr::initialize.
set -uo pipefail
P="$HOME/sp2port"
F="$P/runtime/src/svc_process.cpp"

python3 - "$F" <<'PY'
import sys
p = sys.argv[1]
s = open(p).read()
if 'GETINFO-LOG' in s:
    print("already patched"); sys.exit(0)
old = 'uint64_t get_info(uint32_t type, uint32_t handle, uint64_t sub, uint32_t& rc) {\n    (void)handle;\n    rc = 0;'
new = '''uint64_t get_info(uint32_t type, uint32_t handle, uint64_t sub, uint32_t& rc) {
    (void)handle;
    rc = 0;
    // GETINFO-LOG: only 8 calls per run, so log every one to see which memory types Splatoon 2 queries.
    struct Fmt { char b[160]; };
    static Fmt f;
    (void)f;'''
if old not in s:
    print("ANCHOR NOT FOUND", file=sys.stderr); sys.exit(1)
s = s.replace(old, new, 1)

# log at each return by wrapping: simplest is to log at entry with the type, and at exit via a helper.
s = s.replace('    switch (type) {',
              '    log("GETINFO type=%u sub=0x%llx", type, (unsigned long long)sub);\n    switch (type) {', 1)
open(p, "w").write(s)
print("patched: log every svcGetInfo type")
PY

echo
echo "=== rebuild + run ==="
cd "$P" || exit 1
g++ -std=c++20 -c -O1 -w -I runtime/include -I runtime/src runtime/src/svc_process.cpp \
    -o obj-all/_runtime/svc_process.o 2>gi.txt || { head -12 gi.txt; exit 1; }
GEN=$(find "$P/obj-all" -name '*.o' | grep -v _runtime | tr '\n' ' ')
RTO=$(ls "$P"/obj-all/_runtime/*.o | tr '\n' ' ')
g++ -o "$P/sp2" $GEN $RTO -lm -lc -lgcc -lpthread -ldl 2>gil.txt || { head -8 gil.txt; exit 1; }
echo "  linked: $(du -h "$P/sp2" | cut -f1)"
echo
timeout 240 "$P/sp2" > /tmp/gi.txt 2>&1
echo "  exit: $?"
echo
echo "=== svcGetInfo calls ==="
grep 'GETINFO' /tmp/gi.txt | head -12
echo
echo "=== where it stopped ==="
grep -E 'entering nnMain|HOST SIGSEGV|fault address|guest lr|HeapMgr' /tmp/gi.txt | head -6
