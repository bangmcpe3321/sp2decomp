// sead::GameFrameworkNx — the boot root's step 5, ported from 0x7100e6724c (20 bytes).
//
// The decompiled body forwards to two things:
//
//   void sead::GameFrameworkNx::initialize(const Framework::InitializeArg& arg) {
//       GameFramework::initialize(arg);      // 0x7100e69fe4, 456 bytes
//       PerformanceMgrNx::initialize();      // 0x7100e68c44 -- a 4-byte PLATFORM import
//   }
//
// PerformanceMgrNx::initialize's own body is a single call through a platform GOT slot:
//   (*(code *)PTR_Initialize_7102f9a698)();
// PORT_WORKLIST.md line 90 attributes that slot to nn::oe::Initialize (0x71014121c8), so
// game_framework_nx.cpp now calls into the platform layer instead of only counting the step.
// The target configures the operator environment; the port's version is a recorded no-op
// (see nn/services.hpp), because no host equivalent exists and the call site exposes no
// parameters to model.
#pragma once

// GameFrameworkNx derives from GameFramework, so its definition is needed here -- including
// only framework_args.hpp left GameFramework incomplete and the compiler rejected the base
// class.
#include "sead/game_framework.hpp"

namespace sead {

// sead::PerformanceMgrNx — only the function the boot root reaches.
class PerformanceMgrNx {
public:
    // 0x7100e68c44, 4 bytes: forwards to the platform import PTR_Initialize_7102f9a698.
    static void initialize();

    // How many times the platform entry has been invoked. Exposed so a test can verify the
    // forward actually happened rather than the call being silently dropped.
    static int initializeCount();
};

// sead::GameFrameworkNx — the boot root's step 5.
class GameFrameworkNx : public GameFramework {
public:
    // 0x7100e6724c, 20 bytes.
    static void initialize(const InitializeArg &arg);
};

} // namespace sead
