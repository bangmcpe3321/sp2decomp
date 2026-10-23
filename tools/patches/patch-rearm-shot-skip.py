#!/usr/bin/env python3
"""Re-arm the temporary tutorial shot auto-hit for each shot-page entry.

`gen/main/code_215.cpp` carries a temporary PATCH-TUTORIAL-SKIP-SHOT block.  Its
`shot_n` counter is process-global and the trigger was `shot_n == 240`, so only
the first tutorial cycle could ever auto-hit the balloon.  When the plaza flow
re-enters the shot page the counter is already past 240, the balloon flag stays
clear, and the state machine never advances to the Move/warp pages.

Replacing the equality check with `>= 240` keeps the existing per-entry flag
guard (`obj+0x651 == 0`), so a new shot-page entry with a fresh balloon still
gets the auto-hit after 240 frames, while an already-hit balloon is left alone.
This is a diagnostic skip, not production behavior.

Idempotent; use --restore to return the equality check.

Usage: python3 tools/patches/patch-rearm-shot-skip.py [--restore]   (SP2PORT override)
"""
import os
import sys

ROOT = os.environ.get("SP2PORT", "/home/hexa/sp2port")
F = os.path.join(ROOT, "gen/main/code_215.cpp")
MARK = "PATCH-REARM-SHOT-SKIP"

OLD = """        static int shot_n = 0;
        shot_n++;
        if (shot_n == 240) {
"""

NEW = """        // PATCH-REARM-SHOT-SKIP: shot_n is process-global, so a one-shot
        // equality check is consumed by the first tutorial cycle.  Re-check
        // the per-entry balloon flag after 240 frames to permit later cycles.
        static int shot_n = 0;
        shot_n++;
        if (shot_n >= 240) {
"""


def main():
    t = open(F, encoding="utf-8", errors="replace", newline="").read()
    if "--restore" in sys.argv:
        if MARK not in t:
            print("nothing to restore")
            return 0
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
