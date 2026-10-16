// sead::AssertConfig::registerCallback — ported from 0x7101397fac against the sead
// reference's real DelegateEvent/Slot structure.
//
// The decompiled body is an inline expansion of DelegateEvent::connect:
//   if (slot.connected) { slot.node.erase(); slot.connected = false; }   // release()
//   ...unconditional release again...
//   slot.connection = <event>; slot.node.insertFront_(event.list); ++event.count;
//   slot.connected = true;
//
// sead's connect() is `slot.release(); mList.pushBack(&slot.mNode); slot.connected = true;`
// so the "duplicated disconnect" the decompile shows is release() being invoked once
// conditionally from within, then again unconditionally by connect — not a quirk.
#include "sead/delegate_event.hpp"

#include <cstddef>

namespace sead {

// The offsets the decompiled body reaches ARE the contract. If the structure drifts, the
// build fails here rather than corrupting memory at runtime.
static_assert(offsetof(DelegateEventSlot, mNode) == 0x20,
              "slot node must sit at +0x20 (decompile uses param_1 + 0x20)");
static_assert(offsetof(DelegateEventSlot, mDelegatePtr) == 0x38,
              "slot delegate pointer must sit at +0x38 (decompile reads param_1 + 0x38)");
static_assert(offsetof(DelegateEventSlot, mConnectedToDelegateEvent) == 0x68,
              "slot connected flag must sit at +0x68 (decompile reads param_1 + 0x68)");
static_assert(offsetof(DelegateEvent, mList) == 0x08,
              "event list head must sit at +0x08 (decompile uses PTR_sAssertEvent + 8)");
static_assert(offsetof(InvokableDelegate, mRefAt0x10) == 0x10,
              "the field the decompile writes through the delegate must be at +0x10");

DelegateEvent &AssertConfig::assertEvent() {
    // PTR_sAssertEvent_7102fd79a0's pointee lives in .bss (0x3698490, beyond EOF), so its
    // contents are not readable from the file; the object is modelled at the offsets the
    // decompiled code touches.
    static DelegateEvent sAssertEvent;
    return sAssertEvent;
}

void AssertConfig::registerCallback(DelegateEventSlot &slot) {
    // sead::DelegateEvent::connect is exactly this, and the decompiled body is its inline
    // expansion. Delegating to connect keeps a single source of truth for the sequence.
    assertEvent().connect(slot);
}

} // namespace sead
