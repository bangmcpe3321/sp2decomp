// nn::os — platform layer contracts, reconstructed from call-site evidence.
//
// The real implementations are NOT in the game dump: `main` imports these and the
// system provides them at runtime (see docs/PLATFORM_LAYER_LOCATION.md). Every
// signature below is therefore derived from how `main` calls the function, taken from
// the whole-binary call-site scan (48 imports, 1712 call sites, 1191 callers) recorded
// in docs/PLATFORM_IMPLEMENTATION_SPEC.md.
//
// Argument shapes quoted in the comments are literal call expressions from Ghidra
// pseudocode, so arity is observed rather than guessed.
#pragma once

#include <cstdint>
#include <cstddef>

namespace nn::os {

// ---- fixed ABI types -----------------------------------------------------
// These are the SDK's own opaque handles. The game allocates storage for them inside
// its own objects and passes the address, e.g. `nn::os::LockMutex((MutexType *)(this +
// 0x348))`.
//
// SIZES ARE EVIDENCE-BASED. See docs/TYPE_SIZES.md for the method and the caveats; the
// short version is that the game always allocates these as SINGLE FIELDS, never as
// array elements, so the host backing store only has to fit the host primitive — the
// SDK never computes sizeof() for them. Where a size is measurable from the binary it is
// recorded below; where it is not, that is stated rather than guessed.
struct MutexType {
    // NOT MEASURED. Two `.bss` globals initialised 0x20 apart suggest sizeof <= 0x20,
    // but they are distinct symbols rather than proven array elements, so 0x20 is a
    // candidate rather than a measurement. The host needs 48 bytes for a
    // std::recursive_mutex, which exceeds that candidate; that is safe here because no
    // observed site walks an array of these, but it is NOT ABI-compatible.
    alignas(16) unsigned char storage[0x40];
};

struct SemaphoreType {
    // UNBOUNDED by the evidence: four call sites consistently use `this + 0x20`, which
    // confirms a stable field offset but reveals no following sibling field.
    // The host needs 96 bytes for {mutex, condition_variable, two ints}, so this is sized
    // to the HOST requirement, not to a measured SDK size. Safe here for the same reason
    // as MutexType: every observed site allocates a single field, never an array element
    // whose stride the SDK would have to know.
    alignas(16) unsigned char storage[0x60];
};

struct ThreadType {
    // UNOBSERVABLE. Created by the SDK via CreateThread and held BY POINTER at three of
    // four observed sites, so the game never exercises its size inline (one site passes
    // `this + 8`, which is why the storage must stay inline-capable). The game also never
    // reads fields inside it in the observed code.
    //
    // The host state is kept in a platform-layer registry keyed by the handle ADDRESS, not
    // behind a pointer read out of this storage. The SDK has one observed inline site
    // (`this + 8`), so a control call can arrive before CreateThread; treating the bytes
    // as a pointer there would dereference unrelated object memory. Keying on the address
    // makes an uninitialised or stale handle degrade to "no host state" instead.
    //
    // The storage itself is kept only for SDK size/alignment fidelity and is never
    // interpreted by this layer.
    alignas(16) unsigned char storage[0x80];
};

struct EventType {
    // MEASURED CORRECTION: 0x40 was too small. The host event state (mutex + condition
    // variable + flags) needs more than 0x40 bytes on x86-64, and placement-new overran it --
    // caught by a static_assert. Horizon's own EventType is larger than 0x40 as well, so the
    // earlier figure was simply wrong. Sized to the requirement, documented rather than
    // silently bumped.
    alignas(16) unsigned char storage[0x80];
};

// nn::vi::GetDisplayVsyncEvent takes an nn::os::SystemEventType by out-pointer. Modelled as
// the SDK's system-event spelling of EventType so the display layer and the render loop agree
// on one type.
using SystemEventType = EventType;

// The clear mode GetDisplayVsyncEvent / CreateSystemEvent use. AutoClear is what a per-frame
// vsync wait needs: the event resets itself once signalled.
enum class EventClearMode : int {
    AutoClear = 0,
    ManualClear = 1,
};

// 0x7100e6738c's path reaches nn::vi::GetDisplayVsyncEvent, which must produce a usable
// event. Signal/reset/wait are the operations the render loop performs on it.
int CreateSystemEvent(SystemEventType *outEvent, EventClearMode clearMode, bool initiallySignaled);
void SignalSystemEvent(SystemEventType *event);
void ClearSystemEvent(SystemEventType *event);
void WaitSystemEvent(SystemEventType *event);

// Returned by QueryMemoryInfo; the game passes a pointer it owns.
struct MemoryInfo {
    std::uint64_t totalSize;      // observed: QueryMemoryInfo((MemoryInfo *)&local_58)
    std::uint64_t usedSize;
};

// Message queue storage. MEASURED: four call sites pass the queue and its backing
// buffer as sibling fields of the same object, always exactly 0x48 apart, so the
// queue's region is 0x48 — the only size in this header established by measurement.
// The count is a runtime capacity (0x20 and 0x21 both appear), not part of the type.
//
// ALIGNMENT MATTERS HERE: alignas(16) made sizeof() 0x50 on both x86-64 and AArch64,
// padding the measured 0x48 region and putting any sibling 8 bytes too far out. 8-byte
// alignment keeps sizeof() == 0x48, which is what the sibling offsets require.
struct MessageQueueType {
    alignas(8) unsigned char storage[0x48];
};

// Thread-local-destructor callback passed to AllocateTlsSlot.
using TlsDestructor = void (*)(std::uint64_t);

// Stack region reported by GetCurrentStackInfo.
struct StackInfo {
    std::uintptr_t base;
    std::uintptr_t size;
};

// ---- time ----------------------------------------------------------------
// `uVar5 = nn::os::GetSystemTick();`  — 677 call sites across 615 callers.
// Zero arguments, 64-bit result. The Switch tick frequency is 19.2 MHz.
constexpr std::uint64_t kTickFrequencyHz = 19'200'000;
std::uint64_t GetSystemTick();

// `nn::os::SleepThread(5000000);` — 23 call sites, nanoseconds.
// A call with no argument is also observed (`nn::os::SleepThread();`), which is the
// SDK's "sleep indefinitely" form; default it to zero so the arity matches both.
void SleepThread(std::int64_t nanoseconds = 0);

// `lVar9 = nn::os::ConvertToTimeSpan(lVar7 - lVar9);` — 21 call sites. Converts a
// nanosecond duration to ticks (results are compared against GetSystemTick output).
std::uint64_t ConvertToTimeSpan(std::int64_t nanoseconds);

// ---- memory --------------------------------------------------------------
// `nn::os::AllocateMemoryBlock(&local_18, 0x2000000);` — the first argument is an OUT
// pointer for the allocation, the second a byte size (observably rounded up to 2 MB).
// Returns a result code that callers test.
int AllocateMemoryBlock(std::uint64_t *outAddress, std::uint64_t size);
// `nn::os::QueryMemoryInfo((MemoryInfo *)&local_58);`
void QueryMemoryInfo(MemoryInfo *out);
// `nn::os::SetMemoryHeapSize(uVar1);`
void SetMemoryHeapSize(std::uint64_t size);

// ---- TLS -----------------------------------------------------------------
// `lVar8 = nn::os::GetTlsValue(*(undefined4 *)puVar6);`   — 264 call sites.
// `nn::os::SetTlsValue(*(undefined4 *)(this + 0x88), this_00);` — 8 call sites.
void *GetTlsValue(std::uint32_t slot);
void SetTlsValue(std::uint32_t slot, void *value);
// `nn::os::AllocateTlsSlot(this + 0x88, (_func_void_ulong *)0x0);` — the first argument
// is an OUT pointer receiving the slot number, the second an optional destructor.
int AllocateTlsSlot(std::uint32_t *outSlot, TlsDestructor destructor);

// ---- synchronisation -----------------------------------------------------
// `nn::os::InitializeMutex(pMVar9, false, 0);` — 56 call sites.
// Args: storage, recursive flag, priority-inheritance flag.
void InitializeMutex(MutexType *mutex, bool recursive, int priorityInheritance);
// `nn::os::LockMutex((MutexType *)(this + 0x348));`   — 171 call sites.
void LockMutex(MutexType *mutex);
// `nn::os::UnlockMutex((MutexType *)(puVar3 + 0x768));` — 170 call sites.
void UnlockMutex(MutexType *mutex);

void InitializeSemaphore(SemaphoreType *semaphore, int initial, int max);
void AcquireSemaphore(SemaphoreType *semaphore);
void ReleaseSemaphore(SemaphoreType *semaphore);
// Host-state release. Not imported by `main`, but the SDK exposes these names and the
// host allocations behind the opaque storage would otherwise have no owner that frees them.
void FinalizeSemaphore(SemaphoreType *semaphore);

// ---- message queue -------------------------------------------------------
// A message is one machine word in this SDK (the observed buffer is an array of `ulong`).
// `buffer` and `count` are CALLER-OWNED. Host state holds the ring head/tail/count, a
// mutex and two condition variables, reached through a tagged pointer in
// MessageQueueType::storage so the measured 0x48 visitor layout is unchanged.
using Message = std::uintptr_t;

// `InitializeMessageQueue((MessageQueueType *)(this + 0x1f8), (ulong *)(this + 0x240), 0x20);`
// 7 call sites; capacities 1, 0x20 and 0x21 are observed. A queue with a null buffer or a
// zero capacity is left unusable rather than silently pretending to be initialised.
void InitializeMessageQueue(MessageQueueType *queue, std::uint64_t *buffer, std::size_t count);

// Blocking forms wait while the queue is full/empty. The Try* forms never block and
// return false when the operation cannot complete immediately; they do not write the out
// parameter on failure. The blocking Receive writes 0 for an unusable queue (it returns
// rather than hanging, which is the behaviour the contract test pins).
void SendMessageQueue(MessageQueueType *queue, Message message);
bool TrySendMessageQueue(MessageQueueType *queue, Message message);
void ReceiveMessageQueue(Message *outMessage, MessageQueueType *queue);
bool TryReceiveMessageQueue(Message *outMessage, MessageQueueType *queue);
// Number of messages currently held. `-1` when the queue was never initialised, so a
// caller cannot mistake an unusable queue for an empty one.
int GetMessageQueueCount(const MessageQueueType *queue);
// Host-state release; see FinalizeSemaphore. InitializeMessageQueue must not be called on
// an already-initialised queue (call Finalize first). The storage is caller-owned and may
// be uninitialised, so the previous state is deliberately not chased through it; calling
// Initialize twice therefore leaks the first state and is not supported.
void FinalizeMessageQueue(MessageQueueType *queue);

// ---- CPU / threads -------------------------------------------------------
// The thread model follows the SDK: CreateThread only *creates*; StartThread runs it and
// WaitThread joins it. The host cannot honour the guest `stack`/`stackSize` arguments (they
// describe guest memory, not the host's), so they are accepted for call-site fidelity and
// recorded on the handle rather than used to size the host thread.

// `_func_void_void_ptr *param_2, void *param_3, void *param_4, ulong param_5, int param_6`
// Entry is `void(ThreadFunction)(void *argument)`.
using ThreadFunction = void (*)(void *);

// `uVar7 = nn::os::GetCurrentCoreNumber();` — 121 call sites.
std::uint32_t GetCurrentCoreNumber();
std::uint64_t GetThreadAvailableCoreMask();

// CreateThread(thread, entry, argument, stack, stackSize, priority)
void CreateThread(ThreadType *thread, ThreadFunction function, void *argument,
                  void *stack, std::size_t stackSize, int priority);
void StartThread(ThreadType *thread);
void WaitThread(ThreadType *thread);
void DestroyThread(ThreadType *thread);
void YieldThread();

// `nn::os::SetThreadCoreMask(*(ThreadType **)(this + 0xe0), -1, (ulong)uVar1);`
// core == -1 means "any core in mask".
void SetThreadCoreMask(ThreadType *thread, int core, std::uint64_t mask);
// NOT an SDK import: a diagnostic accessor so the mask round-trip is testable.
std::uint64_t GetThreadCoreMask(ThreadType *thread);
void ChangeThreadPriority(ThreadType *thread, int priority);
// Callers cast the result straight to `ThreadType *` (`pTVar4 = (ThreadType *)...`), and it
// is then passed back to SetThreadCoreMask/ChangeThreadPriority, so it must be a real
// handle rather than a small identity token. A host thread that never went through
// CreateThread gets a stable implicit handle on first use.
ThreadType *GetCurrentThread();
std::uint64_t GetThreadId(ThreadType *thread);
int GetThreadPriority(ThreadType *thread);
void SetThreadName(ThreadType *thread, const char *name);
// NOT an SDK import: a diagnostic accessor so the name round-trip is testable.
const char *GetThreadName(ThreadType *thread);

// `nn::os::GetCurrentStackInfo((ulong *)&local_38, (ulong *)local_48);` — two OUT params.
void GetCurrentStackInfo(std::uintptr_t *outBase, std::uintptr_t *outSize);

} // namespace nn::os
