// nn::os foundation for Splatoon 2's boot: the memory plane (QueryMemoryInfo / SetMemoryHeapSize /
// AllocateMemoryBlock), the TLS plane (AllocateTlsSlot / SetTlsValue / GetTlsValue) and thread identity
// (GetCurrentThread / GetThreadId / GetThreadPriority / ChangeThreadPriority / GetCurrentCoreNumber /
// GetThreadAvailableCoreMask / SetThreadCoreMask / GetCurrentStackInfo), plus a forwarder that binds
// nn::init::InitializeAllocator to main's own definition.
//
// Every one of them is an UNRESOLVED import of main: on hardware nnSdk (a system module this port does
// not run) provides them, and until now each call was a logging stub returning 0. That is why sead never
// got a heap: Arena::initialize "succeeded" without ever receiving a buffer, and the first parent lookup
// crashed inside a null ThreadMgr (fault +0x88). See RECOMP_OS_FOUNDATION.md.
//
// Memory model. One process heap, committed by svcSetHeapSize(0xC9200000) in main.cpp's start-up -- the
// exact size the real game asks for (measured under emulation). AllocateMemoryBlock carves from it
// bump-allocator style, in call order:
//
//   [kHeapBase + 0x00000000, +0x02000000)   32 MB   nninitStartup: nn::init's allocator block
//   [kHeapBase + 0x02000000, +0xC2000000)   3.0 GB  sead's Arena (InitializeArg.heap_size)
//   ... free for later carves (0x7200000 spare)
//
// The arena size is not a guess: Lp::Sys::SysInit::Init computes `arg.heap_size = mi[+0x10] - mi[+0x18]`
// of the QueryMemoryInfo result right before GameFrameworkNx::initialize (nninitStartup uses mi[0]-mi[1]
// for the memory-heap size and the 6 GB test). QueryMemoryInfo is filled so that [0]-[1] = 0xC9200000
// and [2]-[3] = 0xC0000000 -- both fit the pool with 114 MB to spare.
//
// TLS model. nn::os TLS values are per-THREAD; the runtime gives every guest thread its own host thread
// (kernel.cpp), so a thread_local array mirrors them faithfully. Slots start at 1: sead's
// CoreInfo::configure() (which allocates sCoreNumberTlsSlot) does not appear anywhere in the boot path,
// so that variable stays 0 and ThreadMgr::initMainThread_'s unconditional SetTlsValue(*sCoreNumberTlsSlot,
// core+1) writes to slot 0. Leaving slot 0 unused-except-for-that keeps the write AND the many
// "GetTlsValue(*sCoreNumberTlsSlot) - 1" readers consistent (core 0), and cannot clobber ThreadMgr's slot.
//
// Thread identity. sead treats nn::os::ThreadType* as an opaque token: it stores it and hands it back to
// us, never dereferencing it. We hand out a small per-host-thread context from the kernel region
// (kernel_alloc) -- unique, stable, in guest space, with the fields the other HLEs read:
//   +0x00 u64 id (GetThreadId), +0x08 s32 priority (Get/ChangeThreadPriority), +0x10 s32 core.
#include <cstring>

#include <nx/runtime.h>

#include "kernel.h"

extern const nx::ModuleInfo nx_module_main;

