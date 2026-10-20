#!/usr/bin/env python3
"""Guard FSS map_font() against the null font face that crashes the eui font path.

Splatoon 2's eui scalable-font manager registers glyphs through nn::font::TextureCache ->
FSS_set_cmap -> map_font (sdk+0x191b84).  map_font caches the face table pointer in [font+0x10]
at entry and then re-reads it after calling the face loader; in the port the loaded face can be
cleared meanwhile (observed: data address 0x20 == [0 + 0x20], guest x9 == 0), so the next
`ldrh w9, [x9, #0x20]` faults.

This turns that fault into FSS's own null-face error (0x131), the same answer the function gives
when the face is already null at entry, and logs the first occurrences (FSSMAPFONT) with the
entry-time pointer so a run shows whether the face was cleared by the loader.

gen/sdk/code_033.cpp; idempotent (--restore).

Usage: python3 patch-fss-mapfont-null.py [--restore]   (SP2PORT override)
"""

import os
import sys

ROOT = os.environ.get("SP2PORT", "/home/hexa/sp2port")
F = os.path.join(ROOT, "gen/sdk/code_033.cpp")

FUNC = "void sdk_00191B84(nx::CPU& NX_RESTRICT c) {"
ANCHOR = "    c.x[19] = uint64_t(c.x[0]); // mov x19, x0\n"
LDR9 = ("    { uint64_t a = c.x[19] + 0x10ull; c.x[9] = uint64_t(nx::ld<uint64_t>(a)); } "
        "// ldr x9, [x19, #0x10]\n")

ENTRY_BEGIN = "    // PATCH-FSS-MAPFONT-BEGIN\n"
ENTRY_END = "    // PATCH-FSS-MAPFONT-END\n"
ENTRY = (
    "    const uint64_t fss_mapfont_face0 = c.x[19] ? nx::ld<uint64_t>(c.x[19] + 0x10ull) : 0ull;\n"
)

GUARD_BEGIN = "    // PATCH-FSS-MAPFONT-GUARD-BEGIN\n"
GUARD_END = "    // PATCH-FSS-MAPFONT-GUARD-END\n"
GUARD = (
    "    if (c.x[9] == 0) {\n"
    "        static int fss_mapfont_logs = 0;\n"
    "        if (fss_mapfont_logs < 16) {\n"
    "            fss_mapfont_logs++;\n"
    "            nx::log(\"FSSMAPFONT null face font=%llx entry=%llx keep=%llx faceid=%u cmap=%u err=%u\",\n"
    "                    (unsigned long long)c.x[19], (unsigned long long)c.x[23],\n"
    "                    (unsigned long long)fss_mapfont_face0, uint32_t(c.x[21]), uint32_t(c.x[20]),\n"
    "                    uint32_t(c.x[22]));\n"
    "        }\n"
    "        c.x[22] = uint32_t(0x131u);\n"
    "        nx::st<uint32_t>(c.x[19] + 0x48ull, uint32_t(0x131u));\n"
    "        goto L_191DC4;\n"
    "    }\n"
)


def strip_block(text, begin, end):
    out, i, removed = [], 0, 0
    lines = text.splitlines(keepends=True)
    while i < len(lines):
        if begin.strip() in lines[i]:
            j = i
            while j < len(lines) and end.strip() not in lines[j]:
                j += 1
            if j >= len(lines):
                raise SystemExit("unterminated block: " + begin.strip())
            removed += 1
            i = j + 1
            continue
        out.append(lines[i])
        i += 1
    return "".join(out), removed


def main():
    t = open(F, encoding="utf-8", errors="replace", newline="").read()
    if "--restore" in sys.argv:
        if "PATCH-FSS-MAPFONT" not in t:
            print("nothing to restore")
            return
        t, a = strip_block(t, GUARD_BEGIN, GUARD_END)
        t, b = strip_block(t, ENTRY_BEGIN, ENTRY_END)
        open(F, "w", encoding="utf-8", newline="").write(t)
        print("restored, blocks removed:", a, b)
        return
    if "PATCH-FSS-MAPFONT" in t:
        print("already applied")
        return
    start = t.find(FUNC)
    if start < 0:
        raise SystemExit("function not found")
    end = t.find("\n}\n", start)
    if end < 0:
        raise SystemExit("function end not found")
    end += 1
    body = t[start:end]
    if body.count(ANCHOR) != 1:
        raise SystemExit("anchor count %d (want 1)" % body.count(ANCHOR))
    n = body.count(LDR9)
    if n == 0:
        raise SystemExit("no ldr x9 sites found")
    body = body.replace(ANCHOR, ANCHOR + ENTRY_BEGIN + ENTRY + ENTRY_END, 1)
    body = body.replace(LDR9, LDR9 + GUARD_BEGIN + GUARD + GUARD_END)
    t = t[:start] + body + t[end:]
    open(F, "w", encoding="utf-8", newline="").write(t)
    print("patched %s: %d null-face guards" % (F, n))


if __name__ == "__main__":
    main()
