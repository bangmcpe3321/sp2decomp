#!/usr/bin/env python3
"""Move-page tutorial skip: disable the forced quit path.

The Move page runs under manager state 6.  Its own timeline (`main_00A00BDC`) advances
to state 8 when the global counter `[+0x44c]` reaches 0x12c0, roughly 3,100 frames after
the page starts.  The earlier forced skip ran after 1,200 `main_00A00300` calls and took
`L_A00350`, which calls `main_00620ED0(this, 7)` -- the quit-to-title path, not the next
page.  The state log showed `SCENECHG 6 -> 7` at that point.

This raises the skip threshold out of reach so the game's own timeline transition runs.
`--restore` returns to the 1,200-call diagnostic.  The whole block is temporary and is
removed for production.

gen/main/code_215.cpp; idempotent (--restore).

Usage: python3 tools/patches/patch-move-skip-disable.py [--restore]   (SP2PORT override)
"""
import os
import sys

ROOT = os.environ.get("SP2PORT", "/home/hexa/sp2port")
F = os.path.join(ROOT, "gen/main/code_215.cpp")

OLD = """      // path only calls main_00E8499C and main_00620ED0(this, 7), so take it after 1200 state calls.
        static int n = 0;
        if (++n >= 1200) {
            n = 0;
            nx::log("TUTSKIP move auto-advance after 1200 frames");"""

NEW = """      // path only calls main_00E8499C and main_00620ED0(this, 7), so take it after 1000000 state calls.
        static int n = 0;
        if (++n >= 1000000) {
            n = 0;
            nx::log("TUTSKIP move auto-advance after 1000000 frames");"""


def main():
    restore = "--restore" in sys.argv
    text = open(F, encoding="utf-8").read()
    if restore:
        if NEW in text:
            open(F, "w", encoding="utf-8").write(text.replace(NEW, OLD, 1))
            print("restored", F)
        else:
            print("not disabled:", F)
        return
    if NEW in text:
        print("already disabled:", F)
        return
    if OLD not in text:
        print("anchor not found in", F)
        sys.exit(1)
    open(F, "w", encoding="utf-8").write(text.replace(OLD, NEW, 1))
    print("disabled", F)


if __name__ == "__main__":
    main()