namespace nx {
namespace {

// ---- memory plane ---------------------------------------------------------------------------------------------

uint64_t g_mem_next = 0;  // first free byte of the process heap (bump pointer)

void query_memory_info(CPU& c) {
    // void QueryMemoryInfo(nn::os::MemoryInfo* out)
    uint64_t out = c.x[0];
    if (out == 0) return;
    st<uint64_t>(out + 0x00, 0xCD500000ull);  // nninitStartup sees  [0]-[1]
    st<uint64_t>(out + 0x08, 0x04300000ull);  //                    = 0xC9200000 (the process heap)
    st<uint64_t>(out + 0x10, 0xCD500000ull);  // SysInit::Init sees [2]-[3]
    st<uint64_t>(out + 0x18, 0x0D500000ull);  //                    = 0xC0000000 (the sead arena)
    log("QueryMemoryInfo -> heap 0xC9200000 (6GB=%d), arena 0xC0000000",
        (int)((0xC9200000ull > 0x100000000ull)));
}

void set_memory_heap_size(CPU& c) {
    // void SetMemoryHeapSize(size_t size)
    log("SetMemoryHeapSize(0x%llx)", (unsigned long long)c.x[0]);
}

void allocate_memory_block(CPU& c) {
    // void AllocateMemoryBlock(void** out, size_t size) -- carve from the process heap, bump style.
    // c.x[1] is left untouched: nninitStartup passes it straight on as InitializeAllocator's size.
    uint64_t out = c.x[0];
    uint64_t size = c.x[1];
    uint64_t base = kHeapBase;
    uint64_t end = base + heap_size();  // svcSetHeapSize's bookkeeping (kernel.cpp)
    if (g_mem_next == 0) g_mem_next = base;
    uint64_t aligned = (size + 0xFFFull) & ~uint64_t(0xFFFull);
    if (size == 0 || g_mem_next + aligned > end) {
        log("AllocateMemoryBlock(0x%llx): does not fit (next 0x%llx, end 0x%llx) -- returning null",
            (unsigned long long)size, (unsigned long long)g_mem_next, (unsigned long long)end);
        if (out) st<uint64_t>(out, 0);
        c.x[0] = 0;
        return;
    }
    uint64_t block = g_mem_next;
    g_mem_next = block + aligned;
    if (out) st<uint64_t>(out, block);
    c.x[0] = block;
    log("AllocateMemoryBlock(0x%llx) -> 0x%llx (heap +0x%llx, 0x%llx left)",
        (unsigned long long)size, (unsigned long long)block,
        (unsigned long long)(block - base), (unsigned long long)(end - g_mem_next));
}

// ---- TLS plane ------------------------------------------------------------------------------------------------

uint32_t g_tls_next = 1;  // slot 0 stays unused (see the header comment)
thread_local uint64_t tls_values[64];

void allocate_tls_slot(CPU& c) {
    // void AllocateTlsSlot(TlsSlot* out, void (*dtor)(uint64_t))
    uint64_t out = c.x[0];
    if (g_tls_next > 63) {
        log("AllocateTlsSlot: out of slots");
        c.x[0] = 0;
        return;
    }
    uint32_t slot = g_tls_next++;
    if (out) st<uint32_t>(out, slot);
    log("AllocateTlsSlot -> %u%s", slot, c.x[1] ? " (dtor)" : "");
}

void set_tls_value(CPU& c) {
    // void SetTlsValue(TlsSlot slot, uint64_t value)
    uint32_t slot = uint32_t(c.x[0]);
    if (slot >= 64) {
        log("SetTlsValue(slot %u): out of range", slot);
        return;
    }
    tls_values[slot] = c.x[1];
}

void get_tls_value(CPU& c) {
    // uint64_t GetTlsValue(TlsSlot slot)
    uint32_t slot = uint32_t(c.x[0]);
    c.x[0] = slot < 64 ? tls_values[slot] : 0;
}

// ---- thread identity ------------------------------------------------------------------------------------------

uint64_t g_next_thread_id = 1;

uint64_t thread_ctx() {
    static thread_local uint64_t ctx = 0;
    if (ctx == 0) {
        ctx = kernel_alloc(0x40, 8);
        st<uint64_t>(ctx + 0x00, g_next_thread_id++);
        st<int32_t>(ctx + 0x08, 0x2C);  // kernel default priority; ChangeThreadPriority overwrites
        st<int32_t>(ctx + 0x10, 0);
    }
    return ctx;
}

void get_current_thread(CPU& c) { c.x[0] = thread_ctx(); }

void get_thread_id(CPU& c) {
    // uint64_t GetThreadId(nn::os::ThreadType const*)
    uint64_t t = c.x[0];
    c.x[0] = t ? ld<uint32_t>(t) : 0;
}

void change_thread_priority(CPU& c) {
    // void ChangeThreadPriority(nn::os::ThreadType*, int)
    uint64_t t = c.x[0];
    if (t) st<int32_t>(t + 0x08, int32_t(uint32_t(c.x[1])));
    c.x[0] = 0;
}

void get_thread_priority(CPU& c) {
    // int GetThreadPriority(nn::os::ThreadType const*)
    uint64_t t = c.x[0];
    c.x[0] = t ? uint32_t(ld<int32_t>(t + 0x08)) : 0x10;
}

void get_current_core_number(CPU& c) { c.x[0] = uint32_t(ld<int32_t>(thread_ctx() + 0x10)); }

void get_thread_available_core_mask(CPU& c) { c.x[0] = 7; }  // app cores 0..2

void set_thread_core_mask(CPU& c) { c.x[0] = 0; }  // always accept

void get_current_stack_info(CPU& c) {
    // void GetCurrentStackInfo(uint64_t* top, uint64_t* size)
    uint64_t out_top = c.x[0], out_size = c.x[1];
    KThread* t = self_thread();
    uint64_t top = (t && t->stack_hi) ? t->stack_hi : c.x[31];
    uint64_t size = (t && t->stack_hi > t->stack_lo) ? (t->stack_hi - t->stack_lo) : 0;
    if (out_top) st<uint64_t>(out_top, top);
    if (out_size) st<uint64_t>(out_size, size);
    log("GetCurrentStackInfo -> top 0x%llx size 0x%llx", (unsigned long long)top, (unsigned long long)size);
}

// ---- allocator binding ------------------------------------------------------------------------------------------
// main defines nn::init::InitializeAllocator itself (main+0xdda018 -- verified in round 9: calling it
// directly made the static constructors run). nninitStartup reaches it through its import thunk; make
// sure that thunk lands on the definition even if the loader would otherwise leave it unresolved.
void initialize_allocator(CPU& c) {
    for (size_t k = 0; k < nx_module_main.symbol_count; k++) {
        const Symbol& s = nx_module_main.symbols[k];
        if (!s.imported && s.name[0] && std::strcmp(s.name, "_ZN2nn4init19InitializeAllocatorEPvm") == 0) {
            log("nn::init::InitializeAllocator(buf=0x%llx, size=0x%llx) via %s",
                (unsigned long long)c.x[0], (unsigned long long)c.x[1],
                describe(nx_module_main.base + s.value).c_str());
            uint64_t saved[13];
            for (int r = 19; r <= 31; r++) saved[r - 19] = c.x[r];
            call(c, nx_module_main.base + s.value);
            for (int r = 19; r <= 31; r++) c.x[r] = saved[r - 19];
            return;
        }
    }
    log("InitializeAllocator: no definition in main -- allocator NOT installed");
}

}  // namespace

NX_HLE("_ZN2nn2os19AllocateMemoryBlockEPmm", allocate_memory_block);
NX_HLE("_ZN2nn2os15QueryMemoryInfoEPNS0_10MemoryInfoE", query_memory_info);
NX_HLE("_ZN2nn2os17SetMemoryHeapSizeEm", set_memory_heap_size);
NX_HLE("_ZN2nn2os15AllocateTlsSlotEPNS0_7TlsSlotEPFvmE", allocate_tls_slot);
NX_HLE("_ZN2nn2os11SetTlsValueENS0_7TlsSlotEm", set_tls_value);
NX_HLE("_ZN2nn2os11GetTlsValueENS0_7TlsSlotE", get_tls_value);
NX_HLE("_ZN2nn2os16GetCurrentThreadEv", get_current_thread);
NX_HLE("_ZN2nn2os11GetThreadIdEPKNS0_10ThreadTypeE", get_thread_id);
NX_HLE("_ZN2nn2os20ChangeThreadPriorityEPNS0_10ThreadTypeEi", change_thread_priority);
NX_HLE("_ZN2nn2os17GetThreadPriorityEPKNS0_10ThreadTypeE", get_thread_priority);
NX_HLE("_ZN2nn2os20GetCurrentCoreNumberEv", get_current_core_number);
NX_HLE("_ZN2nn2os26GetThreadAvailableCoreMaskEv", get_thread_available_core_mask);
NX_HLE("_ZN2nn2os17SetThreadCoreMaskEPNS0_10ThreadTypeEim", set_thread_core_mask);
NX_HLE("_ZN2nn2os19GetCurrentStackInfoEPmS1_", get_current_stack_info);
NX_HLE("_ZN2nn4init19InitializeAllocatorEPvm", initialize_allocator);

}  // namespace nx
