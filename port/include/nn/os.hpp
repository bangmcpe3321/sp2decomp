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
    alignas(16) unsigned char storage[0x40];
};

struct ThreadType {
    // UNOBSERVABLE. Created by the SDK via CreateThread and held BY POINTER at three of
    // four observed sites, so the game never exercises its size inline. The game also
    // never reads fields inside it in the observed code, so any adequate host reserve
    // works.
    alignas(16) unsigned char storage[0x80];
};

struct EventType {
    alignas(16) unsigned char storage[0x40];
};

// Returned by QueryMemoryInfo; the game passes a pointer it owns.
struct MemoryInfo {
    std::uint64_t totalSize;      // observed: QueryMemoryInfo((MemoryInfo *)&local_58)
    std::uint64_t usedSize;
};

// Message queue storage. MEASURED: four call sites pass the queue and its backing
// buffer as sibling fields of the same object, always exactly 0x48 apart, so the
// queue's region is 0x48 — the only size in this header established by measurement.
// The count is a runtime capacity (0x20 and 0x21 both appear), not part of the type.
struct MessageQueueType {
    alignas(16) unsigned char storage[0x48];
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

// `InitializeMessageQueue((MessageQueueType *)(this + 0x1f8), (ulong *)(this + 0x240), 0x20);`
void InitializeMessageQueue(MessageQueueType *queue, std::uint64_t *buffer, std::size_t count);

// ---- CPU / threads -------------------------------------------------------
// `uVar7 = nn::os::GetCurrentCoreNumber();` — 121 call sites.
std::uint32_t GetCurrentCoreNumber();
std::uint64_t GetThreadAvailableCoreMask();
// `nn::os::SetThreadCoreMask(*(ThreadType **)(this + 0xe0), -1, (ulong)uVar1);`
// core == -1 means "any core in mask".
void SetThreadCoreMask(ThreadType *thread, int core, std::uint64_t mask);
void ChangeThreadPriority(ThreadType *thread, int priority);
std::uint32_t GetCurrentThread();
std::uint64_t GetThreadId(ThreadType *thread);
int GetThreadPriority(ThreadType *thread);
void SetThreadName(ThreadType *thread, const char *name);
// `nn::os::GetCurrentStackInfo((ulong *)&local_38, (ulong *)local_48);` — two OUT params.
void GetCurrentStackInfo(std::uintptr_t *outBase, std::uintptr_t *outSize);

} // namespace nn::os
