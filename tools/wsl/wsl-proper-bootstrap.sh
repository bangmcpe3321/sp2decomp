#!/usr/bin/env bash
# PROPER BOOTSTRAP. The 5-arg tryCreate(buf,size,name,parent,bool) returned null because there is no parent.
# sead provides a 4-arg overload with NO PARENT AT ALL -- that is the non-circular primitive:
#   _ZN4sead7ExpHeap9tryCreateEPvmRKNS_14SafeStringBaseIcEEb   @ 0xe76b18
#   tryCreate(void* buf, size_t size, SafeStringBase<char> const& name, bool)   -> x0,x1,x2,x3
# Then HeapMgr::setCurrentHeap_(heap) @ 0xe7cfc0.
set -uo pipefail
P="$HOME/sp2port"
M="$P/runtime/src/main.cpp"

python3 - "$M" <<'PY'
import sys, re
p = sys.argv[1]
s = open(p).read()

old_sym = '"_ZN4sead7ExpHeap9tryCreateEPvmRKNS_14SafeStringBaseIcEEPNS_4HeapEb"'
new_sym = '"_ZN4sead7ExpHeap9tryCreateEPvmRKNS_14SafeStringBaseIcEEb"'
if old_sym not in s:
    print("5-arg symbol anchor NOT found", file=sys.stderr); sys.exit(1)
s = s.replace(old_sym, new_sym, 1)

# drop the parent argument: 4-arg form is (buf, size, name, bool)
old_call = '''    c.x[0] = kBuf;                 // void* buf
    c.x[1] = kSize;                // size_t size
    c.x[2] = kScratch + 0x40;      // SafeStringBase<char> const&
    c.x[3] = 0;                    // Heap* parent = nullptr   <- the circle-breaker
    c.x[4] = 0;                    // bool'''
new_call = '''    c.x[0] = kBuf;                 // void* buf
    c.x[1] = kSize;                // size_t size
    c.x[2] = kScratch + 0x40;      // SafeStringBase<char> const&
    c.x[3] = 0;                    // bool (no parent parameter in this overload)'''
if old_call not in s:
    print("call-site anchor NOT found", file=sys.stderr); sys.exit(1)
s = s.replace(old_call, new_call, 1)

s = s.replace('log("bootstrap: ExpHeap::tryCreate(buf=%s, size=0x%llx, parent=null) at %s",',
              'log("bootstrap: ExpHeap::tryCreate(buf=%s, size=0x%llx, NO-PARENT overload) at %s",', 1)
open(p, "w").write(s)
print("patched: using the 4-arg no-parent tryCreate overload")
PY

echo
echo "=== rebuild + run ==="
cd "$P" || exit 1
g++ -std=c++20 -c -O1 -w -I runtime/include -I runtime/src runtime/src/main.cpp \
    -o obj-all/_runtime/main.o 2>b9.txt || { head -12 b9.txt; exit 1; }
GEN=$(find "$P/obj-all" -name '*.o' | grep -v _runtime | tr '\n' ' ')
RTO=$(ls "$P"/obj-all/_runtime/*.o | tr '\n' ' ')
g++ -o "$P/sp2" $GEN $RTO -lm -lc -lgcc -lpthread -ldl 2>b9l.txt || { head -8 b9l.txt; exit 1; }
echo "  linked: $(du -h "$P/sp2" | cut -f1)"
echo
timeout 300 "$P/sp2" > /tmp/b9.txt 2>&1
echo "  exit: $?"
echo
grep -E 'bootstrap|entering nnMain|HOST SIGSEGV|fault address|guest lr|allocator installed' /tmp/b9.txt | head -12
