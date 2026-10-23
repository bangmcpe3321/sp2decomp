#!/usr/bin/env python3
"""Force the tutorial and UI/page state machines into the known-good warp/plaza flow.

Two separate null-state stalls were observed in `main_00620ED0`:

1. The tutorial manager (9 states) requests `old=5 -> new=6` after the first
   warp, but its shot-page update is no longer called.  Redirect that request
   to `stateWarpToPlaza` state 7; state 7's own timeline (camera at 60 frames,
   plaza request at 180) is already verified.

2. The 21-state UI/page manager requests `old=4 -> new=5`, but its state-5
   entry is null, so that state machine can never update.  Redirect that
   request to the valid page state 7.  State 7 then advances to state 8 (the
   A-confirmation/news page), and the normal A prompt leads to state 1.

Both redirects are narrow diagnostics: they only rewrite these exact
transitions and do not touch the other states or the state 8 restart path.

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
        // PATCH-FORCE-PLAZA-UI: the 21-state UI/page manager enters state 5
        // for the shot page, but its state-5 entry is null.  Redirect its
        // 4 -> 5 request to the valid page state 7.  The UI then advances to
        // state 8 (A-confirmation/news) and the normal A prompt leads to
        // state 1.
        if (sm && old == 4 && uint32_t(c.x[1]) == 5 &&
            nx::ld<uint32_t>(sm + 0x30) == 21) {
            static int force_plaza_ui_logs = 0;
            if (force_plaza_ui_logs < 8) {
                force_plaza_ui_logs++;
                nx::log("PATCH-FORCE-PLAZA-UI 4->7 this=%llx",
                        (unsigned long long)c.x[0]);
            }
            c.x[1] = 7;
        }
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
