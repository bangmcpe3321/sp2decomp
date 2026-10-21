#!/usr/bin/env python3
"""Skip whole-target deferred clears: NX_SKIP_DEFERRED_CLEARS=1.

The tutorial frame renders the 3D scene into its 1920x1080 colour image, then a full-target clear
of that same image (queued as a deferred clear) runs before the UI draws, so only the UI reaches the
screen.  This bisect switch drops those clears so the frame keeps the scene; if the scene then shows
through, the clear (or the target it names) is the cause.

runtime/src/nvn/nvn_clears.cpp; idempotent (--restore).

Usage: python3 tools/patches/patch-skip-deferred-clears.py [--restore]   (SP2PORT override)
"""
import os
import sys

ROOT = os.environ.get("SP2PORT", "/home/hexa/sp2port")
F = os.path.join(ROOT, "runtime/src/nvn/nvn_clears.cpp")

MARK = "PATCH-SKIP-DEFERRED-CLEARS"

OLD_DECL = "uint64_t g_deferred = 0, g_as_load = 0, g_alone = 0, g_transfer = 0;"
NEW_DECL = OLD_DECL + "\n// PATCH-SKIP-DEFERRED-CLEARS\nuint64_t g_skipped = 0;"

OLD = """            g_deferred++;
            replay::trace_pass("clear deferred: slot, mask", t, color ? c.n : 8, c.mask);
            return;
"""

NEW = """            g_deferred++;
            // PATCH-SKIP-DEFERRED-CLEARS: bisect switch, drops the clear instead of making it a loadOp.
            static const bool skip_deferred = std::getenv("NX_SKIP_DEFERRED_CLEARS") != nullptr;
            if (skip_deferred)
                g_skipped++;
            else
                replay::trace_pass("clear deferred: slot, mask", t, color ? c.n : 8, c.mask);
            return;
"""


def main():
    t = open(F, encoding="utf-8", errors="replace", newline="").read()
    if "--restore" in sys.argv:
        if MARK not in t:
            print("nothing to restore")
            return
        t = t.replace(NEW, OLD, 1).replace(NEW_DECL, OLD_DECL, 1)
        open(F, "w", encoding="utf-8", newline="").write(t)
        print("restored")
        return
    if MARK in t:
        print("already applied")
        return
    if OLD not in t or OLD_DECL not in t:
        raise SystemExit("pattern not found: " + F)
    t = t.replace(OLD_DECL, NEW_DECL, 1).replace(OLD, NEW, 1)
    open(F, "w", encoding="utf-8", newline="").write(t)
    print("patched", F)


if __name__ == "__main__":
    main()
