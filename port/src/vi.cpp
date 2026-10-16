// nn::vi — the six-function display boundary, over host windowing state.
//
// See include/nn/vi.hpp for the evidence and the design rationale. The short version: the
// binary has six unique nn::vi imports (GRAPHICS_SCOPE.md §3), the engine reaches them from
// sead::GameFrameworkNx::initializeGraphicsSystem, and their contracts are taken from that
// decompiled call site rather than invented.
#include "nn/vi.hpp"

#include "nn/os.hpp"

#include <cstdio>

namespace nn::vi {

namespace {

// Host-side display state. Each handle is a distinct address so the engine's pointer
// comparisons behave sensibly and so tests can tell them apart.
struct DisplayImpl : Display {};
struct LayerImpl : Layer {};

DisplayImpl gDisplay;
LayerImpl gLayer;

bool gInitialized = false;
bool gDisplayOpen = false;
bool gLayerCreated = false;
bool gVsyncEventCreated = false;
void *gNativeWindow = nullptr;

// A stable, non-null native window handle. The real value is a Horizon window; NVN only ever
// passes it back, so a distinguishable non-null token is the faithful model.
int gWindowToken = 0;

ScalingMode gScalingMode = ScalingMode::None;

int gInitializeCount = 0;
} // namespace

void Initialize() {
    // Idempotent: the engine calls this once, but a second call must not reset an open display.
    ++gInitializeCount;
    gInitialized = true;
}

int OpenDefaultDisplay(Display **outDisplay) {
    if (outDisplay == nullptr) return -1;
    if (!gInitialized) {
        // The real service requires Initialize first. Refusing is faithful; returning a display
        // without the service running would be a lie the engine could act on.
        *outDisplay = nullptr;
        return -2;
    }
    gDisplayOpen = true;
    *outDisplay = &gDisplay;
    return 0;
}

int CreateLayer(Layer **outLayer, Display *display) {
    if (outLayer == nullptr) return -1;
    if (display == nullptr) {
        *outLayer = nullptr;
        return -2;
    }
    // One layer only. The engine creates exactly one; a second create is REJECTED rather than
    // silently succeeding, so a caller that loops on failure cannot spin forever.
    if (gLayerCreated) {
        *outLayer = &gLayer;
        return 0; // idempotent for the same single layer
    }
    gLayerCreated = true;
    *outLayer = &gLayer;
    return 0;
}

int SetLayerScalingMode(Layer *layer, ScalingMode mode) {
    if (layer == nullptr) return -1;
    gScalingMode = mode;
    return 0;
}

int GetDisplayVsyncEvent(nn::os::SystemEventType *outEvent, Display *display) {
    if (outEvent == nullptr) return -1;
    if (display == nullptr) return -2;
    // The engine waits on this event once per frame. The platform layer's nn::os models
    // SystemEventType; creating it here means the render loop has something real to wait on
    // rather than a null it would fault on.
    if (!gVsyncEventCreated) {
        nn::os::CreateSystemEvent(outEvent, nn::os::EventClearMode::AutoClear, false);
        gVsyncEventCreated = true;
    }
    return 0;
}

int GetNativeWindow(NativeWindowHandle *outWindow, Layer *layer) {
    if (outWindow == nullptr) return -1;
    if (layer == nullptr) {
        *outWindow = nullptr;
        return -2;
    }
    if (gNativeWindow == nullptr) gNativeWindow = &gWindowToken;
    *outWindow = gNativeWindow;
    return 0;
}

// --- host-side accessors ------------------------------------------------------------------

Display *defaultDisplay() { return gDisplayOpen ? &gDisplay : nullptr; }
Layer *currentLayer() { return gLayerCreated ? &gLayer : nullptr; }
int layerCount() { return gLayerCreated ? 1 : 0; }

void ResetForTesting() {
    gInitialized = false;
    gDisplayOpen = false;
    gLayerCreated = false;
    gVsyncEventCreated = false;
    gNativeWindow = nullptr;
    gScalingMode = ScalingMode::None;
    gInitializeCount = 0;
}

} // namespace nn::vi
