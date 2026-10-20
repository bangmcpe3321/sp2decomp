#!/usr/bin/env python3
"""hid: fill six-axis sensor handles and states instead of leaving them untouched.

`GetSixAxisSensorHandles` was a no-op and `GetSixAxisSensorStates` returned 0 without writing the
output buffer, so sead's NinSixAxisSensorAddon saw no usable orientation.  The first-launch
controller tutorial (`Tut_ExpController`, "Tilt the controller to aim!") waits on motion input.

This reports a controller held level (identity direction, gravity on -Z) and starts/stops sensors.
The values can be overridden later for motion-gated steps; keeps NX_SIXAXIS=0 to disable.

runtime/src/hle_hid.cpp; idempotent (--restore).

Usage: python3 tools/patches/patch-sixaxis.py [--restore]   (SP2PORT override)
"""
import os
import sys

ROOT = os.environ.get("SP2PORT", "/home/hexa/sp2port")
F = os.path.join(ROOT, "runtime/src/hle_hid.cpp")

MARK = "PATCH-SIXAXIS"

OLD = """NX_HLE("_ZN2nn3hid23GetSixAxisSensorHandlesEPNS0_19SixAxisSensorHandleEiRKjNS_4util10BitFlagSetILi32ENS0_12NpadStyleTagEEE", noop);
NX_HLE("_ZN2nn3hid18StartSixAxisSensorERKNS0_19SixAxisSensorHandleE", noop);
NX_HLE("_ZN2nn3hid22GetSixAxisSensorStatesEPNS0_18SixAxisSensorStateEiRKNS0_19SixAxisSensorHandleE", zero);
"""

NEW = """// PATCH-SIXAXIS: hand the game a live motion sensor.  A SixAxisSensorHandle is {u32 npad_id,
// u32 sensor_index}; a SixAxisSensorState is 0x60 bytes: u64 sampling, u64 delta ns, accel xyz, gyro
// xyz, angle xyz, a 3x3 direction matrix, u32 attributes, u32 reserved.  Held level: identity
// direction, gravity along -Z, no rotation.  NX_SIXAXIS=0 keeps the old empty behaviour.
namespace {

bool sixaxis_on() {
    static const bool on = std::getenv("NX_SIXAXIS") == nullptr || std::atoi(std::getenv("NX_SIXAXIS")) != 0;
    return on;
}

uint64_t g_sixaxis_sampling = 0;

void fill_sixaxis_state(uint64_t addr) {
    std::memset(reinterpret_cast<void*>(addr), 0, 0x60);
    st<uint64_t>(addr + 0x00, ++g_sixaxis_sampling);
    st<uint64_t>(addr + 0x08, 16666667ull);  // one frame at 60 Hz, in ns
    st<float>(addr + 0x10, 0.0f);
    st<float>(addr + 0x14, 0.0f);
    st<float>(addr + 0x18, -1.0f);  // gravity: controller face up, level
    const float dir[9] = {1.0f, 0.0f, 0.0f, 0.0f, 1.0f, 0.0f, 0.0f, 0.0f, 1.0f};
    for (int i = 0; i < 9; i++) st<float>(addr + 0x34 + 4 * i, dir[i]);
}

void GetSixAxisSensorHandles(CPU& c) {  // (SixAxisSensorHandle*, int, const u32& npad_id, style)
    const uint64_t out = c.x[0];
    const int count = int(uint32_t(c.x[1]));
    const uint32_t id = ld<uint32_t>(c.x[2]);
    const uint32_t style = uint32_t(c.x[3]);
    // The API returns the number of handles written, and sead stores that as its sensor count: returning
    // 0 (a Result) made the game think the controller had no sensor at all and never read a state.
    // JoyDual has two sensors (left/right); every other style has one.
    int n = 0;
    if (sixaxis_on()) {
        n = style ? ((style & 2u) ? 2 : 1) : 0;
        if (n > count) n = count;
        for (int i = 0; i < n; i++) {
            st<uint32_t>(out + 8 * i, id);
            st<uint32_t>(out + 8 * i + 4, uint32_t(i));
        }
    }
    static int logs = 0;
    if (logs++ < 4) log("hid: six-axis handles id %u style %#x count %d -> %d", id, style, count, n);
    c.x[0] = uint64_t(n);
}

void StartSixAxisSensor(CPU& c) {  // (const SixAxisSensorHandle&)
    static int logs = 0;
    if (sixaxis_on() && logs++ < 4) log("hid: six-axis start id %u sensor %u", ld<uint32_t>(c.x[0]), ld<uint32_t>(c.x[0] + 4));
    c.x[0] = 0;
}

void GetSixAxisSensorStates(CPU& c) {  // (SixAxisSensorState*, int, const SixAxisSensorHandle&)
    const uint64_t out = c.x[0];
    const int count = int(uint32_t(c.x[1]));
    static uint64_t reads = 0;
    reads++;
    if (sixaxis_on()) {
        if (reads <= 3 || reads % 600 == 0)
            log("hid: six-axis states read %llu id %u sensor %u count %d", (unsigned long long)reads, ld<uint32_t>(c.x[2]),
                ld<uint32_t>(c.x[2] + 4), count);
        for (int i = 0; i < count && i < 8; i++) fill_sixaxis_state(out + 0x60 * i);
    } else {
        std::memset(reinterpret_cast<void*>(out), 0, size_t(count < 8 ? count : 8) * 0x60);
    }
    c.x[0] = 0;
}

}  // namespace

NX_HLE("_ZN2nn3hid23GetSixAxisSensorHandlesEPNS0_19SixAxisSensorHandleEiRKjNS_4util10BitFlagSetILi32ENS0_12NpadStyleTagEEE", GetSixAxisSensorHandles);
NX_HLE("_ZN2nn3hid18StartSixAxisSensorERKNS0_19SixAxisSensorHandleE", StartSixAxisSensor);
NX_HLE("_ZN2nn3hid22GetSixAxisSensorStatesEPNS0_18SixAxisSensorStateEiRKNS0_19SixAxisSensorHandleE", GetSixAxisSensorStates);
"""


def main():
    t = open(F, encoding="utf-8", errors="replace", newline="").read()
    if "--restore" in sys.argv:
        if MARK not in t:
            print("nothing to restore")
            return
        t = t.replace(NEW, OLD, 1)
        open(F, "w", encoding="utf-8", newline="").write(t)
        print("restored")
        return
    if MARK in t:
        print("already applied")
        return
    if OLD not in t:
        raise SystemExit("pattern not found: " + F)
    t = t.replace(OLD, NEW, 1)
    open(F, "w", encoding="utf-8", newline="").write(t)
    print("patched", F)


if __name__ == "__main__":
    main()
