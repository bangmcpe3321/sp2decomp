#!/usr/bin/env python3
"""Reject font slots whose font-data pointer is zero before FSS metric scans.

`FSS_get_advance` reports the stale slot as `engine=<ptr> data=0`.  The engine-only
`FSSNULL stale_scale` guard catches slots that have already lost the engine, but the
plaza/news layout can keep a slot with a live engine and a zero font-data pointer.  Those
calls still enter `FSS_set_scale` and walk a released glyph table.

This adds a second, narrow check at the `ScalableFontEngine::SetScale` thunk and at the
`sdk_00186848` glyph helper: when `[font+0x38]` (font data) is zero, return zero metrics
(the output struct was already zeroed) instead of scanning.  Valid slots are unaffected.

Applies after patch-font-stale-metrics.py; idempotent (--restore).

Usage: python3 tools/patches/patch-font-stale-data.py [--restore]   (SP2PORT override)
"""
import os
import sys

ROOT = os.environ.get("SP2PORT", "/home/hexa/sp2port")
MAIN = os.path.join(ROOT, "gen/main/code_432.cpp")
SDK = os.path.join(ROOT, "gen/sdk/code_033.cpp")
MARK = "PATCH-FSS-STALE-DATA"

MAIN_OLD = """        c.x[0] = uint32_t(0x131ull);
        return;
    }
    c.x[16] = uint64_t(NXB + 0x2f9b000ull); // adrp x16, #0x2f9b000
"""
MAIN_NEW = """        c.x[0] = uint32_t(0x131ull);
        return;
    }
    // PATCH-FSS-STALE-DATA: a live engine with a zero font-data pointer still walks a
    // released face in FSS_set_scale.  The width/advance will be zero; do not scan.
    if (nx::ld<uint64_t>(c.x[0] + 0x38ull) == 0) {
        static int fss_stale_data_logs = 0;
        if (fss_stale_data_logs < 8) {
            fss_stale_data_logs++;
            nx::log(\"FSSNULL stale_scale_data font=%llx face=%llx engine=%llx data=%llx\",
                    (unsigned long long)c.x[0],
                    (unsigned long long)nx::ld<uint64_t>(c.x[0] + 0x10),
                    (unsigned long long)nx::ld<uint64_t>(c.x[0] + 0x30),
                    (unsigned long long)nx::ld<uint64_t>(c.x[0] + 0x38));
        }
        { uint64_t a = c.x[0] + 0x48ull; nx::st<uint32_t>(a, uint32_t(0x131u)); }
        c.x[0] = uint32_t(0x131ull);
        return;
    }
    c.x[16] = uint64_t(NXB + 0x2f9b000ull); // adrp x16, #0x2f9b000
"""

GLYPH_OLD = """        goto L_1869E0;
    }
    if (uint32_t(c.x[8]) == 0) goto L_1869DC; // cbz w8, #0x1869dc
"""
GLYPH_NEW = """        goto L_1869E0;
    }
    // PATCH-FSS-STALE-DATA: same check inside the glyph-table helper; the metrics output
    // has already been zeroed above.
    if (nx::ld<uint64_t>(c.x[19] + 0x38ull) == 0) {
        static int fss_stale_data_glyph_logs = 0;
        if (fss_stale_data_glyph_logs < 8) {
            fss_stale_data_glyph_logs++;
            nx::log(\"FSSNULL stale_glyph_data font=%llx face=%llx data=%llx\",
                    (unsigned long long)c.x[19], (unsigned long long)c.x[1],
                    (unsigned long long)nx::ld<uint64_t>(c.x[19] + 0x38));
        }
        goto L_1869E0;
    }
    if (uint32_t(c.x[8]) == 0) goto L_1869DC; // cbz w8, #0x1869dc
"""


def patch(path, old, new):
    t = open(path, encoding="utf-8", errors="replace", newline="").read()
    if "--restore" in sys.argv:
        if MARK not in t:
            return False
        t = t.replace(new, old, 1)
        open(path, "w", encoding="utf-8", newline="").write(t)
        return True
    if new in t:
        return False
    if old not in t:
        raise SystemExit("anchor not found in " + path)
    t = t.replace(old, new, 1)
    open(path, "w", encoding="utf-8", newline="").write(t)
    return True


def main():
    changed = False
    changed |= patch(MAIN, MAIN_OLD, MAIN_NEW)
    changed |= patch(SDK, GLYPH_OLD, GLYPH_NEW)
    if "--restore" in sys.argv:
        print("restored" if changed else "nothing to restore")
    else:
        print("patched" if changed else "already applied")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
