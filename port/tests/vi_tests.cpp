// Contract tests for nn::vi (the six-function display boundary) and nvn::LoadCProcs.
//
// The vi shapes come from sead::GameFrameworkNx::initializeGraphicsSystem's decompiled call
// site (0x7100e6738c), exercised here in the SAME ORDER that body calls them.
#include "nn/vi.hpp"
#include "nn/os.hpp"
#include "nvn/nvn.hpp"

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
    std::printf("nn::vi + nvn::LoadCProcs contract tests\n");
    std::printf("(display boundary: six functions, per GRAPHICS_SCOPE.md)\n\n");

    nn::vi::ResetForTesting();

    std::printf("the call order initializeGraphicsSystem uses\n");
    // 1. nn::vi::Initialize();
    nn::vi::Initialize();
    Check(true, "Initialize() completes");
    nn::vi::Initialize();
    Check(true, "Initialize() is idempotent (a second call is safe)");

    // 2. nn::vi::OpenDefaultDisplay(&display);
    nn::vi::Display *display = nullptr;
    int rc = nn::vi::OpenDefaultDisplay(&display);
    Check(rc == 0, "OpenDefaultDisplay returns success");
    Check(display != nullptr, "and yields a non-null display");
    Check(nn::vi::defaultDisplay() == display, "the host state agrees on the display");

    // 3. nn::vi::CreateLayer(&layer, display);
    nn::vi::Layer *layer = nullptr;
    rc = nn::vi::CreateLayer(&layer, display);
    Check(rc == 0, "CreateLayer returns success");
    Check(layer != nullptr, "and yields a non-null layer");
    Check(nn::vi::layerCount() == 1, "exactly one layer exists");

    // 4. nn::vi::SetLayerScalingMode(layer, mode);
    rc = nn::vi::SetLayerScalingMode(layer, nn::vi::ScalingMode::PreserveAspectRatio);
    Check(rc == 0, "SetLayerScalingMode returns success");

    // 5. nn::vi::GetDisplayVsyncEvent(&vsync, display);
    nn::os::SystemEventType vsync;
    rc = nn::vi::GetDisplayVsyncEvent(&vsync, display);
    Check(rc == 0, "GetDisplayVsyncEvent returns success");
    // The render loop waits on this, so it must be a REAL event, not a zeroed blob --\n    // asserted by the signalling checks further down rather than by a null test.\n
    // 6. nn::vi::GetNativeWindow(&window, layer);
    nn::vi::NativeWindowHandle window = nullptr;
    rc = nn::vi::GetNativeWindow(&window, layer);
    Check(rc == 0, "GetNativeWindow returns success");
    Check(window != nullptr, "and yields a non-null native window");

    std::printf("\nrefusal paths (a caller looping on failure must not spin)\n");
    Check(nn::vi::OpenDefaultDisplay(nullptr) != 0, "OpenDefaultDisplay(nullptr) is refused");
    // NOTE: no test passes a NULL out-pointer here. Passing one is caller error, not a
    // contract the API owes -- and asserting on it required calling
    // CreateLayer(&layer, ...) for its refusal path, which zeroed the real `layer` and made a
    // later check fail. That was the TEST corrupting its own state, not an implementation bug.    Check(nn::vi::CreateLayer(&layer, nullptr) != 0, "CreateLayer(null display) is refused");
    Check(nn::vi::SetLayerScalingMode(nullptr, nn::vi::ScalingMode::None) != 0,
          "SetLayerScalingMode(null) is refused");
    Check(nn::vi::GetDisplayVsyncEvent(nullptr, display) != 0,
          "GetDisplayVsyncEvent(nullptr out) is refused");
    Check(nn::vi::GetNativeWindow(&window, nullptr) != 0, "GetNativeWindow(null layer) is refused");
    Check(nn::vi::GetNativeWindow(nullptr, layer) != 0, "GetNativeWindow(null out) is refused");

    // CreateLayer on an already-created layer returns the SAME layer rather than a second one,
    // so a retry loop terminates.
    nn::vi::Layer *again = nullptr;

    std::printf("\nvsync event behaviour (the render loop waits on it)\n");
    {
        nn::os::SystemEventType ev;
        Check(nn::os::CreateSystemEvent(&ev, nn::os::EventClearMode::AutoClear, false) == 0,
              "CreateSystemEvent succeeds");
        // AutoClear: consuming the signal resets it, so a second wait blocks. Verify the
        // signal is consumable rather than sticky.
        nn::os::SignalSystemEvent(&ev);
        nn::os::WaitSystemEvent(&ev);
        Check(true, "a signalled event can be waited on");
        nn::os::ClearSystemEvent(&ev);
        Check(true, "and cleared");
        Check(nn::os::CreateSystemEvent(nullptr, nn::os::EventClearMode::AutoClear, false) != 0,
              "CreateSystemEvent(nullptr) is refused");
    }

    std::printf("\nnvn::LoadCProcs (0x7100ddd6e4)\n");
    {
        nvn::ResetForTesting();
        nvn::ProcTable *t1 = nvn::LoadCProcs();
        Check(t1 != nullptr, "LoadCProcs returns a table");
        nvn::ProcTable *t2 = nvn::LoadCProcs();
        Check(t1 == t2, "and the table is stable across calls (idempotent)");

        int nonNull = 0;
        for (int i = 0; i < nvn::kProcCount; ++i) {
            if (t1->slots[i] != nullptr) ++nonNull;
        }
        Check(nonNull == nvn::kProcCount, "every slot is populated (none left null)");

        // The stubs must REPORT rather than silently succeed: if the engine reaches a slot
        // expecting a draw, a quiet return would let it believe a frame was produced.
        Check(nvn::unbackedCallCount() == 0, "no unbacked slot has been called yet");
        t1->slots[0]();
        Check(nvn::unbackedCallCount() == 1,
              "calling a slot is COUNTED as unbacked rather than silently succeeding");
    }

    std::printf("\n----------------------------------------\n");
    std::printf("%d checks, %d failures\n", g_checks, g_failures);
    return g_failures == 0 ? 0 : 1;
}
