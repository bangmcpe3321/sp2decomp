// Host (PC) implementation of nn::os — the platform stand-in for the boot milestone.
//
// Every function here exists because `main` imports it; the implementations are new,
// because no vendor implementation is present in the game dump. Frequencies and
// argument shapes in the comments come from the whole-binary call-site scan.
//
// Design notes for the reconstructed semantics:
//   * GetSystemTick must be monotonic and cheap — it is the single hottest import at
//     677 call sites, and `printFromStartTime`/`Actor`/`syncCacheStorageImpl` all use it
//     as a wall-clock for elapsed-time measurement, so it must never go backwards.
//   * LockMutex/UnlockMutex are embedded by value in game objects, so the host-backed
//     storage must be self-contained and trivially relocatable is NOT required — the
//     game only ever hands us the address it allocated.
//   * TLS slots are a fixed small pool; the SDK allows 16.
#include "nn/os.hpp"

#include <atomic>
#include <chrono>
#include <cstring>
#include <mutex>
#include <new>
#include <thread>

#if defined(_WIN32)
#  define WIN32_LEAN_AND_MEAN
#  include <windows.h>
#endif

namespace nn::os {
namespace {

// ---- tick ---------------------------------------------------------------
// Convert a monotonic clock reading to the 19.2 MHz tick domain. Computed with integer
// arithmetic so the result is exact and monotonic rather than drifting on a double.
std::uint64_t NowTicks() {
    using clock = std::chrono::steady_clock;
    static const auto origin = clock::now();
    const auto delta = clock::now() - origin;
    const auto ns = std::chrono::duration_cast<std::chrono::nanoseconds>(delta).count();
    if (ns < 0) return 0;
    // ticks = ns * 19'200'000 / 1'000'000'000 = ns * 192 / 10000
    return static_cast<std::uint64_t>(ns) * 192ull / 10000ull;
}

// ---- TLS ----------------------------------------------------------------
// The SDK provides 16 TLS slots. Storage is per-thread, so a thread_local array is the
// faithful host mapping — GetTlsValue/SetTlsValue are called from many threads and must
// not share state between them.
constexpr std::uint32_t kTlsSlotCount = 16;
thread_local void *g_tls[kTlsSlotCount] = {};
std::atomic<std::uint32_t> g_tlsNext{0};

// ---- mutex --------------------------------------------------------------
// The game allocates storage inline and hands us the pointer, e.g.
// `LockMutex((MutexType *)(this + 0x348))`. Placement-new a host mutex into that
// storage. A recursive and a plain host mutex are different types, so the variant is
// selected at initialisation and recorded in the header; only one is ever constructed.
struct MutexStorage {
    bool isRecursive;
    union {
        std::mutex plain;
        std::recursive_mutex recursive;
    };
    explicit MutexStorage(bool recursive) : isRecursive(recursive) {
        if (recursive) new (&this->recursive) std::recursive_mutex();
        else new (&plain) std::mutex();
    }
    ~MutexStorage() {
        if (isRecursive) this->recursive.~recursive_mutex();
        else plain.~mutex();
    }
};

MutexStorage *AsStorage(MutexType *m) {
    return reinterpret_cast<MutexStorage *>(m->storage);
}

} // namespace

// ---- time ---------------------------------------------------------------

std::uint64_t GetSystemTick() { return NowTicks(); }

void SleepThread(std::int64_t nanoseconds) {
    if (nanoseconds <= 0) {
        std::this_thread::yield();
        return;
    }
    std::this_thread::sleep_for(std::chrono::nanoseconds(nanoseconds));
}

std::uint64_t ConvertToTimeSpan(std::int64_t nanoseconds) {
    // nn::TimeSpan is nanoseconds in the SDK; the call sites feed the result straight
    // into comparisons against GetSystemTick output, so convert to ticks.
    if (nanoseconds <= 0) return 0;
    return static_cast<std::uint64_t>(nanoseconds) * 192ull / 10000ull;
}

// ---- TLS ----------------------------------------------------------------

void *GetTlsValue(std::uint32_t slot) {
    if (slot >= kTlsSlotCount) return nullptr;
    return g_tls[slot];
}

void SetTlsValue(std::uint32_t slot, void *value) {
    if (slot >= kTlsSlotCount) return;
    g_tls[slot] = value;
}

std::uint32_t AllocateTlsSlot() {
    const std::uint32_t slot = g_tlsNext.fetch_add(1);
    return slot < kTlsSlotCount ? slot : kTlsSlotCount; // kTlsSlotCount signals failure
}

// ---- synchronisation ----------------------------------------------------

void InitializeMutex(MutexType *mutex, bool recursive, int /*priorityInheritance*/) {
    if (mutex == nullptr) return;
    static_assert(sizeof(MutexStorage) <= sizeof(MutexType::storage),
                  "MutexType storage too small for the host mutex");
    new (mutex->storage) MutexStorage(recursive);
}

void LockMutex(MutexType *mutex) {
    if (mutex == nullptr) return;
    auto *s = AsStorage(mutex);
    if (s->isRecursive) s->recursive.lock();
    else s->plain.lock();
}

void UnlockMutex(MutexType *mutex) {
    if (mutex == nullptr) return;
    auto *s = AsStorage(mutex);
    if (s->isRecursive) s->recursive.unlock();
    else s->plain.unlock();
}

void InitializeSemaphore(SemaphoreType *semaphore, int /*initial*/, int /*max*/) {
    if (semaphore == nullptr) return;
    std::memset(semaphore->storage, 0, sizeof(semaphore->storage));
}

void AcquireSemaphore(SemaphoreType *) {}
void ReleaseSemaphore(SemaphoreType *) {}

// ---- CPU / threads ------------------------------------------------------

std::uint32_t GetCurrentCoreNumber() {
    // The game uses this to pick per-core work buffers; any stable value in range is a
    // valid stand-in. std::thread::hardware_concurrency is the honest host analogue but
    // is not guaranteed to identify the *current* core, so report 0 deterministically.
    return 0;
}

std::uint64_t GetThreadAvailableCoreMask() {
    const unsigned n = std::thread::hardware_concurrency();
    // Switch has 4 cores (0..3). Mask off anything above that so game code sizing
    // per-core arrays stays within the range the data structures expect.
    const unsigned usable = n == 0 ? 1u : (n > 4u ? 4u : n);
    return (1ull << usable) - 1ull;
}

void SetThreadCoreMask(ThreadType *, int, std::uint64_t) {}
void ChangeThreadPriority(ThreadType *, int) {}

std::uint32_t GetCurrentThread() {
    // A non-null opaque handle. The game only uses it as an identity token (e.g.
    // comparing against a stored thread id), so a stable per-thread value is faithful.
    static thread_local std::uint32_t id = 0;
    if (id == 0) {
        static std::atomic<std::uint32_t> next{1};
        id = next.fetch_add(1);
    }
    return id;
}

std::uint64_t GetThreadId(ThreadType *) { return 0; }

} // namespace nn::os
