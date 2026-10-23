#!/usr/bin/env python3
"""Make `nn::font::TextureCache::CalculateKerning` a no-op during the plaza/news load.

The scene transition releases the layout font while the UI job is still laying out the
news page.  `CalculateCharWidth` is already guarded, but `CalculateKerning` enters
`FSS_set_scale`, whose glyph-table scan for the released face can take minutes; the main
thread waits forever in `Lp::UI::UIMgr::calc -> JobMgr::endRun`.

Kerning only adjusts inter-character spacing.  Returning 0 from `CalculateKerning` keeps
the text layout moving (widths still come from `CalculateCharWidth`) and lets the scene
load complete.  This is a diagnostic workaround until the font lifetime race is fixed.

gen/main/code_417.cpp; idempotent (--restore).

Usage: python3 tools/patches/patch-disable-kerning.py [--restore]   (SP2PORT override)
"""
import os
import sys

ROOT = os.environ.get("SP2PORT", "/home/hexa/sp2port")
F = os.path.join(ROOT, "gen/main/code_417.cpp")
MARK = "PATCH-NO-KERNING"

OLD = "void main_01365680(nx::CPU& NX_RESTRICT c) {\n"
NEW = """void main_01365680(nx::CPU& NX_RESTRICT c) {
    // PATCH-NO-KERNING: the plaza/news layout can outlive its font; do not scan a released
    // face in FSS_set_scale.  Zero kerning keeps the layout finite.
    static int no_kerning_logs = 0;
    if (no_kerning_logs < 8) {
        no_kerning_logs++;
        nx::log(\"NOKERNING skip t=%llx a=%llx b=%llx\", (unsigned long long)c.x[0],
                (unsigned long long)c.x[1], (unsigned long long)c.x[2]);
    }
    c.x[0] = 0;
    return;
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
