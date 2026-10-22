#!/usr/bin/env python3
"""Move-page tutorial skip: delay the forced success path.

The Move state is forced to its success path after a number of state calls.  An early
transition (300 calls, ~5 s) can enter the next UI page while the Move intro and font
cache are still being built; the camera page then spends minutes in font layout.  Waiting
1200 calls (~20 s) lets the page and its fonts settle before the transition.

This patches the WSL-only PATCH-TUTORIAL-SKIP-MOVE block in gen/main/code_215.cpp.
Idempotent; --restore puts the original 300-call threshold back.

Usage: python3 tools/patches/patch-move-skip-delay.py [--restore]   (SP2PORT override)
"""
import os
import sys

ROOT = os.environ.get("SP2PORT", "/home/hexa/sp2port")
F = os.path.join(ROOT, "gen/main/code_215.cpp")

OLD = """      // path only calls main_00E8499C and main_00620ED0(this, 7), so take it after 300 state calls.
        static int n = 0;
        if (++n >= 300) {
            n = 0;
            nx::log("TUTSKIP move auto-advance after 300 frames");"""

NEW = """      // path only calls main_00E8499C and main_00620ED0(this, 7), so take it after 1200 state calls.
        static int n = 0;
        if (++n >= 1200) {
            n = 0;
            nx::log("TUTSKIP move auto-advance after 1200 frames");"""


def main():
    restore = "--restore" in sys.argv
    text = open(F, encoding="utf-8").read()
    if restore:
        if NEW in text:
            open(F, "w", encoding="utf-8").write(text.replace(NEW, OLD, 1))
            print("restored", F)
        else:
            print("not patched:", F)
        return
    if NEW in text:
        print("already patched:", F)
        return
    if OLD not in text:
        print("anchor not found in", F)
        sys.exit(1)
    open(F, "w", encoding="utf-8").write(text.replace(OLD, NEW, 1))
    print("patched", F)


if __name__ == "__main__":
    main()
