// nn::init implementation — a bump allocator over the block the boot root supplies.
//
// Why bump: `InitializeAllocator` is handed one 32 MB block by the boot root and the
// SDK's own allocator is a fixed pool over it. A bump allocator is the honest minimal
// model — it satisfies allocation without pretending to implement the SDK's real
// free-list scheme, which is not present in the dump to reconstruct.
#include "nn/init.hpp"

#include <atomic>
#include <cstdint>
#include <mutex>

namespace nn::init {

namespace {

struct Pool {
    std::mutex lock;
    std::uintptr_t base = 0;
    std::size_t size = 0;
    std::size_t used = 0;
    bool ready = false;
};

Pool g_pool;

std::atomic<std::uintptr_t> g_lastAlloc{0};

std::size_t AlignUp(std::size_t value, std::size_t alignment) {
    if (alignment <= 1) return value;
    return (value + alignment - 1) & ~(alignment - 1);
}

} // namespace

int InitializeAllocator(void *blockBase) {
    if (blockBase == nullptr) return -1;
    std::lock_guard<std::mutex> g(g_pool.lock);
    g_pool.base = reinterpret_cast<std::uintptr_t>(blockBase);
    // The boot root asks for 0x2000000 (32 MB); the block size is not passed here, so
    // record the size the caller allocated. Kept as a constant matching the observed
    // AllocateMemoryBlock request rather than invented.
    g_pool.size = 0x2000000;
    g_pool.used = 0;
    g_pool.ready = true;
    return 0;
}

void *GetDefaultAllocator() {
    std::lock_guard<std::mutex> g(g_pool.lock);
    return g_pool.ready ? reinterpret_cast<void *>(g_pool.base) : nullptr;
}

void *Allocate(std::size_t size) { return Allocate(size, 16); }

void *Allocate(std::size_t size, std::size_t alignment) {
    if (size == 0) return nullptr;
    if (alignment < 16) alignment = 16;
    std::lock_guard<std::mutex> g(g_pool.lock);
    if (!g_pool.ready) return nullptr;
    const std::size_t offset = AlignUp(g_pool.used, alignment);
    if (offset + size > g_pool.size) return nullptr; // exhaustion is reported, not wrapped
    void *p = reinterpret_cast<void *>(g_pool.base + offset);
    g_pool.used = offset + size;
    g_lastAlloc.store(reinterpret_cast<std::uintptr_t>(p));
    return p;
}

void Free(void *) {
    // Bump allocator: individual frees are not reclaimable. Deliberately a no-op rather
    // than pretending, because the SDK's real free-list behaviour is not reconstructible
    // from the dump.
}

} // namespace nn::init
