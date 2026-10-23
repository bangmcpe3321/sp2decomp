#!/usr/bin/env python3
"""Force the tutorial manager's unreachable 5 -> 6 request to warp state 7.

The 9-state tutorial manager requests `old=5 -> new=6` after the first warp,
but its shot-page update is no longer called.  Redirect that one request to
`stateWarpToPlaza` state 7; state 7's own timeline (camera at 60 frames, plaza
request at 180) is already verified.

The 21-state UI/page manager is deliberately not touched.  Its `4 -> 5`
request is the real title -> Off the Hook news handoff: the old table's state-5
entry is null, but the page's scene-change handler creates a new page manager
and loads the news scene.  Redirecting it to 7 skips the news and lands on the
PlayerMake gear-selection screen (state 9), which stalls.

This is a narrow diagnostic for the tutorial only and does not touch the other
states or the state 8 restart path.

Idempotent; use --restore.

Usage: python3 tools/patches/patch-force-plaza-on-shot-exit.py [--restore]   (SP2PORT override)
"""
import os
import sys

ROOT = os.environ.get("SP2PORT", "/home/hexa/sp2port")
F = os.path.join(ROOT, "gen/main/code_132.cpp")
MARK = "PATCH-FORCE-PLAZA"

OLD = "void main_00620ED0(nx::CPU& NX_RESTRICT c) {\n"

NEW = """void main_00620ED0(nx::CPU& NX_RESTRICT c) {
    // PATCH-FORCE-PLAZA: after the first warp the shot state (5) can be
    // active without its page update being called, so the normal 5 -> 6
    // transition is unreachable.  Redirect that one request to state 7
    // (warp-to-plaza); main_00620ED0 resets the state timer to 0.
    {
        uint64_t sm = c.x[0] ? nx::ld<uint64_t>(c.x[0] + 0x340) : 0;
        uint32_t old = sm ? nx::ld<uint32_t>(sm + 0x10) : 0xffffffffu;
        if (old == 5 && uint32_t(c.x[1]) == 6) {
            static int force_plaza_logs = 0;
            if (force_plaza_logs < 8) {
                force_plaza_logs++;
                nx::log("PATCH-FORCE-PLAZA shot->warp old=%u new=%u this=%llx",
                        old, uint32_t(c.x[1]), (unsigned long long)c.x[0]);
            }
            c.x[1] = 7;
        }
    }
"""


def main():
    t = open(F, encoding="utf-8", errors="replace", newline="").read()
    if "--restore" in sys.argv:
        if MARK not in t:
            print("nothing to restore")
            return 0
        if NEW not in t:
            raise SystemExit("current patched block does not match NEW; refusing to restore")
        t = t.replace(NEW, OLD, 1)
        open(F, "w", encoding="utf-8", newline="").write(t)
        print("restored")
        return 0
    if MARK in t:
        print("already applied")
        return 0
    if OLD not in t:
        raise SystemExit("anchor not found in " + F)
    t = t.replace(OLD, NEW, 1)
    open(F, "w", encoding="utf-8", newline="").write(t)
    print("patched")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
