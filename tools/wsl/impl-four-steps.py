import re, sys
p = "/home/hexa/sp2port/runtime/src/main.cpp"
s = open(p).read()

new_fn = r'''
// ---- engine bootstrap --------------------------------------------------------------------------
// Reproduces the four steps of sead's heap bootstrap, in the order read from HeapMgr::initialize(size):
//   1. CriticalSection::lock() on HeapMgr::sHeapTreeLockCS          (0xe98bd8, object @ main+0x3663f10)
//   2. sDefaultArena.initialize(size)                               (0xeb9f1c, object @ main+0x3663e98)
//   3. first ExpHeap via the NO-PARENT tryCreate(buf,size,name,b)    (0xe76b18)  <- the circle-breaker
//   4. HeapMgr::setCurrentHeap_(heap)                               (0xe7cfc0)
//   5. CriticalSection::unlock()
// The lock is constructible with a null heap (IDisposer::HeapNullOption), which is why step 1 can precede
// any heap existing.
static void bootstrap_engine_heap(CPU& c) {
    const uint64_t base = nx_module_main.base;
    uint64_t lock_off = 0, unlock_off = 0, arena_off = 0, create_off = 0, set_off = 0;
    struct Sym { const char* name; uint64_t* dst; } want[] = {
        {"_ZN4sead15CriticalSection4lockEv", &lock_off},
        {"_ZN4sead15CriticalSection6unlockEv", &unlock_off},
        {"_ZN4sead5Arena10initializeEm", &arena_off},
        {"_ZN4sead7ExpHeap9tryCreateEPvmRKNS_14SafeStringBaseIcEEb", &create_off},
        {"_ZN4sead7HeapMgr15setCurrentHeap_EPNS_4HeapE", &set_off},
    };
    for (auto& w : want) {
        if (!find_func_offset(nx_module_main, w.name, *w.dst)) {
            log("bootstrap: symbol not found: %s", w.name);
            return;
        }
    }
    const uint64_t kLockCS   = base + 0x3663f10ull;   // HeapMgr::sHeapTreeLockCS
    const uint64_t kArena    = base + 0x3663e98ull;   // HeapMgr::sDefaultArena
    const uint64_t kBuf      = kHeapBase + 0x01000000ull;
    const uint64_t kSize     = 0x0F000000ull;         // 240 MB root heap
    const uint64_t kScratch  = kHeapBase + 0x10000000ull;

    if (!plat::commit(kScratch, 0x1000)) { log("bootstrap: no scratch page"); return; }
    std::strcpy(reinterpret_cast<char*>(kScratch), "sead");
    uint64_t* ssb = reinterpret_cast<uint64_t*>(kScratch + 0x40);
    ssb[0] = kScratch; ssb[1] = 4;                    // SafeStringBase<char>{ptr,len}

    // 1. lock
    c.x[0] = kLockCS;
    call_preserving(c, base + lock_off);
    log("bootstrap: 1/5 locked sHeapTreeLockCS");

    // 2. arena
    c.x[0] = kArena; c.x[1] = kSize;
    call_preserving(c, base + arena_off);
    log("bootstrap: 2/5 sDefaultArena.initialize(0x%llx)", (unsigned long long)kSize);

    // 3. first heap, no parent
    c.x[0] = kBuf; c.x[1] = kSize; c.x[2] = kScratch + 0x40; c.x[3] = 0;
    call(c, base + create_off);
    uint64_t heap = c.x[0];
    log("bootstrap: 3/5 no-parent tryCreate -> heap 0x%llx", (unsigned long long)heap);

    // 4. install
    if (heap) {
        c.x[0] = heap;
        call_preserving(c, base + set_off);
        log("bootstrap: 4/5 setCurrentHeap_ done");
    } else {
        log("bootstrap: 3/5 FAILED -- no heap, skipping install");
    }

    // 5. unlock
    c.x[0] = kLockCS;
    call_preserving(c, base + unlock_off);
    log("bootstrap: 5/5 unlocked");
}
'''

m = re.search(r'// ---- engine bootstrap -+\n.*?\nstatic void nn_main\(CPU& c\) \{', s, re.S)
if not m:
    print("bootstrap region NOT found"); sys.exit(1)
s = s[:m.start()] + new_fn.lstrip('\n') + '\nstatic void nn_main(CPU& c) {' + s[m.end():]
open(p, "w").write(s)
print("patched: all four steps implemented in order")
