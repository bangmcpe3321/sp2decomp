// The reconstructed boot sequence runner.
//
// This is the change the goal called for: boot_integration previously *replayed* the
// observed call pattern with local stand-ins. This runs the REAL reconstructed engine
// functions, in the boot root's observed order, and fails loudly at the first
// dependency that is not yet ported.
//
// The sequence and its order come from the decompiled body of Lp::Sys::SysInit::Init
// (0x71011f5b20, 1308 bytes); see docs/BOOT_ENGINE_ORDER.md.
#pragma once

#include <cstdint>
#include <string>
#include <vector>

namespace lp::recon {

// Outcome of running the reconstructed boot sequence.
struct BootRunResult {
    // Names of engine functions that ran successfully, in order.
    std::vector<std::string> completed;
    // The first dependency that was not ported, if the run stopped.
    std::string stoppedAt;
    std::uintptr_t stoppedAtAddress = 0;
    bool reachedEnd = false;

    // Human-readable one-line summary of how far the run got.
    std::string summary() const;
};

// Run the reconstructed boot sequence.
//
// On reaching an unported dependency the run stops and records it rather than
// continuing -- see docs/ENGINE_RECONSTRUCTION.md for why silent stubbing is refused at
// this layer. LP_ENGINE_REQUIRE is what raises, and this catches it so the caller can
// report precisely where the port currently ends.
BootRunResult runBootSequence();

} // namespace lp::recon
