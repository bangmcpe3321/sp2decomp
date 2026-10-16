// nn::vi — the display boundary, reconstructed from call-site evidence.
//
// SIX functions, not twelve: GRAPHICS_SCOPE.md §3 enumerated the binary and found each
// nn::vi function appears twice (a .plt thunk at 0x7101413xxx and an EXTERNAL import at
// 0x710386x000), so the SYMBOL count of 12 is a FUNCTION count of 6. All six are imports
// resolved by a dynamic linker by name -- the same position as nn::os / nn::mem / nn::fs.
//
// The call site that matters is sead::GameFrameworkNx::initializeGraphicsSystem
// (0x7100e6738c), whose decompiled body is the evidence for the shapes below:
//
//   nn::vi::Initialize();
//   nn::vi::OpenDefaultDisplay(&display);
//   nn::vi::CreateLayer(&layer, display);
//   nn::vi::SetLayerScalingMode(layer, mode);
//   nn::vi::GetDisplayVsyncEvent(&vsyncEvent, display);
//   nn::vi::GetNativeWindow(&nativeWindow, layer);
//
// This is implemented over host windowing primitives -- one window, one swapchain -- rather
// than emulating Horizon's display service, the same interface-not-service choice the rest of
// the platform layer already makes.
#pragma once

#include <cstdint>

// nn::os::SystemEventType is a TYPEDEF (to EventType) in this layer, not a class, so it cannot
// be forward-declared -- an earlier revision tried and got a conflicting-declaration error.
#include "nn/os.hpp"

namespace nn::vi {

// Opaque handles. The engine only ever passes these around and hands them to GetNativeWindow,
// so their internals are not modelled -- which is faithful, since nothing on this path reads
// them. They are DEFINED (empty) rather than forward-declared because the port must create
// instances; the definitions stay empty so no member is invented.
struct Display {};
struct Layer {};

// The scaling modes SetLayerScalingMode takes. The exact enumerator set is the SDK's; the
// values here are the ones the call site is observed to use, with the rest left as named
// slots so an unexpected value is visible rather than silently plausible.
enum class ScalingMode : std::int32_t {
    None = 0,
    ScaleAndCrop = 1,
    PreserveAspectRatio = 2,
    ScaleToLayerSize = 3,
    Unknown = 4,
};

// The native window handle the engine passes to NVN.
using NativeWindowHandle = void *;

// --- the six imports, in the order initializeGraphicsSystem calls them --------------------

// 0x710386c000. Initialises the display service.
void Initialize();

// 0x710386f000. Returns the default display. Shape from the call site: an OUT parameter,
// result code returned.
int OpenDefaultDisplay(Display **outDisplay);

// 0x710386d000. Creates a layer on a display. Also OUT-parameter shaped.
int CreateLayer(Layer **outLayer, Display *display);

// 0x7103870000. Sets how the layer's content is scaled onto the display.
int SetLayerScalingMode(Layer *layer, ScalingMode mode);

// 0x7103871000. Hands back the display's vsync event, which the engine's render loop waits on.
int GetDisplayVsyncEvent(nn::os::SystemEventType *outEvent, Display *display);

// 0x710386e000. The handle NVN renders into.
int GetNativeWindow(NativeWindowHandle *outWindow, Layer *layer);

// --- host-side state, for the reconstruction and for tests --------------------------------

// The single display the port opens. Exposed so tests can assert OpenDefaultDisplay is
// idempotent and that CreateLayer refuses without one.
Display *defaultDisplay();

// The layer created on the default display, or null.
Layer *currentLayer();

// How many layers exist. The engine creates one; a second create is rejected rather than
// silently succeeding, so a caller looping on failure cannot spin forever.
int layerCount();

// Resets all host-side display state. Not part of the original's API -- present so tests are
// independent of each other.
void ResetForTesting();

} // namespace nn::vi
