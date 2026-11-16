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
#include <condition_variable>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <mutex>
#include <new>
#include <string>
#include <thread>
#include <unordered_map>

#if !defined(_WIN32)
#  include <pthread.h>
#endif

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
TlsDestructor g_tlsDestructor[kTlsSlotCount] = {};

// ---- thread handles -----------------------------------------------------
// A ThreadType is caller-owned opaque storage. The host state is kept in a registry keyed
// by the handle ADDRESS rather than read out of that storage: the SDK has an observed
// inline site (`this + 8`) where a control call can arrive before CreateThread, and
// interpreting uninitialised object bytes as a pointer would write through unrelated
// memory. Address keying makes an uninitialised/stale handle simply "no host state".
enum ThreadLifecycle : int {
    kThreadCreated = 0,
    kThreadStarted = 1,
    kThreadFinished = 2,
    kThreadDestroyed = 3,
};

struct ThreadState {
    std::uint32_t id = 0;
    int priority = 0x20;
    std::uint64_t coreMask = 0;
    ThreadFunction function = nullptr;
    void *argument = nullptr;
    void *stack = nullptr;
    std::size_t stackSize = 0;
    std::string name;
    // Deliberately NOT a std::thread member. pthread_create can run the entry point before
    // the move-assignment into such a member completes, so the entry could observe a
    // default-constructed (or concurrently written) std::thread. The host thread is started
    // detached instead; completion is published through doneLock/doneCv.
    std::mutex doneLock;
    std::condition_variable doneCv;
    bool finished = false; // guarded by doneLock
    std::atomic<int> lifecycle{kThreadCreated};
    // Intrusive ownership. The registry starts with one reference; a running host thread and
    // any control/destroy call take another for as long as they touch the state. The state is
    // freed by the last releaser, which removes the "who deletes?" race between a self-destroy
    // and a destroy from another thread.
    std::atomic<int> refs{1};
};

std::mutex g_threadsLock;
// Leaked on purpose: a detached host thread may still be unwinding during process exit,
// and a static map's destructor would then race it. The static pointer keeps the map
// reachable, so LeakSanitizer does not report it.
std::unordered_map<ThreadType *, ThreadState *> *g_threads =
    new std::unordered_map<ThreadType *, ThreadState *>();

bool HasThread(ThreadType *thread) {
    std::lock_guard<std::mutex> lock(g_threadsLock);
    return g_threads->find(thread) != g_threads->end();
}

bool RegisterThread(ThreadType *thread, ThreadState *state) {
    std::lock_guard<std::mutex> lock(g_threadsLock);
    return g_threads->emplace(thread, state).second;
}

// Take a temporary reference for the caller. Null if this handle has no host state.
ThreadState *AcquireThread(ThreadType *thread) {
    std::lock_guard<std::mutex> lock(g_threadsLock);
    auto it = g_threads->find(thread);
    if (it == g_threads->end()) return nullptr;
    it->second->refs.fetch_add(1, std::memory_order_relaxed);
    return it->second;
}

// Remove the handle and hand the registry's reference to the caller. Exactly one destroyer can
// win this, so two concurrent DestroyThread calls cannot both touch the same state.
ThreadState *ClaimThread(ThreadType *thread) {
    std::lock_guard<std::mutex> lock(g_threadsLock);
    auto it = g_threads->find(thread);
    if (it == g_threads->end()) return nullptr;
    ThreadState *state = it->second;
    g_threads->erase(it);
    return state;
}

void ReleaseThread(ThreadState *state) {
    if (state == nullptr) return;
    if (state->refs.fetch_sub(1, std::memory_order_acq_rel) == 1) delete state;
}

