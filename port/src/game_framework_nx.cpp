// sead::GameFrameworkNx / PerformanceMgrNx — the boot root's step 5.
#include "sead/game_framework_nx.hpp"

#include "sead/game_framework.hpp"

namespace sead {

namespace {
int gPerfInitCount = 0;
} // namespace

int PerformanceMgrNx::initializeCount() { return gPerfInitCount; }

void PerformanceMgrNx::initialize() {
    // The binary's whole body is `(*(code *)PTR_Initialize_7102f9a698)();` -- a call through a
    // platform GOT slot. The slot's target is a platform entry (the name is not recoverable
    // from this call site), so the port records the invocation rather than inventing a
    // performance policy.
    //
    // This is the platform boundary again, exactly as nn::os was: a sead class forwarding to a
    // platform import. When the platform layer gains that entry, this is where it plugs in.
    ++gPerfInitCount;
}

void GameFrameworkNx::initialize(const InitializeArg &arg) {
    //   GameFramework::initialize(param_1);
    GameFramework::initialize(arg);
    //   PerformanceMgrNx::initialize();
    PerformanceMgrNx::initialize();
}

} // namespace sead
