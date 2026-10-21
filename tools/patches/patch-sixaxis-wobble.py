#!/usr/bin/env python3
"""hid: optional synthetic tilt sweep for the six-axis state (NX_SIXAXIS_WOBBLE=1).

The first-launch controller tutorial shows arrows and "Tilt the controller to aim!"; a level,
never-moving sensor cannot pass that step.  With NX_SIXAXIS_WOBBLE=1 the reported state sweeps
pitch (4 s) and yaw (6 s) across about +-31 degrees, with matching gyro, angle and direction
matrix, so the game sees a controller being tilted through every direction.  Default off: a level
sensor for gameplay (XInput has no gyro).

runtime/src/hle_hid.cpp; idempotent (--restore).

Usage: python3 tools/patches/patch-sixaxis-wobble.py [--restore]   (SP2PORT override)
"""
import os
import sys

ROOT = os.environ.get("SP2PORT", "/home/hexa/sp2port")
F = os.path.join(ROOT, "runtime/src/hle_hid.cpp")

MARK = "PATCH-SIXAXIS-WOBBLE"

OLD_INC = "#include <array>\n"
NEW_INC = "#include <array>\n#include <cmath>  // PATCH-SIXAXIS-WOBBLE\n"

OLD = """void fill_sixaxis_state(uint64_t addr) {
    std::memset(reinterpret_cast<void*>(addr), 0, 0x60);
    st<uint64_t>(addr + 0x00, ++g_sixaxis_sampling);
    st<uint64_t>(addr + 0x08, 16666667ull);  // one frame at 60 Hz, in ns
    st<float>(addr + 0x10, 0.0f);
    st<float>(addr + 0x14, 0.0f);
    st<float>(addr + 0x18, -1.0f);  // gravity: controller face up, level
    const float dir[9] = {1.0f, 0.0f, 0.0f, 0.0f, 1.0f, 0.0f, 0.0f, 0.0f, 1.0f};
    for (int i = 0; i < 9; i++) st<float>(addr + 0x34 + 4 * i, dir[i]);
}
"""

NEW = """bool sixaxis_wobble() {
    static const bool on = std::getenv("NX_SIXAXIS_WOBBLE") != nullptr;
    return on;
}

void fill_sixaxis_state(uint64_t addr) {
    std::memset(reinterpret_cast<void*>(addr), 0, 0x60);
    st<uint64_t>(addr + 0x00, ++g_sixaxis_sampling);
    st<uint64_t>(addr + 0x08, 16666667ull);  // one frame at 60 Hz, in ns
    float ax = 0.0f, ay = 0.0f, az = -1.0f, gx = 0.0f, gy = 0.0f, gz = 0.0f;
    float angx = 0.0f, angy = 0.0f, angz = 0.0f;
    float m[9] = {1.0f, 0.0f, 0.0f, 0.0f, 1.0f, 0.0f, 0.0f, 0.0f, 1.0f};
    if (sixaxis_wobble()) {  // PATCH-SIXAXIS-WOBBLE: a controller being tilted through every direction
        const double t = double(g_frame.load()) / 60.0;
        const double pitch = 0.55 * std::sin(2.0 * 3.14159265358979 * t / 4.0);
        const double yaw = 0.55 * std::sin(2.0 * 3.14159265358979 * t / 6.0);
        gx = float(0.55 * (2.0 * 3.14159265358979 / 4.0) * std::cos(2.0 * 3.14159265358979 * t / 4.0));
        gy = float(0.55 * (2.0 * 3.14159265358979 / 6.0) * std::cos(2.0 * 3.14159265358979 * t / 6.0));
        angx = float(pitch), angy = float(yaw);
        const double cp = std::cos(pitch), sp = std::sin(pitch), cy = std::cos(yaw), sy = std::sin(yaw);
        m[0] = float(cy), m[1] = float(sy * sp), m[2] = float(sy * cp);
        m[3] = 0.0f, m[4] = float(cp), m[5] = float(-sp);
        m[6] = float(-sy), m[7] = float(cy * sp), m[8] = float(cy * cp);
        ax = -m[2], ay = -m[5], az = -m[8];  // gravity in the sensor frame
    }
    st<float>(addr + 0x10, ax);
    st<float>(addr + 0x14, ay);
    st<float>(addr + 0x18, az);
    st<float>(addr + 0x1c, gx);
    st<float>(addr + 0x20, gy);
    st<float>(addr + 0x24, gz);
    st<float>(addr + 0x28, angx);
    st<float>(addr + 0x2c, angy);
    st<float>(addr + 0x30, angz);
    for (int i = 0; i < 9; i++) st<float>(addr + 0x34 + 4 * i, m[i]);
}
"""


def main():
    t = open(F, encoding="utf-8", errors="replace", newline="").read()
    if "--restore" in sys.argv:
        if MARK not in t:
            print("nothing to restore")
            return
        t = t.replace(NEW, OLD, 1).replace(NEW_INC, OLD_INC, 1)
        open(F, "w", encoding="utf-8", newline="").write(t)
        print("restored")
        return
    if MARK in t:
        print("already applied")
        return
    if OLD_INC not in t or OLD not in t:
        raise SystemExit("pattern not found: " + F)
    t = t.replace(OLD_INC, NEW_INC, 1).replace(OLD, NEW, 1)
    open(F, "w", encoding="utf-8", newline="").write(t)
    print("patched", F)


if __name__ == "__main__":
    main()
