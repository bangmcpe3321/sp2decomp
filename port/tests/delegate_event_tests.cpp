// sead::AssertConfig::registerCallback contract tests.
//
// Ported from the decompiled body at 0x7101397fac, rebuilt against sead's real
// DelegateEvent/Slot structure after the first attempt invented a refcount that does not
// exist (see port/attempted/LAYOUT_ANSWERED.md).
//
// The checks assert connect()'s observable effects, since registerCallback delegates to it.
#include "sead/delegate_event.hpp"

#include <cstdio>

namespace {

int g_failures = 0;
int g_checks = 0;
void Check(bool cond, const char *what) {
    ++g_checks;
    if (!cond) { ++g_failures; std::printf("  FAIL  %s\n", what); }
    else { std::printf("  ok    %s\n", what); }
}

void TestRegister() {
    std::printf("sead::AssertConfig::registerCallback (0x7101397fac)\n");

    sead::DelegateEvent &ev = sead::AssertConfig::assertEvent();
    const int before = ev.getNumSlots();

    sead::DelegateEventSlot slot;
    Check(!slot.isConnected(), "a fresh slot is not connected");

    sead::AssertConfig::registerCallback(slot);
    Check(slot.isConnected(), "after registration the slot is marked connected");
    Check(ev.getNumSlots() == before + 1, "the event's slot count increased by one");

    // Re-registering must not double-link: connect() calls release() first, which unlinks.
    sead::AssertConfig::registerCallback(slot);
    Check(ev.getNumSlots() == before + 1,
          "re-registering the same slot does NOT inflate the count (release() unlinks first)");
    Check(slot.isConnected(), "and it stays connected");

    // Release must be idempotent and clear the flag.
    slot.release();
    Check(!slot.isConnected(), "release() clears the connected flag");
    Check(ev.getNumSlots() == before, "and removes the slot from the event");
    slot.release();
    Check(true, "release() twice is safe (guarded by the connected flag)");
}

void TestTwoSlots() {
    std::printf("two independent slots\n");

    sead::DelegateEvent &ev = sead::AssertConfig::assertEvent();
    const int before = ev.getNumSlots();

    sead::DelegateEventSlot a, b;
    sead::AssertConfig::registerCallback(a);
    sead::AssertConfig::registerCallback(b);
    Check(ev.getNumSlots() == before + 2, "two distinct slots both register");

    // The sentinel list must walk without cycling: this is where a wrong node layout
    // would show up as a hang or an over-count.
    Check(ev.getNumSlots() <= before + 2, "the list does not over-count (no cycle)");

    a.release();
    Check(ev.getNumSlots() == before + 1, "releasing one leaves the other");
    b.release();
    Check(ev.getNumSlots() == before, "releasing both empties the event again");
}

} // namespace

int main() {
    std::printf("sead::AssertConfig::registerCallback contract tests\n");
    std::printf("(port of 0x7101397fac, against sead's real DelegateEvent::connect)\n\n");
    TestRegister();
    std::printf("\n");
    TestTwoSlots();
    std::printf("\n----------------------------------------\n");
    std::printf("%d checks, %d failures\n", g_checks, g_failures);
    return g_failures == 0 ? 0 : 1;
}
