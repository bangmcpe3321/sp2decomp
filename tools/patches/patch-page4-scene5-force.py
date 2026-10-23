#!/usr/bin/env python3
"""Diagnostic: force page 4's real 4 -> 5 UI/page transition into the news scene.

The title page's state 4 (`Lp::UI::PageStart`) is reached live, and its
per-frame update `main_00979BC8` runs every frame, but the normal
network/start path that would call `main_00620ED0(page, 5)` never completes in
the port.  After 120 page-4 update calls, call the same transition directly.
This is not a redirect: state 5 is the real handoff into the title's Off the
Hook news scene.  The old 21-state table's state-5 entry remains null because
the page's virtual scene-change handler creates a new page manager; that is
expected.

The block is deliberately temporary.  It is a diagnostic to get past the
page-4 wait so the news scene and the subsequent plaza can be exercised; the
production path should fix the page-4 job/network wait instead.

Idempotent; use --restore.

Usage: python3 tools/patches/patch-page4-scene5-force.py [--restore]   (SP2PORT override)
"""
import os
import sys

ROOT = os.environ.get("SP2PORT", "/home/hexa/sp2port")
F = os.path.join(ROOT, "gen/main/code_204.cpp")
MARK = "PATCH-SCENE4->5-F20"

OLD = "void main_00979BC8(nx::CPU& NX_RESTRICT c) {\n"

BLOCK = """    { // PATCH-SCENE4->5-F20 (temporary): page 4's update is definitely being
      // called every frame.  Force the scene transition that its network/start
      // path would select after the title layout has had time to settle.
        static int s_force = 0;
        uint64_t p = c.x[0];
        if (p) {
            if (s_force < 120) {
                s_force++;
            } else if (s_force == 120) {
                s_force = 1000;
                nx::log("PATCH-SCENE4->5-F20 force page=%llx", (unsigned long long)p);
                c.x[0] = p;
                c.x[1] = 5;
                main_00620ED0(c);
                {
                    uint64_t scene = nx::ld<uint64_t>(p + 0x340);
                    uint64_t base = scene ? nx::ld<uint64_t>(scene + 0x38) : 0;
                    uint64_t e5 = base ? base + 5ull * 0x40ull : 0;
                    nx::log("PATCH-SCENE4->5-F20 after scene=%llx cur=%x base=%llx e5vt=%llx e5f10=%llx e5f20=%llx",
                            (unsigned long long)scene,
                            scene ? nx::ld<uint32_t>(scene + 0x10) : 0,
                            (unsigned long long)base,
                            (unsigned long long)(e5 ? nx::ld<uint64_t>(e5) : 0),
                            (unsigned long long)(e5 ? nx::ld<uint64_t>(e5 + 0x10) : 0),
                            (unsigned long long)(e5 ? nx::ld<uint64_t>(e5 + 0x20) : 0));
                }
                return;
            }
        }
    } // PATCH-SCENE4->5-F20 (temporary)
"""

NEW = OLD + BLOCK


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
