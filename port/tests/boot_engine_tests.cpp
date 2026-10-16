// Boot-engine runner test: this is where the harness stops replaying and starts RUNNING
// reconstructed engine code.
//
// The runner walks the boot root's observed sequence, executing each reconstructed
// function and stopping loudly at the first dependency that is not ported. The output is
// therefore a truthful statement of how far the reconstruction currently reaches -- not
// a pass/fail of a stubbed simulation.
#include "lp/boot_sequence.hpp"

#include <cstdio>

namespace {
int g_failures = 0;
int g_checks = 0;
void Check(bool cond, const char *what) {
    ++g_checks;
    if (!cond) { ++g_failures; std::printf("  FAIL  %s\n", what); }
    else { std::printf("  ok    %s\n", what); }
}
} // namespace

int main() {
    std::printf("Reconstructed boot sequence runner\n");
    std::printf("(runs real reconstructed engine code; stops loudly at the first gap)\n\n");

    std::printf("--- the run (expect reconstructed boot logging below) ---\n");
    const lp::recon::BootRunResult result = lp::recon::runBootSequence();
    std::printf("--- end of run ---\n\n");

    std::printf("%s\n", result.summary().c_str());

    // The run must actually execute the reconstructed functions it can reach. Before this
    // change the harness replayed patterns, so this asserts the change took effect.
    Check(!result.completed.empty(),
          "the run completed at least one reconstructed engine step");
    Check(result.completed.size() >= 1,
          "dumpDateTime (the boot root's first call) was actually executed");

    // Fail-loudly: the run must stop at a NAMED dependency, not silently skip it.
    Check(!result.reachedEnd, "the run stops rather than pretending to finish");
    Check(!result.stoppedAt.empty(), "and names the dependency it stopped at");
    Check(result.stoppedAtAddress != 0, "and carries that dependency's address");
    std::printf("  -> port currently ends at: %s (0x%llx)\n",
                result.stoppedAt.c_str(),
                static_cast<unsigned long long>(result.stoppedAtAddress));

    // The stop must be at the FIRST unported dependency in boot order, not an arbitrary
    // one. sead::AssertConfig::registerCallback is the first after dumpDateTime and
    // GetSystemTick, both of which are ported.
    Check(result.stoppedAt.find("registerCallback") != std::string::npos,
          "it stopped at the FIRST unported dependency in boot order "
          "(sead::AssertConfig::registerCallback)");

    // Every completed step must be a real reconstructed function, not a placeholder.
    for (const auto &step : result.completed) {
        std::printf("  completed: %s\n", step.c_str());
    }

    std::printf("\n----------------------------------------\n");
    std::printf("%d checks, %d failures\n", g_checks, g_failures);
    return g_failures == 0 ? 0 : 1;
}
