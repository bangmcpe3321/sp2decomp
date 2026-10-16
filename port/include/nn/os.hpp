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
// its own objects (e.g. `nn::os::InitializeMutex(pMVar9, false, 0)` writes into a
// caller-owned field), so what matters for correctness is that the host backing store
// fits — a `static_assert` in the implementation enforces that.
//
// NOTE ON SIZES: the true `sizeof(MutexType)` in the shipped SDK is not established by
// this session's evidence. The sizes below are chosen large enough to hold the host
// primitives, which is the requirement for the port; they are NOT a claim about the
// original ABI. Establishing the real sizes from the binary would need the field-offset
// analysis used for `sead::GameFrameworkNx` in docs/VTABLE_VERIFICATION.md.
struct MutexType {
    // Backed by a host mutex in the PC stand-in. 64 bytes holds a recursive_mutex with
    // headroom on x86-64 Linux and Windows.
    alignas(16) unsigned char storage[0x40];
};

struct SemaphoreType {
    alignas(16) unsigned char storage[0x40];
};

struct ThreadType {
    alignas(16) unsigned char storage[0x80];
};

struct EventType {
    alignas(16) unsigned char storage[0x40];
};

// Returned by QueryMemoryInfo; the game passes a pointer it owns.
struct MemoryInfo {
    std::uint64_t totalSize;      // observed: QueryMemoryInfo(&local)
    std::uint64_t usedSize;
};

// ---- time ----------------------------------------------------------------
// `uVar5 = nn::os::GetSystemTick();`  — 677 call sites across 615 callers.
// Zero arguments, 64-bit result. The Switch tick frequency is 19.2 MHz.
constexpr std::uint64_t kTickFrequencyHz = 19'200'000;
std::uint64_t GetSystemTick();

// `nn::os::SleepThread(5000000);` — 23 call sites. Nanoseconds.
void SleepThread(std::int64_t nanoseconds);

// `nn::os::ConvertToTimeSpan(...)` — 21 call sites.
std::uint64_t ConvertToTimeSpan(std::int64_t nanoseconds);

// ---- TLS -----------------------------------------------------------------
// `lVar8 = nn::os::GetTlsValue(*(undefined4 *)puVar6);`   — 264 call sites.
// `nn::os::SetTlsValue(*(undefined4 *)(this + 0x88), this_00);` — 8 call sites.
// The slot is a 32-bit index; the value is a pointer-wide quantity.
void *GetTlsValue(std::uint32_t slot);
void SetTlsValue(std::uint32_t slot, void *value);
std::uint32_t AllocateTlsSlot();

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

// ---- CPU / threads -------------------------------------------------------
// `uVar7 = nn::os::GetCurrentCoreNumber();` — 121 call sites.
std::uint32_t GetCurrentCoreNumber();
std::uint64_t GetThreadAvailableCoreMask();
void SetThreadCoreMask(ThreadType *thread, int core, std::uint64_t mask);
void ChangeThreadPriority(ThreadType *thread, int priority);
std::uint32_t GetCurrentThread();
std::uint64_t GetThreadId(ThreadType *thread);

} // namespace nn::os