thread_local std::uint32_t g_threadId = 0;
thread_local ThreadType *g_currentThread = nullptr;
// Set by the trampoline for the duration of the entry point. DestroyThread uses it to
// recognise "I am the entry thread" without reading any shared std::thread object.
thread_local ThreadState *g_runningState = nullptr;
// A host thread that never went through CreateThread (the port's own main thread, or a
// host worker) still needs a stable handle: callers cast GetCurrentThread() to ThreadType*
// and hand it back to SetThreadCoreMask/ChangeThreadPriority. Its state is thread_local,
// so no registry entry and no cross-thread lifetime question.
thread_local ThreadType g_implicitThread{};
thread_local ThreadState g_implicitState{};
thread_local bool g_implicitReady = false;

std::atomic<std::uint32_t> g_nextThreadId{1};

std::uint32_t CurrentThreadId() {
    if (g_threadId == 0) g_threadId = g_nextThreadId.fetch_add(1);
    return g_threadId;
}

ThreadType *CurrentThreadHandle() {
    if (g_currentThread != nullptr) return g_currentThread;
    if (!g_implicitReady) {
        g_implicitState.id = CurrentThreadId();
        g_implicitState.priority = 0x20;
        g_implicitState.coreMask = GetThreadAvailableCoreMask();
        g_implicitReady = true;
    }
    g_currentThread = &g_implicitThread;
    return g_currentThread;
}

// A borrowed state plus whether the caller must release it. The implicit per-thread handle
// has thread_local lifetime and is never refcounted.
struct ThreadRef {
    ThreadState *state;
    bool owned;
};

ThreadRef AcquireThreadRef(ThreadType *thread) {
    if (thread == nullptr) thread = CurrentThreadHandle();
    if (thread == &g_implicitThread) {
        return {g_implicitReady ? &g_implicitState : nullptr, false};
    }
    ThreadState *state = AcquireThread(thread);
    return {state, state != nullptr};
}

void ReleaseThreadRef(ThreadRef ref) {
    if (ref.owned) ReleaseThread(ref.state);
}

// ---- memory -------------------------------------------------------------
// AllocateMemoryBlock observably rounds up to 2 MB at a call site
// (`param_1 + 0x1fffffU & 0xffffffffffe00000`) and requests are large (0x2000000 =
// 32 MB observed), so page-aligned host allocation matches the intent.
constexpr std::uint64_t kAllocGranularity = 0x200000; // 2 MB

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

int AllocateTlsSlot(std::uint32_t *outSlot, TlsDestructor destructor) {
    if (outSlot == nullptr) return -1;
    const std::uint32_t slot = g_tlsNext.fetch_add(1);
    if (slot >= kTlsSlotCount) return -1;
    g_tlsDestructor[slot] = destructor;
    *outSlot = slot;
    return 0;
}

// ---- memory -------------------------------------------------------------

int AllocateMemoryBlock(std::uint64_t *outAddress, std::uint64_t size) {
    if (outAddress == nullptr) return -1;
    *outAddress = 0;
    if (size == 0) return -1;
    const std::uint64_t rounded = (size + kAllocGranularity - 1) & ~(kAllocGranularity - 1);
    void *p = nullptr;
#if defined(_WIN32)
    p = _aligned_malloc(static_cast<std::size_t>(rounded), 4096);
#else
    if (posix_memalign(&p, 4096, static_cast<std::size_t>(rounded)) != 0) p = nullptr;
#endif
    if (p == nullptr) return -1;
    std::memset(p, 0, static_cast<std::size_t>(rounded));
    *outAddress = reinterpret_cast<std::uint64_t>(p);
    return 0;
}

void QueryMemoryInfo(MemoryInfo *out) {
    if (out == nullptr) return;
    // Used during boot to size heaps and print the "%4ld MB: Program" diagnostics seen
    // at LogImpl call sites. Report a plausible Switch budget rather than the host's, so
    // heap-sizing logic sees the platform it was written for.
    constexpr std::uint64_t kSwitchTotalMemory = 4ull * 1024 * 1024 * 1024;
    out->totalSize = kSwitchTotalMemory;
    out->usedSize = 0;
}

