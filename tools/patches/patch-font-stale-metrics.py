#!/usr/bin/env python3
"""Skip font metrics for a font slot freed by a scene transition.

The plaza/news layout keeps a `nn::font::TextureCache` whose font slot was released while
the UI job was still laying out text.  `FSS_set_scale` (reached through the
`ScalableFontEngine::SetScale` GOT thunk) then walks the freed font's glyph tables; the
glyph lookup can spend minutes on the stale face and the main thread waits forever in
`Lp::UI::UIMgr::calc -> JobMgr::endRun`.

The same stale slot has a null engine (`[font+0x30]`), which is what made
`FSS_get_advance` die at data address 0x24.  Guard the two entry points:

  * `main_01414EE8` (the engine `SetScale` thunk) returns 0x131 when the slot's engine is
    already gone, instead of entering the glyph scan.
  * `sdk_00186848` (the glyph-table helper called from `FSS_set_scale`) re-checks the face
    and engine on entry, covering a font freed between the caller's check and the scan.

Zero metrics make the affected glyphs have no advance, but the page layout completes and
the scene transition can continue.

gen/main/code_432.cpp and gen/sdk/code_033.cpp; idempotent (--restore).

Usage: python3 tools/patches/patch-font-stale-metrics.py [--restore]   (SP2PORT override)
"""
import os
import sys

ROOT = os.environ.get("SP2PORT", "/home/hexa/sp2port")
MAIN = os.path.join(ROOT, "gen/main/code_432.cpp")
SDK = os.path.join(ROOT, "gen/sdk/code_033.cpp")
MARK = "PATCH-FSS-STALE-METRICS"

THUNK_OLD = """void main_01414EE8(nx::CPU& NX_RESTRICT c) {
    c.x[16] = uint64_t(NXB + 0x2f9b000ull); // adrp x16, #0x2f9b000
"""
THUNK_NEW = """void main_01414EE8(nx::CPU& NX_RESTRICT c) {
    // PATCH-FSS-STALE-METRICS: the UI layout can outlive the font slot's engine after a
    // scene transition.  Do not enter the glyph scan with a released slot.
    if (c.x[0] == 0 || nx::ld<uint64_t>(c.x[0] + 0x30) == 0) {
        static int fss_stale_scale_logs = 0;
        if (fss_stale_scale_logs < 8) {
            fss_stale_scale_logs++;
            nx::log("FSSNULL stale_scale font=%llx face=%llx engine=%llx",
                    (unsigned long long)c.x[0],
                    c.x[0] ? (unsigned long long)nx::ld<uint64_t>(c.x[0] + 0x10) : 0ull,
                    c.x[0] ? (unsigned long long)nx::ld<uint64_t>(c.x[0] + 0x30) : 0ull);
        }
        if (c.x[0] != 0) {
            { uint64_t a = c.x[0] + 0x48ull; nx::st<uint32_t>(a, uint32_t(0x131u)); }
        }
        c.x[0] = uint32_t(0x131ull);
        return;
    }
    c.x[16] = uint64_t(NXB + 0x2f9b000ull); // adrp x16, #0x2f9b000
"""

GLYPH_OLD = """    c.x[21] = uint32_t(uint32_t(c.x[3])); // mov w21, w3
    c.x[19] = uint64_t(c.x[0]); // mov x19, x0
    if (uint32_t(c.x[8]) == 0) goto L_1869DC; // cbz w8, #0x1869dc
"""
GLYPH_NEW = """    c.x[21] = uint32_t(uint32_t(c.x[3])); // mov w21, w3
    c.x[19] = uint64_t(c.x[0]); // mov x19, x0
    // PATCH-FSS-STALE-METRICS: the face/engine can disappear between FSS_set_scale's entry
    // check and this glyph scan.  The output metrics were just zeroed; leave without walking
    // a released table.
    if (c.x[19] == 0 || c.x[1] == 0 || nx::ld<uint64_t>(c.x[19] + 0x30) == 0) {
        static int fss_stale_glyph_logs = 0;
        if (fss_stale_glyph_logs < 8) {
            fss_stale_glyph_logs++;
            uint64_t fss_engine = c.x[19] ? nx::ld<uint64_t>(c.x[19] + 0x30) : 0;
            nx::log("FSSNULL stale_glyph font=%llx face=%llx engine=%llx",
                    (unsigned long long)c.x[19], (unsigned long long)c.x[1],
                    (unsigned long long)fss_engine);
        }
        goto L_1869E0;
    }
    if (uint32_t(c.x[8]) == 0) goto L_1869DC; // cbz w8, #0x1869dc
"""

MAIN_INC = '#include "funcs.h"\n'
MAIN_INC_NEW = '#include "funcs.h"\n#include <nx/runtime.h>  // PATCH-FSS-STALE-METRICS (nx::log)\n'


def patch_file(path, old, new, extra_include=False):
    t = open(path, encoding="utf-8", errors="replace", newline="").read()
    if "--restore" in sys.argv:
        if MARK not in t:
            return False
        if extra_include:
            t = t.replace(MAIN_INC_NEW, MAIN_INC, 1)
        t = t.replace(new, old, 1)
        open(path, "w", encoding="utf-8", newline="").write(t)
        return True
    if new in t:
        return False
    if old not in t:
        raise SystemExit("anchor not found in " + path)
    if extra_include and "#include <nx/runtime.h>" not in t:
        t = t.replace(MAIN_INC, MAIN_INC_NEW, 1)
    t = t.replace(old, new, 1)
    open(path, "w", encoding="utf-8", newline="").write(t)
    return True


def main():
    changed = False
    changed |= patch_file(MAIN, THUNK_OLD, THUNK_NEW, extra_include=True)
    changed |= patch_file(SDK, GLYPH_OLD, GLYPH_NEW)
    if "--restore" in sys.argv:
        print("restored" if changed else "nothing to restore")
    else:
        print("patched" if changed else "already applied")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
