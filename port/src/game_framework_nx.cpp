// sead::GameFrameworkNx / PerformanceMgrNx — the boot root's step 5.
#include "sead/game_framework_nx.hpp"

#include "nn/services.hpp"
#include "sead/game_framework.hpp"

namespace sead {

namespace {
int gPerfInitCount = 0;
} // namespace

int PerformanceMgrNx::initializeCount() { return gPerfInitCount; }

void PerformanceMgrNx::initialize() {
    // The binary's whole body is `(*(code *)PTR_Initialize_7102f9a698)();` -- a call through a
    // platform GOT slot. PORT_WORKLIST.md line 90 attributes that slot to nn::oe::Initialize
    // (0x71014121c8), so the forward is now implemented rather than merely counted:
    nn::oe::Initialize();
    // Kept as a separate count because this is the sead-side step: a test can distinguish
    // "the wrapper ran" from "the platform entry was reached".
    ++gPerfInitCount;
}

void GameFrameworkNx::initialize(const InitializeArg &arg) {
    //   GameFramework::initialize(param_1);
    GameFramework::initialize(arg);
    //   PerformanceMgrNx::initialize();
    PerformanceMgrNx::initialize();
}

} // namespace sead
