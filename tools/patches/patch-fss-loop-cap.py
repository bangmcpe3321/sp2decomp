#!/usr/bin/env python3
"""FSS_set_scale: cap the linear glyph-list scan.

`FSS_set_scale` walks the face's glyph list to find a matching scale/glyph.  After a
scene change the face can be valid but its list very large (or the scale key never
matches), so one text layout walks tens of thousands of glyphs per character.  The UI
job then takes minutes on a single page and the hang watchdog kills the run.

This cap stops the scan after 512 glyphs and uses FSS's own null-glyph error (0x131),
which the engine already handles (the same path as the null-face guard).  Text keeps
laying out; only metrics of glyphs past the cap are affected.

gen/sdk/code_033.cpp; idempotent (--restore).

Usage: python3 tools/patches/patch-fss-loop-cap.py [--restore]   (SP2PORT override)
"""
import os
import sys

ROOT = os.environ.get("SP2PORT", "/home/hexa/sp2port")
F = os.path.join(ROOT, "gen/sdk/code_033.cpp")

MARK = "PATCH-FSS-LOOP-CAP"
OLD = "L_18655C:;\n"
NEW = """L_18655C:;
    // PATCH-FSS-LOOP-CAP (temporary): a valid face can still carry a huge glyph list
    // after a scene change; cap the linear scan so one page layout cannot stall for
    // minutes.  Jump to FSS's null-glyph error (0x131), which callers already handle.
    if (c.x[28] >= 512) {
        static int fss_cap_logs = 0;
        if (fss_cap_logs < 16) {
            fss_cap_logs++;
            nx::log("FSSCAP set_scale font=%llx face=%llx glyphs=%u scanned=%u",
                    (unsigned long long)c.x[19], (unsigned long long)c.x[1],
                    c.x[1] ? uint32_t(nx::ld<uint16_t>(c.x[1] + 0x20)) : 0u,
                    uint32_t(c.x[28]));
        }
        goto L_186520;
    }
"""


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
    if MARK in text:
        print("already patched:", F)
        return
    if OLD not in text:
        print("anchor not found in", F)
        sys.exit(1)
    open(F, "w", encoding="utf-8").write(text.replace(OLD, NEW, 1))
    print("patched", F)


if __name__ == "__main__":
    main()
