#!/usr/bin/env bash
# IMPLEMENT THE ENGINE BOOTSTRAP.
# The circle is: creating a heap needs a heap (IDisposer's base needs a Heap*).
# Break it the way hardware does: create the FIRST ExpHeap over a CALLER-PROVIDED BUFFER with a NULL parent,
# then install it as HeapMgr's current heap. sead provides exactly that overload:
#   ExpHeap::tryCreate(void* buf, size_t size, SafeStringBase<char> const& name, Heap* parent, bool)
#   _ZN4sead7ExpHeap9tryCreateEPvmRKNS_14SafeStringBaseIcEEPNS_4HeapEb  @ 0xe76c6c
# then HeapMgr::setCurrentHeap_(Heap*) @ 0xe7cfc0.
set -uo pipefail
P="$HOME/sp2port"
M="$P/runtime/src/main.cpp"

python3 - "$M" <<'PY'
import sys, re
p = sys.argv[1]
s = open(p).read()

# 1. remove the diagnostic HeapMgr::initialize block if present
s = re.sub(r'    // DIAGNOSTIC: sead::Framework::initialize calls HeapMgr::initialize\(0\).*?\n    \}\n', '', s, flags=re.S)
s = s.replace('    log("entering nnMain");', '    bootstrap_engine_heap(c);\n    log("entering nnMain");', 1)

helper = '''
// ---- engine bootstrap --------------------------------------------------------------------------
// sead cannot create its first heap without a heap: IDisposer's constructor takes a Heap*, and
// Framework::initialize asks HeapMgr::getCurrentHeap() for a parent before any root exists. On hardware
// SDK start-up breaks that circle by placing a heap over process memory with a NULL parent. Do the same:
//   ExpHeap::tryCreate(buf, size, name, parent = nullptr, false)   -> Heap*
//   HeapMgr::setCurrentHeap_(heap)
// SafeStringBase<char> is just { const char* stringTop; size_t length; } in this engine.
static void bootstrap_engine_heap(CPU& c) {
    uint64_t create_off = 0;
    if (!find_func_offset(nx_module_main,
                          "_ZN4sead7ExpHeap9tryCreateEPvmRKNS_14SafeStringBaseIcEEPNS_4HeapEb",
                          create_off)) {
        log("bootstrap: ExpHeap::tryCreate(buf, ...) symbol not found");
        return;
    }
    // Carve the root heap out of the game heap, leaving the low 16 MB for the allocator's own metadata.
    const uint64_t kBuf = kHeapBase + 0x01000000ull;
    const uint64_t kSize = 0x0F000000ull;              // 240 MB
    const uint64_t kScratch = kHeapBase + 0x10000000ull;  // page for the name + SafeStringBase
    if (!plat::commit(kScratch, 0x1000)) {
        log("bootstrap: could not commit scratch page at %s", describe(kScratch).c_str());
        return;
    }
    char* name = reinterpret_cast<char*>(kScratch);
    std::strcpy(name, "sead");
    uint64_t* ssb = reinterpret_cast<uint64_t*>(kScratch + 0x40);
    ssb[0] = kScratch;   // mStringTop
    ssb[1] = 4;          // mStringLength

    c.x[0] = kBuf;                 // void* buf
    c.x[1] = kSize;                // size_t size
    c.x[2] = kScratch + 0x40;      // SafeStringBase<char> const&
    c.x[3] = 0;                    // Heap* parent = nullptr   <- the circle-breaker
    c.x[4] = 0;                    // bool
    log("bootstrap: ExpHeap::tryCreate(buf=%s, size=0x%llx, parent=null) at %s",
        describe(kBuf).c_str(), (unsigned long long)kSize,
        describe(nx_module_main.base + create_off).c_str());
    call(c, nx_module_main.base + create_off);   // `call`, not call_preserving: we need the return value
    uint64_t heap = c.x[0];
    log("bootstrap: root heap = 0x%llx", (unsigned long long)heap);
    if (heap == 0) {
        log("bootstrap: tryCreate returned null -- root heap NOT created");
        return;
    }
    uint64_t set_off = 0;
    if (!find_func_offset(nx_module_main, "_ZN4sead7HeapMgr15setCurrentHeap_EPNS_4HeapE", set_off)) {
        log("bootstrap: setCurrentHeap_ not found");
        return;
    }
    c.x[0] = heap;
    call(c, nx_module_main.base + set_off);
    log("bootstrap: HeapMgr::setCurrentHeap_ installed the root heap");
}

static void nn_main(CPU& c) {'''
s = s.replace('static void nn_main(CPU& c) {', helper, 1)
open(p, "w").write(s)
print("patched: bootstrap_engine_heap implemented, diagnostic removed")
PY

echo
echo "=== rebuild + run ==="
cd "$P" || exit 1
g++ -std=c++20 -c -O1 -w -I runtime/include -I runtime/src runtime/src/main.cpp \
    -o obj-all/_runtime/main.o 2>bs.txt || { head -14 bs.txt; exit 1; }
GEN=$(find "$P/obj-all" -name '*.o' | grep -v _runtime | tr '\n' ' ')
RTO=$(ls "$P"/obj-all/_runtime/*.o | tr '\n' ' ')
g++ -o "$P/sp2" $GEN $RTO -lm -lc -lgcc -lpthread -ldl 2>bsl.txt || { head -8 bsl.txt; exit 1; }
echo "  linked: $(du -h "$P/sp2" | cut -f1)"
echo
timeout 300 "$P/sp2" > /tmp/bs.txt 2>&1
echo "  exit: $?"
echo
grep -E 'bootstrap|entering nnMain|HOST SIGSEGV|fault address|guest lr|GETINFO type=16' /tmp/bs.txt | head -20
