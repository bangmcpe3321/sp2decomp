#!/usr/bin/env python3
"""Scissored clears by default (NX_CLEARS_SCISSOR=0 opts out).

NVN clears are clipped to the bound scissor.  The port ignored the scissor ("off unless
NX_CLEARS_SCISSOR=1") and cleared the whole target instead; on the tutorial pages a clear meant for
one panel erased the rest of the UI image, which is why the controller diagram and other elements
were missing.  With the scissor honoured, the tutorial controller page, the character-creation page
and its text all render whole.

The opt-out keeps the old whole-target behaviour for bisecting (the port once saw a course break
with scissored clears: docs/nvn/DEBUG.md #52).

runtime/src/nvn/nvn_clears.cpp; idempotent (--restore).

Usage: python3 tools/patches/patch-clears-scissor-default.py [--restore]   (SP2PORT override)
"""
import os
import sys

ROOT = os.environ.get("SP2PORT", "/home/hexa/sp2port")
F = os.path.join(ROOT, "runtime/src/nvn/nvn_clears.cpp")

MARK = "PATCH-CLEARS-SCISSOR-DEFAULT"

OLD = """    // Off unless NX_CLEARS_SCISSOR=1: clipping clears to the bound scissor broke the course (whole regions left
    // uncleared: huge black/white shapes, DEBUG.md #52), so NVN's clears are not scissored the way this reads it.
    static const bool no_scissor = std::getenv("NX_CLEARS_SCISSOR") == nullptr;
"""

NEW = """    // PATCH-CLEARS-SCISSOR-DEFAULT: honour the scissor by default.  It used to be off because the course once
    // broke with it (DEBUG.md #52); without it a UI panel's clear erases the whole UI image (tutorial controller
    // page).  NX_CLEARS_SCISSOR=0 restores the whole-target behaviour for bisecting.
    static const char* scissor_env = std::getenv("NX_CLEARS_SCISSOR");
    static const bool no_scissor = scissor_env && std::strcmp(scissor_env, "0") == 0;
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