void SetMemoryHeapSize(std::uint64_t /*size*/) {
    // The standalone-heap budget. The host allocator does not need it; recorded as a
    // no-op rather than pretending to enforce a limit.
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

// The semaphore was previously a no-op, which is the most dangerous stub in this file: a
// no-op Acquire never blocks and a no-op Release never wakes, so any code that waits on
// one would either spin forever or proceed without its precondition being met. The boot
// analysis in docs/BOOT_CALLGRAPH.md flagged `RootTask::waitDoneParallelInitThread` as a
// likely spin-wait site, and it uses exactly these primitives.
//
// STORAGE HOLDS A POINTER, NOT THE STATE. An in-place version sized the buffer from
// x86-64 layout, passed the static_assert there, then FAILED on AArch64 where the same
// state measures 104 bytes instead of 96. Keeping the SDK-visible type small and holding
// host state behind one pointer makes the layout ABI-independent -- the SDK only ever
// receives a pointer to caller-owned storage, so it never needs to know the host size.
struct SemaphoreState {
    std::mutex lock;
    std::condition_variable cv;
    int count;
    int maxCount;
    SemaphoreState(int initial, int max) : count(initial), maxCount(max) {}
};

// A tag separates "this storage was initialised by us" from caller bytes that have never
// been written; Finalize* would otherwise delete whatever a garbage field happened to hold.
constexpr std::uint64_t kSemaphoreMagic = 0x53503253454D4150ull; // "SP2SEMAP"

struct SemaphoreStorage {
    std::uint64_t magic;
    SemaphoreState *state;
};

SemaphoreStorage *AsSemaphore(SemaphoreType *s) {
    return reinterpret_cast<SemaphoreStorage *>(s->storage);
}

void InitializeSemaphore(SemaphoreType *semaphore, int initial, int max) {
    if (semaphore == nullptr) return;
    static_assert(sizeof(SemaphoreStorage) <= sizeof(SemaphoreType::storage),
                  "SemaphoreType storage too small for the host state");
    auto *s = AsSemaphore(semaphore);
    s->magic = 0;
    s->state = nullptr;
    // The SDK rejects an initial count above the maximum; mirror that rather than
    // silently constructing an unsatisfiable semaphore.
    if (initial < 0 || max <= 0 || initial > max) return;
    s->state = new (std::nothrow) SemaphoreState(initial, max);
    if (s->state != nullptr) s->magic = kSemaphoreMagic;
}

void AcquireSemaphore(SemaphoreType *semaphore) {
    if (semaphore == nullptr) return;
    auto *s = AsSemaphore(semaphore);
    if (s->magic != kSemaphoreMagic || s->state == nullptr) return;
    std::unique_lock<std::mutex> g(s->state->lock);
    s->state->cv.wait(g, [s] { return s->state->count > 0; });
    --s->state->count;
}

void ReleaseSemaphore(SemaphoreType *semaphore) {
    if (semaphore == nullptr) return;
    auto *s = AsSemaphore(semaphore);
    if (s->magic != kSemaphoreMagic || s->state == nullptr) return;
    std::lock_guard<std::mutex> g(s->state->lock);
    // Releasing past the maximum is a caller error; refraining from incrementing keeps
    // the count inside the declared range instead of manufacturing a permit.
    if (s->state->count >= s->state->maxCount) return;
    ++s->state->count;
    s->state->cv.notify_one();
}

// The ring itself lives in the caller's `buffer`; only the head/tail/count and the two
// condition variables are host state, held behind one pointer. Re-initialising an already
// initialised queue is not an observed call, so the previous state is intentionally not
// chased through uninitialised storage.
namespace {
struct MessageQueueState {
    std::mutex mutex;
    std::condition_variable notEmpty;
    std::condition_variable notFull;
    std::uintptr_t *buffer = nullptr;
    std::size_t capacity = 0;
    std::size_t head = 0;
    std::size_t tail = 0;
    std::size_t count = 0;
};

// A tag separates "this storage was initialised by us" from caller bytes that have never
// been written. Queue operations are hot enough that a registry keyed by address would add
// a global lock to every send/receive, so this keeps the state pointer in the caller's
// storage and validates it with a tag first.
constexpr std::uint64_t kQueueMagic = 0x5350324D51535445ull; // "SP2MQSTE"

struct MessageQueueStorage {
    std::uint64_t magic;
    MessageQueueState *state;
};

MessageQueueStorage *AsQueue(MessageQueueType *queue) {
    static_assert(sizeof(MessageQueueStorage) <= sizeof(MessageQueueType::storage),
                  "MessageQueueType storage too small for the host state");
    return reinterpret_cast<MessageQueueStorage *>(queue->storage);
}

MessageQueueState *QueueOf(const MessageQueueType *queue) {
    if (queue == nullptr) return nullptr;
    auto *storage = reinterpret_cast<const MessageQueueStorage *>(queue->storage);
    return storage->magic == kQueueMagic ? storage->state : nullptr;
}
} // namespace

void FinalizeSemaphore(SemaphoreType *semaphore) {
    if (semaphore == nullptr) return;
    SemaphoreStorage *s = AsSemaphore(semaphore);
    if (s->magic != kSemaphoreMagic) return;
    delete s->state;
    s->state = nullptr;
    s->magic = 0;
}

void InitializeMessageQueue(MessageQueueType *queue, std::uint64_t *buffer, std::size_t count) {
    if (queue == nullptr) return;
    std::memset(queue->storage, 0, sizeof(queue->storage));
    if (buffer == nullptr || count == 0) return;
    if (count > SIZE_MAX / sizeof(std::uint64_t)) return; // reject a count that would wrap

    static_assert(sizeof(Message) == sizeof(std::uint64_t),
                  "a message word and the caller's buffer element must be the same size");
    std::memset(buffer, 0, count * sizeof(std::uint64_t));

    MessageQueueState *state = new (std::nothrow) MessageQueueState();
    if (state == nullptr) return;
    state->buffer = reinterpret_cast<std::uintptr_t *>(buffer);
    state->capacity = count;
    MessageQueueStorage *storage = AsQueue(queue);
    storage->magic = kQueueMagic;
    storage->state = state;
}

void SendMessageQueue(MessageQueueType *queue, Message message) {
    MessageQueueState *state = QueueOf(queue);
    if (state == nullptr) return;
    std::unique_lock<std::mutex> lock(state->mutex);
    state->notFull.wait(lock, [state] { return state->count < state->capacity; });
    state->buffer[state->tail] = message;
    state->tail = (state->tail + 1) % state->capacity;
    ++state->count;
    state->notEmpty.notify_one();
}

bool TrySendMessageQueue(MessageQueueType *queue, Message message) {
    MessageQueueState *state = QueueOf(queue);
    if (state == nullptr) return false;
    std::lock_guard<std::mutex> lock(state->mutex);
    if (state->count >= state->capacity) return false;
    state->buffer[state->tail] = message;
    state->tail = (state->tail + 1) % state->capacity;
    ++state->count;
    state->notEmpty.notify_one();
    return true;
}

void ReceiveMessageQueue(Message *outMessage, MessageQueueType *queue) {
    if (outMessage == nullptr) return;
    MessageQueueState *state = QueueOf(queue);
    if (state == nullptr) {
        *outMessage = 0;
        return;
    }
    std::unique_lock<std::mutex> lock(state->mutex);
    state->notEmpty.wait(lock, [state] { return state->count > 0; });
    *outMessage = state->buffer[state->head];
    state->head = (state->head + 1) % state->capacity;
    --state->count;
    state->notFull.notify_one();
}

bool TryReceiveMessageQueue(Message *outMessage, MessageQueueType *queue) {
    if (outMessage == nullptr) return false;
    MessageQueueState *state = QueueOf(queue);
    if (state == nullptr) return false;
    std::lock_guard<std::mutex> lock(state->mutex);
    if (state->count == 0) return false;
    *outMessage = state->buffer[state->head];
    state->head = (state->head + 1) % state->capacity;
    --state->count;
    state->notFull.notify_one();
    return true;
}

int GetMessageQueueCount(const MessageQueueType *queue) {
    MessageQueueState *state = QueueOf(queue);
    if (state == nullptr) return -1;
    std::lock_guard<std::mutex> lock(state->mutex);
    return static_cast<int>(state->count);
}

void FinalizeMessageQueue(MessageQueueType *queue) {
    if (queue == nullptr) return;
    MessageQueueStorage *storage = AsQueue(queue);
    if (storage->magic != kQueueMagic) return;
    delete storage->state;
    storage->state = nullptr;
    storage->magic = 0;
}

// ---- CPU / threads ------------------------------------------------------

std::uint32_t GetCurrentCoreNumber() {
    // Callers use this to pick per-core work buffers, so any stable in-range value works.
    // std::thread::hardware_concurrency is the host analogue but does not identify the
    // *current* core, so report 0 deterministically rather than a misleading value.
    return 0;
}

std::uint64_t GetThreadAvailableCoreMask() {
    const unsigned n = std::thread::hardware_concurrency();
    // The Switch has 4 cores. Cap the mask so game code sizing per-core arrays stays
    // inside the range its data structures expect.
    const unsigned usable = n == 0 ? 1u : (n > 4u ? 4u : n);
    return (1ull << usable) - 1ull;
}

void CreateThread(ThreadType *thread, ThreadFunction function, void *argument,
                  void *stack, std::size_t stackSize, int priority) {
    if (thread == nullptr) return;
    // Re-creating over a live handle would orphan its host thread. Reject it; call
    // DestroyThread first, which is also what makes storage reuse well-defined.
    if (HasThread(thread)) return;

    ThreadState *state = new (std::nothrow) ThreadState();
    if (state == nullptr) return;
    state->id = g_nextThreadId.fetch_add(1);
    state->priority = priority;
    state->coreMask = GetThreadAvailableCoreMask();
    state->function = function;
    state->argument = argument;
    state->stack = stack;
    state->stackSize = stackSize;

    if (!RegisterThread(thread, state)) ReleaseThread(state);
}

void StartThread(ThreadType *thread) {
    if (thread == nullptr || thread == &g_implicitThread) return;
    ThreadRef ref = AcquireThreadRef(thread);
    ThreadState *state = ref.state;
    if (state == nullptr) {
        ReleaseThreadRef(ref);
        return;
    }

    // A single CAS makes a second concurrent start a no-op instead of starting two host
    // threads against one state.
    int expected = kThreadCreated;
    if (!state->lifecycle.compare_exchange_strong(expected, kThreadStarted)) {
        ReleaseThreadRef(ref);
        return;
    }

    // The running trampoline owns a reference for its whole lifetime.
    state->refs.fetch_add(1, std::memory_order_relaxed);
    try {
        std::thread host([thread, state] {
            // Make GetCurrentThread()/GetThreadId(nullptr) report this handle inside the
            // entry point, which is what every observed caller assumes.
            g_threadId = state->id;
            g_currentThread = thread;
            g_runningState = state;
            if (state->function != nullptr) state->function(state->argument);

            g_runningState = nullptr;
            g_currentThread = nullptr;
            {
                std::lock_guard<std::mutex> lock(state->doneLock);
                state->finished = true;
                state->lifecycle.store(kThreadFinished);
                // Notify while holding the lock: a waiter that wakes after the unlock may
                // free the state, and notify_all itself still touches the CV.
                state->doneCv.notify_all();
            }
            // Drop the running reference. The last releaser frees the state; there is no
            // access to `state` after this point.
            ReleaseThread(state);
        });
        // Detach immediately. Completion is observed through doneCv, and this avoids a
        // joinable std::thread member that the entry point could race against while it was
        // still being assigned by this thread.
        host.detach();
    } catch (...) {
        // std::thread construction failed (resource exhaustion). Publish completion so a
        // waiter cannot hang, and mark the handle finished rather than half-started.
        {
            std::lock_guard<std::mutex> lock(state->doneLock);
            state->finished = true;
            state->lifecycle.store(kThreadFinished);
            state->doneCv.notify_all();
        }
        ReleaseThread(state); // no trampoline will release the running reference
    }
    ReleaseThreadRef(ref);
}

void WaitThread(ThreadType *thread) {
    ThreadRef ref = AcquireThreadRef(thread);
    ThreadState *state = ref.state;
    if (state == nullptr) {
        ReleaseThreadRef(ref);
        return;
    }
    // Waiting on the calling thread would deadlock.
    if (g_runningState == state) {
        ReleaseThreadRef(ref);
        return;
    }

    {
        std::unique_lock<std::mutex> lock(state->doneLock);
        if (!state->finished && state->lifecycle.load() == kThreadStarted) {
            state->doneCv.wait(lock, [state] { return state->finished; });
        }
    }
    // Release only after the lock is gone, so the CV and mutex are not freed under us.
    ReleaseThreadRef(ref);
}

void DestroyThread(ThreadType *thread) {
    if (thread == nullptr) return;

    if (thread == &g_implicitThread) {
        // Thread-local fallback state: it is owned by the thread and must not be freed.
        // Drop the handle so a later GetCurrentThread() rebuilds it.
        if (g_currentThread == thread) g_currentThread = nullptr;
        g_implicitReady = false;
        return;
    }

    // ClaimThread erases the handle under the registry lock, so exactly one destroyer can
    // obtain the state. A concurrent destroy gets null and cannot touch a freed object.
    ThreadState *state = ClaimThread(thread);
    if (state == nullptr) return;

    const int previous = state->lifecycle.exchange(kThreadDestroyed);
    if (previous == kThreadDestroyed) {
        ReleaseThread(state);
        return;
    }

    // The entry point may destroy its own handle. Detect that from the thread_local
    // pointer the trampoline publishes, not by reading a shared std::thread object. The
    // running reference keeps the state alive until the trampoline releases it.
    if (g_runningState == state) {
        g_currentThread = nullptr;
        ReleaseThread(state);
        return;
    }

    if (previous == kThreadStarted) {
        std::unique_lock<std::mutex> lock(state->doneLock);
        state->doneCv.wait(lock, [state] { return state->finished; });
    }
    ReleaseThread(state);
}

void YieldThread() { std::this_thread::yield(); }

void SetThreadCoreMask(ThreadType *thread, int core, std::uint64_t mask) {
    ThreadRef ref = AcquireThreadRef(thread);
    if (ref.state != nullptr) {
        // SDK semantics: an explicit core selects exactly that core; -1 keeps the mask.
        ref.state->coreMask = (core >= 0 && core < 64) ? (1ull << core) : mask;
    }
    ReleaseThreadRef(ref);
}

std::uint64_t GetThreadCoreMask(ThreadType *thread) {
    ThreadRef ref = AcquireThreadRef(thread);
    const std::uint64_t mask = ref.state != nullptr ? ref.state->coreMask : 0;
    ReleaseThreadRef(ref);
    return mask;
}

void ChangeThreadPriority(ThreadType *thread, int priority) {
    ThreadRef ref = AcquireThreadRef(thread);
    if (ref.state != nullptr) ref.state->priority = priority;
    ReleaseThreadRef(ref);
}

ThreadType *GetCurrentThread() { return CurrentThreadHandle(); }

std::uint64_t GetThreadId(ThreadType *thread) {
    ThreadRef ref = AcquireThreadRef(thread);
    if (ref.state != nullptr) {
        const std::uint64_t id = ref.state->id;
        ReleaseThreadRef(ref);
        return id;
    }
    ReleaseThreadRef(ref);
    // Not a CreateThread handle: fall back to its address so the value is at least stable.
    return thread != nullptr ? reinterpret_cast<std::uint64_t>(thread) : 0;
}

int GetThreadPriority(ThreadType *thread) {
    ThreadRef ref = AcquireThreadRef(thread);
    // Callers compare and restore the priority, so a stable default is required even for a
    // handle the port did not create.
    const int priority = ref.state != nullptr ? ref.state->priority : 0x20;
    ReleaseThreadRef(ref);
    return priority;
}

void SetThreadName(ThreadType *thread, const char *name) {
    if (name == nullptr) return;
    ThreadRef ref = AcquireThreadRef(thread);
    if (ref.state != nullptr) ref.state->name = name;
    ReleaseThreadRef(ref);
}

const char *GetThreadName(ThreadType *thread) {
    // The state may be freed on release, so return a copy with thread-local lifetime.
    thread_local std::string nameCopy;
    ThreadRef ref = AcquireThreadRef(thread);
    nameCopy = ref.state != nullptr ? ref.state->name : std::string();
    ReleaseThreadRef(ref);
    return nameCopy.c_str();
}

void GetCurrentStackInfo(std::uintptr_t *outBase, std::uintptr_t *outSize) {
    if (outBase != nullptr) *outBase = 0;
    if (outSize != nullptr) *outSize = 0;
#if defined(_WIN32)
    ULONG_PTR low = 0;
    ULONG_PTR high = 0;
    GetCurrentThreadStackLimits(&low, &high);
    if (outBase != nullptr) *outBase = static_cast<std::uintptr_t>(low);
    if (outSize != nullptr && high > low) *outSize = static_cast<std::uintptr_t>(high - low);
#elif defined(__linux__)
    // pthread_getattr_np is glibc/Linux-specific; the guard keeps macOS/BSD builds linking.
    pthread_attr_t attr;
    if (pthread_getattr_np(pthread_self(), &attr) == 0) {
        void *addr = nullptr;
        std::size_t size = 0;
        if (pthread_attr_getstack(&attr, &addr, &size) == 0) {
            if (outBase != nullptr) *outBase = reinterpret_cast<std::uintptr_t>(addr);
            if (outSize != nullptr) *outSize = static_cast<std::uintptr_t>(size);
        }
        pthread_attr_destroy(&attr);
    }
#endif
}


// --- nn::os system events -----------------------------------------------------------------
// Needed by nn::vi::GetDisplayVsyncEvent: the engine's render loop waits on a per-frame event,
// so the event has to be real rather than a null the loop would fault on. Backed by a host
// mutex + condition_variable pair held in the EventType's opaque storage, the same
// placement-manage approach used for the sead locks.
namespace {
struct EventState {
    std::mutex m;
    std::condition_variable cv;
    bool signaled;
    bool autoClear;
};

EventState *EventOf(nn::os::SystemEventType *e) {
    static_assert(sizeof(EventState) <= sizeof(nn::os::EventType::storage),
                  "EventType::storage is too small for the host event state");
    return reinterpret_cast<EventState *>(e->storage);
}
} // namespace

int CreateSystemEvent(SystemEventType *outEvent, EventClearMode clearMode, bool initiallySignaled) {
    if (outEvent == nullptr) return -1;
    EventState *s = new (outEvent->storage) EventState();
    s->signaled = initiallySignaled;
    s->autoClear = (clearMode == EventClearMode::AutoClear);
    return 0;
}

void SignalSystemEvent(SystemEventType *event) {
    if (event == nullptr) return;
    EventState *s = EventOf(event);
    {
        std::lock_guard<std::mutex> lock(s->m);
        s->signaled = true;
    }
    s->cv.notify_all();
}

void ClearSystemEvent(SystemEventType *event) {
    if (event == nullptr) return;
    EventState *s = EventOf(event);
    std::lock_guard<std::mutex> lock(s->m);
    s->signaled = false;
}

void WaitSystemEvent(SystemEventType *event) {
    if (event == nullptr) return;
    EventState *s = EventOf(event);
    std::unique_lock<std::mutex> lock(s->m);
    s->cv.wait(lock, [s] { return s->signaled; });
    // AutoClear: consuming the signal resets it, which is what a per-frame vsync wait means.
    if (s->autoClear) s->signaled = false;
}
} // namespace nn::os
