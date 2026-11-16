// Contract tests for the eight platform symbols the boot closure listed but port/ did not
// define (PORT_WORKLIST.md §Phase 1-4, PLATFORM_REFERENCE.md §nv/nvn, §nn::time, §nn::nifm,
// §nn::oe):
//
//   nn::mem::StandardAllocator::Initialize   0x7101413008   real
//   nn::time::Initialize                     0x7101413048   real
//   nn::time::IsInitialized                  0x7101413e28   real
//   nn::nifm::Initialize                     0x7101413268   DOCUMENTED STUB
//   nn::oe::Initialize                       0x71014121c8   host no-op (recorded)
//   nv::InitializeGraphics                   0x7101413cc8   real (records the handover)
//   nv::SetGraphicsDevtoolsAllocator         0x7101413ce8   real (installs callbacks)
//   nvnBootstrapLoader                       0x7101413d48   real name->pointer lookup
//
// Each check names the property the call sites require. The nifm section is the only one where
// "did not crash" is the whole assertion, and it says so: there is no behaviour to check in a
// function the worklist explicitly says must be a stub.
#include "nn/services.hpp"
#include "nv/graphics_allocator.hpp"
#include "nvn/nvn.hpp"
#include "sead/game_framework_nx.hpp"

#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>

namespace {

int g_failures = 0;
int g_checks = 0;

void Check(bool cond, const char *what) {
    ++g_checks;
    if (!cond) { ++g_failures; std::printf("  FAIL  %s\n", what); }
    else { std::printf("  ok    %s\n", what); }
}

// Host-backed callbacks with the shapes nv::SetGraphicsAllocator installs.
void *HostAlloc(std::uint64_t size, std::uint64_t alignment, void *user) {
    (void)user;
    if (size == 0) return nullptr;
    if (alignment < alignof(void *)) alignment = alignof(void *);
    void *p = nullptr;
#if defined(_WIN32)
    p = _aligned_malloc(static_cast<std::size_t>(size), static_cast<std::size_t>(alignment));
#else
    if (posix_memalign(&p, static_cast<std::size_t>(alignment),
                       static_cast<std::size_t>(size)) != 0) p = nullptr;
#endif
    return p;
}

void HostFree(void *ptr, void *user) {
    (void)user;
#if defined(_WIN32)
    _aligned_free(ptr);
#else
    std::free(ptr);
#endif
}

void *HostRealloc(void *ptr, std::uint64_t size, std::uint64_t alignment, void *user) {
    (void)user;
    if (ptr == nullptr) return HostAlloc(size, alignment, user);
    if (size == 0) { HostFree(ptr, user); return nullptr; }
    void *p = HostAlloc(size, alignment, user);
    if (p != nullptr) {
        std::memcpy(p, ptr, static_cast<std::size_t>(size));
        HostFree(ptr, user);
    }
    return p;
}

// Stand-ins for the two NVN entry points the binary asks the bootstrap loader for.
void RealDeviceInitialize() {}
void RealDeviceGetProcAddress() {}

// ---------------------------------------------------------------------------
// nn::mem::StandardAllocator::Initialize — the only Phase-1 absence.
// Call site: nn::init::InitializeAllocator (0x7100dda018) constructs the global
// allocator and then initialises it with the boot block. The contract is therefore
// the 3-argument constructor's buffer-backed mode applied to an existing object.
// ---------------------------------------------------------------------------
void TestStandardAllocatorInitialize() {
    std::printf("nn::mem::StandardAllocator::Initialize (0x7101413008, real)\n");

    {
        alignas(16) unsigned char block[512];
        alignas(16) nn::mem::StandardAllocator alloc; // constructed first, as InitializeAllocator does
        alloc.Initialize(block, sizeof(block));

        void *p1 = alloc.Allocate(64, 16);
        Check(p1 != nullptr, "after Initialize(buffer, size) the allocator allocates");
        Check(p1 >= block && static_cast<unsigned char *>(p1) < block + sizeof(block),
              "and the memory comes from the caller's block");
        Check((reinterpret_cast<std::uintptr_t>(p1) % 16) == 0,
              "the requested alignment is honoured inside the block");

        void *p2 = alloc.Allocate(64, 16);
        Check(p2 != nullptr && p2 != p1, "successive allocations do not alias");

        bool exhausted = false;
        for (int i = 0; i < 32; ++i) {
            if (alloc.Allocate(64, 16) == nullptr) { exhausted = true; break; }
        }
        Check(exhausted, "exhausting the block returns null instead of overflowing it");

        alloc.Free(p1);
        void *reused = alloc.Allocate(64, 16);
        Check(reused != nullptr, "Free returns the block to the free list");
        Check(reused == p1, "the next allocation reuses the freed block");

        alloc.Free(p2);
        alloc.Free(reused);
        void *combined = alloc.Allocate(128, 16);
        Check(combined != nullptr, "adjacent freed blocks coalesce for a larger request");
        Check(combined == p1, "the coalesced block starts at the first freed block");
    }

    std::printf("\n  re-initialisation (the observed call happens once, but must not corrupt)\n");
    {
        alignas(16) unsigned char first[128];
        alignas(16) unsigned char second[128];
        alignas(16) nn::mem::StandardAllocator alloc;
        alloc.Initialize(first, sizeof(first));
        void *a = alloc.Allocate(64, 8);
        Check(a != nullptr && a >= first && static_cast<unsigned char *>(a) < first + sizeof(first),
              "the first block serves the first allocation");

        alloc.Initialize(second, sizeof(second));
        void *b = alloc.Allocate(64, 8);
        Check(b != nullptr && b >= second && static_cast<unsigned char *>(b) < second + sizeof(second),
              "Initialize again re-targets the allocator at the new block");
        Check(b == static_cast<void *>(second),
              "and restarts the bump at the new block's base");
    }

    std::printf("\n  the rejected handover (void return, so Allocate is the only signal)\n");
    {
        alignas(16) unsigned char block[128];
        alignas(16) nn::mem::StandardAllocator alloc;
        alloc.Initialize(nullptr, 0);
        Check(alloc.Allocate(16) == nullptr,
              "Initialize(nullptr, 0) leaves the allocator uninitialised, NOT host-heap backed");
        alloc.Free(nullptr);
        Check(true, "Free(nullptr) remains safe in that state");

        alloc.Initialize(block, sizeof(block));
        Check(alloc.Allocate(16) != nullptr, "a later valid Initialize recovers the allocator");
    }
}

// ---------------------------------------------------------------------------
// nn::time::Initialize / IsInitialized — one call site, sead::DateTime::setNow
// (0x7100ea7ec4), which asks IsInitialized, initialises, then reads the clock. The
// two functions and the clock path share one flag (see services.cpp).
// ---------------------------------------------------------------------------
void TestTimeModule() {
    std::printf("\nnn::time::Initialize / IsInitialized (0x7101413048 / 0x7101413e28, real)\n");

    nn::time::ResetForTesting();
    Check(!nn::time::IsInitialized(), "a reset module reports not initialised");

    nn::time::Initialize();
    Check(nn::time::IsInitialized(), "Initialize makes IsInitialized true");

    nn::time::Initialize();
    Check(nn::time::IsInitialized(), "a second Initialize is idempotent");

    nn::time::ResetForTesting();
    Check(!nn::time::IsInitialized(), "the flag is real state, not a constant");

    nn::time::PosixTime now = 0;
    Check(nn::time::StandardUserSystemClock::GetCurrentTime(&now) == 0,
          "GetCurrentTime still succeeds without an explicit Initialize");
    Check(now > 0, "and yields a time");
    Check(nn::time::IsInitialized(),
          "reading the clock records the same flag the module shares (host clock needs no service)");
}

// ---------------------------------------------------------------------------
// nn::nifm::Initialize — DOCUMENTED STUB.
// PORT_WORKLIST.md line 144: "nn::nifm should be stubbed, not implemented". The boot
// caller (Lp::Sys::SysInit::Init) ignores the result. There is deliberately no network
// behaviour to assert, so these checks are exactly "the stub is reachable, accepts the
// call, and reports acceptance" -- the only contract a stub has.
// ---------------------------------------------------------------------------
void TestNifmStub() {
    std::printf("\nnn::nifm::Initialize (0x7101413268, DOCUMENTED STUB)\n");

    const int before = nn::nifm::initializeCount();
    Check(nn::nifm::Initialize() == 0,
          "the stub accepts the call (0 = accepted; it does NOT mean a network exists)");
    Check(nn::nifm::initializeCount() == before + 1,
          "and records that the boot path reached the symbol");

    // Repeat calls are safe; this is the whole extent of a stub's contract.
    nn::nifm::Initialize();
    Check(nn::nifm::initializeCount() == before + 2,
          "repeat calls are accepted without side effects (nothing is opened or configured)");
}

// ---------------------------------------------------------------------------
// nn::oe::Initialize — host no-op, reached through sead::PerformanceMgrNx::initialize's
// GOT-slot forward (PORT_WORKLIST.md line 90). The wrapper count and the platform count
// are separate so the two hops are distinguishable.
// ---------------------------------------------------------------------------
void TestOeInitialize() {
    std::printf("\nnn::oe::Initialize (0x71014121c8, host no-op reached via PerformanceMgrNx)\n");

    const int seadBefore = sead::PerformanceMgrNx::initializeCount();
    const int oeBefore = nn::oe::initializeCount();

    sead::PerformanceMgrNx::initialize();
    Check(sead::PerformanceMgrNx::initializeCount() == seadBefore + 1,
          "PerformanceMgrNx::initialize still counts its own step");
    Check(nn::oe::initializeCount() == oeBefore + 1,
          "and the forward now lands in nn::oe::Initialize rather than a dead slot");

    nn::oe::Initialize();
    Check(nn::oe::initializeCount() == oeBefore + 2, "a direct call is recorded too");
}

// ---------------------------------------------------------------------------
// nv::InitializeGraphics and nv::SetGraphicsDevtoolsAllocator — both from
// sead::GameFrameworkNx::initializeGraphicsSystem (0x7100e6738c), alongside the already
// ported nv::SetGraphicsAllocator.
// ---------------------------------------------------------------------------
void TestNvGraphicsSeams() {
    std::printf("\nnv::InitializeGraphics (0x7101413cc8, records the handover)\n");

    nv::ResetForTesting();
    Check(!nv::graphicsHeapValid(), "no graphics heap is recorded initially");
    Check(nv::initializeGraphicsCallCount() == 0, "and the call count starts at zero");

    alignas(16) unsigned char heap[4096];
    nv::InitializeGraphics(heap, sizeof(heap));
    Check(nv::graphicsHeapBase() == static_cast<void *>(heap),
          "the block the engine supplied is recorded exactly");
    Check(nv::graphicsHeapSize() == sizeof(heap), "and so is its size");
    Check(nv::graphicsHeapValid(), "so the handover is reported valid");
    Check(nv::initializeGraphicsCallCount() == 1, "the call is counted");

    std::printf("\n  the two directions across the boundary do not collide\n");
    nv::SetGraphicsAllocator(&HostAlloc, &HostFree, &HostRealloc, nullptr);
    alignas(16) unsigned char second[64];
    nv::InitializeGraphics(second, sizeof(second));
    Check(nv::currentAlloc() == &HostAlloc,
          "a heap handover does not disturb the installed graphics allocator");
    Check(nv::graphicsHeapBase() == static_cast<void *>(second),
          "a second handover replaces the recorded block");

    nv::InitializeGraphics(nullptr, 0);
    Check(!nv::graphicsHeapValid(),
          "an invalid handover is recorded as invalid rather than accepted");
    Check(nv::initializeGraphicsCallCount() == 3,
          "and is still counted, so the attempt stays visible");

    std::printf("\nnv::SetGraphicsDevtoolsAllocator (0x7101413ce8, installs callbacks)\n");

    nv::ResetForTesting();
    Check(nv::AllocViaDevtoolsAllocator(64, 8) == nullptr,
          "allocating before any devtools install returns null rather than faulting");

    void *tag = reinterpret_cast<void *>(0x1234);
    nv::SetGraphicsDevtoolsAllocator(&HostAlloc, &HostFree, &HostRealloc, tag);
    Check(nv::currentDevtoolsAlloc() == &HostAlloc, "the alloc callback is installed");
    Check(nv::currentDevtoolsFree() == &HostFree, "the free callback is installed");
    Check(nv::currentDevtoolsRealloc() == &HostRealloc, "the realloc callback is installed");
    Check(nv::currentDevtoolsUser() == tag, "user data is stored as passed");

    Check(nv::currentAlloc() == nullptr,
          "the devtools install does not touch the graphics allocator's slots");

    const int before = nv::devtoolsAllocatorCallCount();
    void *p = nv::AllocViaDevtoolsAllocator(0x100, 16);
    Check(p != nullptr, "the installed devtools allocator is actually reachable");
    Check(nv::devtoolsAllocatorCallCount() == before + 1, "and the call is counted");
    Check(p != nullptr && (reinterpret_cast<std::uintptr_t>(p) % 16) == 0,
          "the requested alignment is honoured");
    HostFree(p, tag);
}

// ---------------------------------------------------------------------------
// nvnBootstrapLoader — name in, function address out. Consistent with nvn::LoadCProcs:
// same Proc type, same 453 names, same "unbacked is reported, not faked" rule. Null is the
// documented fallback, and both binary call sites null-check the result.
// ---------------------------------------------------------------------------
void TestNvnBootstrapLoader() {
    std::printf("\nnvnBootstrapLoader (0x7101413d48, name -> pointer)\n");

    nvn::ResetForTesting();
    Check(nvn::BootstrapLoader(nullptr) == nullptr, "a null name has no answer");
    Check(nvn::BootstrapLoader("") == nullptr, "an empty name has no answer");

    const int lookups0 = nvn::bootstrapLookupCount();
    const int misses0 = nvn::bootstrapMissCount();
    Check(nvn::BootstrapLoader("nvnNotAFunction") == nullptr,
          "an unknown name returns the documented fallback (null)");
    Check(nvn::bootstrapLookupCount() == lookups0 + 1, "the lookup is counted");
    Check(nvn::bootstrapMissCount() == misses0 + 1, "and so is the miss");

    std::printf("\n  host registrations (the port seam, not a fabricated table)\n");
    const auto deviceInit = reinterpret_cast<nvn::Proc>(&RealDeviceInitialize);
    const auto deviceGetProc = reinterpret_cast<nvn::Proc>(&RealDeviceGetProcAddress);
    Check(!nvn::RegisterBootstrapProc(nullptr, deviceInit), "a null name cannot be registered");
    Check(!nvn::RegisterBootstrapProc("nvnDeviceInitialize", nullptr),
          "a null implementation cannot be registered");
    Check(nvn::RegisterBootstrapProc("nvnDeviceInitialize", deviceInit),
          "a host implementation can be registered");
    Check(nvn::BootstrapLoader("nvnDeviceInitialize") == deviceInit,
          "and the loader returns it by that name");
    Check(nvn::RegisterBootstrapProc("nvnDeviceInitialize", deviceGetProc),
          "re-registering a name is allowed");
    Check(nvn::BootstrapLoader("nvnDeviceInitialize") == deviceGetProc,
          "and the newer implementation replaces the older one");

    std::printf("\n  the LoadCProcs table route (same names, same Proc type)\n");
    nvn::ResetForTesting();
    Check(!nvn::ProcsLoaded(), "the table starts unresolved");

    auto resolver = [](void *, const char *name) -> void * {
        if (std::strcmp(name, "nvnDeviceInitialize") == 0) {
            return reinterpret_cast<void *>(&RealDeviceInitialize);
        }
        return nullptr; // everything else unbacked, as on a host with no NVN
    };
    Check(nvn::LoadCProcs(nullptr, resolver) == 453, "LoadCProcs resolves the measured 453 names");
    Check(nvn::ProcsLoaded(), "and reports the table as loaded");

    int deviceInitSlot = -1;
    for (int i = 0; i < nvn::kProcCount; ++i) {
        const char *n = nvn::ProcName(i);
        if (n != nullptr && std::strcmp(n, "nvnDeviceInitialize") == 0) { deviceInitSlot = i; break; }
    }
    Check(deviceInitSlot >= 0, "nvnDeviceInitialize is part of the 453-name surface");
    Check(nvn::ProcIsBacked(deviceInitSlot), "the slot the resolver backed reports as backed");
    Check(!nvn::ProcIsBacked(0), "a slot the resolver declined does not");

    Check(nvn::BootstrapLoader("nvnDeviceInitialize") == deviceInit,
          "the loader answers from the LoadCProcs table by the same name");
    const int missBeforeUnbacked = nvn::bootstrapMissCount();
    Check(nvn::BootstrapLoader("nvnDeviceBuilderSetDefaults") == nullptr,
          "an unbacked NVN slot is a miss, not a silent no-op pointer");
    Check(nvn::bootstrapMissCount() == missBeforeUnbacked + 1, "and the miss is counted");

    nvn::ResetForTesting();
    Check(nvn::BootstrapLoader("nvnDeviceInitialize") == nullptr,
          "ResetForTesting clears both the table and the host registrations");
}

} // namespace

int main() {
    std::printf("platform symbols the boot closure called but port/ did not define\n");
    std::printf("(PORT_WORKLIST.md Phase 1-4; real vs documented stub named per section)\n\n");

    TestStandardAllocatorInitialize();
    TestTimeModule();
    TestNifmStub();
    TestOeInitialize();
    TestNvGraphicsSeams();
    TestNvnBootstrapLoader();

    std::printf("\n----------------------------------------\n");
    std::printf("%d checks, %d failures\n", g_checks, g_failures);
    return g_failures == 0 ? 0 : 1;
}
