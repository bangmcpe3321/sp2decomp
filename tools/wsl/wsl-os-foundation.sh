#!/usr/bin/env bash
# nn::os foundation (round 14). The runtime gets a REAL nn::os platform layer (hle_os.cpp: memory, TLS
# and thread-identity HLEs) and start-up now enters the game's own Lp::Sys::SysInit::nninitStartup
# instead of hand-calling nn::init::InitializeAllocator. sead's own Framework::initialize then runs for
# real (HeapMgr::initialize -> Arena::initialize -> AllocateMemoryBlock -> root heap -> ThreadMgr -> ...)
# instead of the manual bootstrap_engine_heap. See RECOMP_OS_FOUNDATION.md.
set -uo pipefail
P="$HOME/sp2port"
W=/mnt/c/Users/Hexa/Documents/nintendo/sp2decomp/tools/wsl

cp "$W/hle_os.cpp" "$P/runtime/src/hle_os.cpp" || { echo "copy failed"; exit 1; }

python3 - "$P/runtime/src/main.cpp" <<'PY'
import re, sys
p = sys.argv[1]
s = open(p).read()

# 1. install_game_allocator: keep svcSetHeapSize, replace the direct InitializeAllocator call with the
#    game's own nninitStartup (memory bring-up + allocator install).
new = '''// SDK start-up, the part this port must stand in for: the heap the kernel gives the process, then the
// game's OWN nninitStartup -- which asks nn::os for the memory (QueryMemoryInfo / SetMemoryHeapSize /
// AllocateMemoryBlock), carves the 32 MB allocator block and installs the game's allocator itself.
// Running the game's start-up instead of hand-calling InitializeAllocator is what makes the nn::os HLEs
// (hle_os.cpp) line up with how the real binary boots.
static void install_game_allocator(CPU& c) {
    // MEASURED from the real game (svcSetHeapSize x1). Use the runtime's REAL SVC 0x01 so the kernel's
    // bookkeeping -- g_heap_size, vm_set, the memory map -- is established exactly as on hardware
    // (kernel.cpp case 0x01 commits at kHeapBase, enforces kHeapMax, returns kHeapBase in x1).
    constexpr size_t kAllocSize = 0xC9200000ull;
    c.x[1] = kAllocSize;
    svc(c, 0x01, 0);
    uint64_t heap = c.x[1];
    if (heap == 0) {
        log("svcSetHeapSize did not return a heap base -- allocator NOT installed");
        return;
    }
    log("process heap: 0x%llx size 0x%llx (guest space)", (unsigned long long)heap,
        (unsigned long long)kAllocSize);
    uint64_t off = 0;
    if (!find_func_offset(nx_module_main, "_ZN2Lp3Sys7SysInit13nninitStartupEv", off)) {
        log("nninitStartup symbol not found -- using measured main+0x11f5ab4");
        off = 0x11f5ab4ull;
    }
    log("nninitStartup at %s -- memory heap + game allocator", describe(nx_module_main.base + off).c_str());
    call_preserving(c, nx_module_main.base + off);
    log("nninitStartup returned");
}
'''
pat = re.compile(r"// The game's allocator\..*?\nstatic void install_game_allocator\(CPU& c\) \{.*?\n\}\n", re.S)
s, n = pat.subn(new, s, count=1)
print("install_game_allocator:", "replaced" if n else "!!! PATTERN NOT FOUND")

# 2. drop bootstrap_engine_heap (the hand-rolled sead heap bootstrap is dead: the engine's own
#    Framework::initialize does it now) and its call site.
pat = re.compile(r"\n// ---- engine bootstrap -+.*?\n\}\n", re.S)
s, n = pat.subn("\n", s, count=1)
print("bootstrap_engine_heap:", "removed" if n else "!!! PATTERN NOT FOUND")
s, n = re.subn(r"\n    bootstrap_engine_heap\(c\);", "", s, count=1)
print("bootstrap call site:", "removed" if n else "!!! PATTERN NOT FOUND")
open(p, "w").write(s)
PY

python3 - "$P/runtime/src/kernel.h" "$P/runtime/src/kernel.cpp" <<'PY'
import sys
h, cpp = sys.argv[1], sys.argv[2]
s = open(h).read()
if "stack_lo" not in s:
    s = s.replace("    uint64_t entry = 0;\n",
                  "    uint64_t entry = 0;\n    uint64_t stack_lo = 0, stack_hi = 0;  // guest stack bounds (main thread)\n", 1)
    open(h, "w").write(s)
    print("kernel.h: stack bounds added")
s = open(cpp).read()
if "t->stack_lo" not in s:
    s = s.replace("    auto t = new_thread(0, 0, stack + stack_size, 44, 0);\n",
                  "    auto t = new_thread(0, 0, stack + stack_size, 44, 0);\n    t->stack_lo = stack;\n    t->stack_hi = stack + stack_size;\n", 1)
    open(cpp, "w").write(s)
    print("kernel.cpp: create_main_thread records its stack bounds")
PY

echo
echo "=== rebuild + run ==="
cd "$P" || exit 1
for f in kernel hle_os main; do
    g++ -std=c++20 -c -O1 -w -I runtime/include -I runtime/src "runtime/src/$f.cpp" \
        -o "obj-all/_runtime/$f.o" 2>os.txt || { echo "COMPILE FAILED: $f"; head -30 os.txt; exit 1; }
done
GEN=$(find "$P/obj-all" -name '*.o' | grep -v _runtime | tr '\n' ' ')
RTO=$(ls "$P"/obj-all/_runtime/*.o | tr '\n' ' ')
g++ -o "$P/sp2" $GEN $RTO -lm -lc -lgcc -lpthread -ldl 2>osl.txt || { head -20 osl.txt; exit 1; }
echo "  linked: $(du -h "$P/sp2" | cut -f1)"
echo
timeout 300 "$P/sp2" > "$P/os.log" 2>&1
echo "  exit: $?"
echo
echo "=== signal ==="
grep -nE 'process heap|nninitStartup|SetMemoryHeapSize|QueryMemoryInfo|AllocateMemoryBlock|AllocateTlsSlot|InitializeAllocator|missing import|bootstrap|entering nnMain|SIGSEGV|fault address|guest lr|HOST' "$P/os.log" | head -70
echo "=== tail ==="
tail -30 "$P/os.log"
