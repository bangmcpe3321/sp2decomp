// nn::fs / nn::time / nn::mem / nn::nifm / nn::oe — platform services reconstructed from
// call-site evidence.
#pragma once

#include <cstdint>
#include <cstddef>

namespace nn::fs {

// `nn::fs::QueryMountRomCacheSize(&local_28);` — out parameter, result code returned.
int QueryMountRomCacheSize(std::uint64_t *outSize);

// `nn::fs::MountRom("content", pvVar3, local_28);` — 2 sites, and the mount name is the
// literal "content" at both. Shape: (const char *name, void *cache, std::uint64_t size).
int MountRom(const char *name, void *cache, std::uint64_t cacheSize);

// `nn::fs::Unmount("content")` is the complement used by teardown paths.
int Unmount(const char *name);

} // namespace nn::fs

namespace nn::time {

// A PosixTime is nanoseconds since the Unix epoch (SDK convention).
using PosixTime = std::int64_t;

// `iVar6 = nn::time::StandardUserSystemClock::GetCurrentTime((PosixTime *)&local_18);`
struct CalendarTime {
    std::uint16_t year;
    std::uint8_t month;
    std::uint8_t day;
    std::uint8_t hour;
    std::uint8_t minute;
    std::uint8_t second;
    std::uint8_t padding;
};

struct CalendarAdditionalInfo {
    std::uint32_t dayOfWeek;
    std::uint32_t dayOfYear;
    std::int64_t gmtOffset;
    char name[8];
};

struct StandardUserSystemClock {
    static int GetCurrentTime(PosixTime *outTime);
    static int SetCurrentTime(PosixTime time);
};

// `nn::time::ToCalendarTime((CalendarTime *)&local_30, (CalendarAdditionalInfo *)0x0, aPStack_28);`
// -> int result; the additional-info argument may be null at observed call sites.
int ToCalendarTime(CalendarTime *outTime, CalendarAdditionalInfo *outInfo, PosixTime time);

// 0x7101413048 and 0x7101413e28. sead::DateTime::setNow (0x7100ea7ec4) is the closure's only
// call site, and it calls these in the order IsInitialized -> Initialize -> GetCurrentTime ->
// ToCalendarTime. The two functions therefore share one module flag, and on this port that flag
// is the same state GetCurrentTime's host-clock path uses -- there is no separate clock service
// to start, so reading the clock IS the initialisation this backend needs (see services.cpp).
// `IsInitialized` is declared bool because the call site consumes the result as a condition
// (`uVar2 = nn::time::IsInitialized();`); the 13-byte thunk renders as void only because the
// stub itself declares no parameters.
void Initialize();
bool IsInitialized();

// Clears the module flag. Not in the original API -- present so the tests can observe both
// states; nothing on the boot path resets time.
void ResetForTesting();

} // namespace nn::time

namespace nn::mem {

// `nn::mem::StandardAllocator::StandardAllocator((StandardAllocator *)(this + 0x230));`
// and a 3-argument form taking a backing buffer and size. The game embeds these inline
// in its own objects, so the storage is caller-owned.
//
// SIZE: not established by evidence. The game only ever holds it inline as a field, and
// no adjacent sibling field appears in the observed call sites, so no bound is derivable
// (unlike MessageQueueType, see docs/TYPE_SIZES.md).
class StandardAllocator {
public:
    StandardAllocator();
    StandardAllocator(void *buffer, std::size_t size);
    ~StandardAllocator();

    // 0x7101413008, observed as `void Initialize(void *param_1, ulong param_2)`. Its only
    // boot-closure caller is nn::init::InitializeAllocator, which constructs the game's global
    // allocator (`DAT_71036563a0`) and then initialises it with the block the boot root
    // obtained. The contract is the 3-argument constructor's buffer-backed mode applied to an
    // object that already exists: (buffer, size), with allocations served from a free-list
    // over `buffer`. The retail object is also a free-list allocator (see
    // PLATFORM_BODY_NOTES.md); the host version reuses and coalesces freed blocks rather than
    // bumping a high-water mark.
    //
    // `buffer == nullptr` or `size == 0` leaves the allocator marked UNINITIALISED, so
    // Allocate returns null instead of silently falling back to the host heap. That is a
    // choice for observability: the real function returns void and the decompiled call site
    // does not check anything, so there is no result channel to report through. The game
    // calls this immediately after construction, before any allocation; the port does not
    // attempt to reclaim blocks allocated prior to a re-initialisation (see services.cpp).
    void Initialize(void *buffer, std::size_t size);

    void *Allocate(std::size_t size, std::size_t alignment = 8);
    void *Allocate(std::size_t size, void (*onAllocate)(void *), void *user);
    void Free(void *ptr);

private:
    // Backed by a host allocator. The game never reads these fields directly.
    struct Impl;
    alignas(16) unsigned char mStorage[0x40];
};

} // namespace nn::mem

namespace nn::nifm {

// 0x7101413268. DOCUMENTED STUB -- PORT_WORKLIST.md line 144 says, in the stub policy,
// "`nn::nifm` should be stubbed, not implemented -- it is the network interface manager and
// is reached even on the offline boot path." The closure call site is `nn::nifm::Initialize();`
// in Lp::Sys::SysInit::Init (0x71011f5b20), which ignores the result. Two call sites outside
// the closure (`internetInitialize` 0x7101332a98 and `networkInitialize` 0x7101332e88) assign
// it (`iVar2 = nn::nifm::Initialize();`), so a result code is returned here.
//
// STUB CONTRACT: returns 0 (accepted) unconditionally and starts no network service. It must
// not be read as "the network is available" -- nothing was enumerated, opened or configured.
// Returning success rather than an error keeps the offline boot path from treating the absence
// of Wi-Fi as fatal, which is the whole point of stubbing this one.
int Initialize();

// How many times the stub has been entered. Matches the platform layer's existing convention
// (sead::PerformanceMgrNx::initializeCount, nv::allocatorCallCount) so a test can prove the
// boot path actually reaches the symbol rather than calling a dead declaration.
int initializeCount();

} // namespace nn::nifm

namespace nn::oe {

// 0x71014121c8. The closure call site is sead::PerformanceMgrNx::initialize
// (0x7100e68c44), whose whole body is a call through the platform GOT slot
// `PTR_Initialize_7102f9a698`; PORT_WORKLIST.md line 90 attributes that slot to this symbol.
// The result is ignored everywhere (`nn::oe::Initialize();`), so the signature is void.
//
// HOST NO-OP: the real service sets up the operator environment (performance/clock
// configuration). No host equivalent is modelled, and inventing one would mean inventing a
// performance policy the binary does not expose at this call site. The invocation is recorded
// and nothing else changes.
void Initialize();

// Entries into Initialize, so the forwarding in PerformanceMgrNx::initialize is testable.
int initializeCount();

} // namespace nn::oe
