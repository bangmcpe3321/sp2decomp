// The reconstructed boot sequence.
//
// Order and arguments are taken from the decompiled body of Lp::Sys::SysInit::Init
// (0x71011f5b20). Each step either calls a reconstructed engine function or declares the
// dependency missing via LP_ENGINE_REQUIRE, which throws and stops the run. Nothing is
// silently stubbed.
#include "lp/boot_sequence.hpp"

#include "lp/recon.hpp"
#include "lp/utl.hpp"
#include "nn/os.hpp"

#include <cstdio>

namespace lp::recon {

std::string BootRunResult::summary() const {
    std::string s;
    s += "reconstructed steps completed: " + std::to_string(completed.size()) + "\n";
    for (std::size_t i = 0; i < completed.size(); ++i) {
        s += "  [" + std::to_string(i + 1) + "] " + completed[i] + "\n";
    }
    if (reachedEnd) {
        s += "run reached the end of the reconstructed sequence\n";
    } else {
        char buf[48];
        std::snprintf(buf, sizeof(buf), " (0x%llx)",
                      static_cast<unsigned long long>(stoppedAtAddress));
        s += "STOPPED AT: " + stoppedAt + (stoppedAtAddress ? buf : "") + "\n";
    }
    return s;
}

namespace {

// Addresses of the boot root's 13 direct engine dependencies, from
// docs/ENGINE_RECONSTRUCTION.md. Kept here because the sequence reports them.
constexpr std::uintptr_t kDumpDateTime            = 0x71012cdbf4;
constexpr std::uintptr_t kAssertRegisterCallback  = 0x7101397fac;
constexpr std::uintptr_t kInitializeArgCtor       = 0x7100e69894;
constexpr std::uintptr_t kGameFrameworkInitialize = 0x7100e6724c;
constexpr std::uintptr_t kDumpMemoryInfo          = 0x71012cdccc;
constexpr std::uintptr_t kForegroundBucketInit    = 0x710139fb3c;
constexpr std::uintptr_t kHeapGroupCreateInstance = 0x7100ea1f54;
constexpr std::uintptr_t kHeapGroupCreateHeap     = 0x71011f5130;
constexpr std::uintptr_t kFrameworkCtor           = 0x7100e696a4;
constexpr std::uintptr_t kInitializeGraphicsSystem= 0x7100e6738c;
constexpr std::uintptr_t kMgrTaskArgCtor          = 0x7100e6b7bc;
constexpr std::uintptr_t kRunArgCtor              = 0x7100e698a0;

// Tracks what this run has completed, and catches the loud failure so the caller gets a
// precise "the port ends here" report instead of an abort.
struct Runner {
    BootRunResult result;

    void step(const char *name, void (*fn)()) {
        fn();
        result.completed.push_back(name);
    }

    void missing(const char *name, std::uintptr_t addr) {
        // Either this throws (dependency absent) or the dependency is present.
        LP_ENGINE_REQUIRE(name, addr);
    }

    void run(void (*body)(Runner &)) {
        try {
            body(*this);
            result.reachedEnd = true;
        } catch (const MissingEngineDependency &e) {
            result.stoppedAt = e.name();
            result.stoppedAtAddress = e.address();
        }
    }
};

void SequenceBody(Runner &r) {
    // --- step 1: dumpDateTime(" Application Start Time") ---------------------------
    // The literal is the one at the call site in the boot root's body.
    r.step("Lp::Utl::dumpDateTime(\" Application Start Time\")", [] {
        Lp::Utl::dumpDateTime(" Application Start Time");
    });

    // --- step 2: GetSystemTick -> sRunStartTime ------------------------------------
    // Platform-layer call; already implemented, so it runs rather than being declared.
    r.step("nn::os::GetSystemTick -> sRunStartTime", [] {
        volatile std::uint64_t recorded = nn::os::GetSystemTick();
        (void)recorded;
    });

    // --- step 3: sead::AssertConfig::registerCallback ------------------------------
    // The next real engine dependency. Runs if ported, otherwise stops the run here.
    r.missing("sead::AssertConfig::registerCallback", kAssertRegisterCallback);

    // --- step 4: sead::Framework::InitializeArg::InitializeArg ---------------------
    r.missing("sead::Framework::InitializeArg::InitializeArg", kInitializeArgCtor);

    // --- step 5: sead::GameFrameworkNx::initialize ---------------------------------
    r.missing("sead::GameFrameworkNx::initialize", kGameFrameworkInitialize);

    // --- step 6: dumpMemoryInfo("Application Start") -------------------------------
    // NOTE ORDERING: this is ported, but it sits AFTER two unported dependencies in the
    // boot root's order. With fail-loudly the run stops at step 3 and never reaches it,
    // which is the correct behaviour -- but it means this step is unreachable until steps
    // 3-5 are ported. Recorded so the gap is visible rather than surprising.
    r.step("Lp::Utl::dumpMemoryInfo(\"Application Start\")", [] {
        Lp::Utl::dumpMemoryInfo("Application Start");
    });

    // --- step 7 onward: remaining boot-root dependencies ---------------------------
    r.missing("sead::ForegroundBucketMgr::initialize", kForegroundBucketInit);
    r.missing("HeapGroup::createInstance", kHeapGroupCreateInstance);
    r.missing("HeapGroup::createHeap", kHeapGroupCreateHeap);
    r.missing("Framework::Framework", kFrameworkCtor);
    r.missing("sead::GameFrameworkNx::initializeGraphicsSystem", kInitializeGraphicsSystem);
    r.missing("sead::TaskBase::MgrTaskArg::MgrTaskArg", kMgrTaskArgCtor);
    r.missing("sead::Framework::RunArg::RunArg", kRunArgCtor);
}

} // namespace

BootRunResult runBootSequence() {
    Runner r;
    r.run(SequenceBody);
    return r.result;
}

} // namespace lp::recon
