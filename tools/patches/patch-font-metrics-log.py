#!/usr/bin/env python3
"""Diagnostic: log the metrics TextureCache computes for text.

The eui banner text (intro splash, controller screen) is drawn at font size 100 and comes out
horizontally squeezed with scrambled glyphs, although the same pipeline renders size ~40 text
perfectly. These logs print, for the first 80 calls, the size, character, face index, slot and the
value the cache returns (advance for CalculateCharWidth, kerning for CalculateKerning), so the
compression can be attributed to either the advance or the kerning, and the size-40 and size-100
paths can be compared.

Temporary diagnostic: restore before a production run.

gen/main/code_417.cpp; idempotent (--restore).

Usage: python3 tools/patches/patch-font-metrics-log.py [--restore]   (SP2PORT override)
"""
import os
import sys

ROOT = os.environ.get("SP2PORT", "/home/hexa/sp2port")
F = os.path.join(ROOT, "gen/main/code_417.cpp")

OLD0 = '#include "funcs.h"\n'
NEW0 = '#include "funcs.h"\n#include <nx/runtime.h>  // PATCH-FONTLOG (nx::log)\n'

OLD1 = """void main_013654B8(nx::CPU& NX_RESTRICT c) {
"""
NEW1 = """void main_013654B8(nx::CPU& NX_RESTRICT c) {
    static int fontlog_cw = 0;  // PATCH-FONTLOG
"""

OLD2 = """L_1365598:;
"""
NEW2 = """L_1365598:;
    if (fontlog_cw < 80 && (c.x[21] >= 90 || fontlog_cw < 16)) {  // PATCH-FONTLOG
        fontlog_cw++;
        nx::log("FONTLOG cw size=%u chr=%u face=%u slot=%u ret=%d", uint32_t(c.x[21]), uint32_t(c.x[20]),
                uint32_t(nx::ld<uint32_t>(c.x[31] + 0x1c)), uint32_t(c.x[22]), int32_t(c.x[0]));
    }
"""

OLD3 = """void main_01365680(nx::CPU& NX_RESTRICT c) {
"""
NEW3 = """void main_01365680(nx::CPU& NX_RESTRICT c) {
    static int fontlog_kern = 0;  // PATCH-FONTLOG
"""

OLD4 = """L_1365900:;
"""
NEW4 = """L_1365900:;
    if (fontlog_kern < 80 && (c.x[19] >= 90 || fontlog_kern < 16)) {  // PATCH-FONTLOG
        fontlog_kern++;
        nx::log("FONTLOG kern size=%u left=%u right=%u ret=%d", uint32_t(c.x[19]), uint32_t(c.x[22]),
                uint32_t(c.x[21]), int32_t(c.x[0]));
    }
"""


def main():
    t = open(F, encoding="utf-8", errors="replace", newline="").read()
    if "--restore" in sys.argv:
        if "PATCH-FONTLOG" not in t:
            print("nothing to restore")
            return
        # Tolerant removal: the gate line changed between revisions, so match the block, not the exact text.
        import re
        t = re.sub(r"    if \(fontlog_(?:cw|kern) < [^\n]*\n(?:.*?\n)*?    \}\n", "", t)
        t = re.sub(r"    static int fontlog_(?:cw|kern) = 0;  // PATCH-FONTLOG\n", "", t)
        t = t.replace('#include <nx/runtime.h>  // PATCH-FONTLOG (nx::log)\n', "")
        open(F, "w", encoding="utf-8", newline="").write(t)
        print("restored")
        return
    if "PATCH-FONTLOG" in t:
        print("already applied")
        return
    for need, name in ((OLD0, "OLD0"), (OLD1, "OLD1"), (OLD2, "OLD2"), (OLD3, "OLD3"), (OLD4, "OLD4")):
        if need not in t:
            raise SystemExit("pattern not found (%s): %s" % (name, F))
    t = t.replace(OLD0, NEW0, 1).replace(OLD1, NEW1, 1).replace(OLD2, NEW2, 1)
    t = t.replace(OLD3, NEW3, 1).replace(OLD4, NEW4, 1)
    open(F, "w", encoding="utf-8", newline="").write(t)
    print("patched", F)


if __name__ == "__main__":
    main()
