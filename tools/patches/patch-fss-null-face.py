#!/usr/bin/env python3
"""FSS_set_scale: survive a font face that disappears during the scaler call.

`nn::font::TextureCache::CalculateCharWidth` / `CalculateKerning` pass
`[TextureCache+0x10] + slot*0xB8` to FSS_set_scale. The function checks `[font+0x10]`
(the face) once, calls `get_scale_inputs`, then reloads the same field and reads
`[face+0x20]` **without a second check**. In the port the face is zero by the time of the
reload (the title transition frees the font the layout still holds), so the game dies at
data address `0x20` -- first in `CalculateCharWidth` (Japanese run) and then in
`CalculateKerning` (English run), both with host frame sdk_001864B8.

This patch honours FSS's own null-face error (0x131) when the reload finds zero, and logs
the first few occurrences (`FSSNULL ...`) so the cause can be confirmed. Text laid out with
such a stale font loses that glyph's metrics but the game keeps running.

gen/sdk/code_033.cpp; idempotent (--restore).

Usage: python3 tools/patches/patch-fss-null-face.py [--restore]   (SP2PORT override)
"""
import os
import sys

ROOT = os.environ.get("SP2PORT", "/home/hexa/sp2port")
F = os.path.join(ROOT, "gen/sdk/code_033.cpp")

OLD0 = '#include "funcs.h"\n'
NEW0 = '#include "funcs.h"\n#include <nx/runtime.h>  // PATCH-FSS-NULL (nx::log)\n'

OLD1 = """    c.x[19] = uint64_t(c.x[0]); // mov x19, x0
    { uint64_t a = c.x[19] + 0x10ull; c.x[8] = uint64_t(nx::ld<uint64_t>(a)); } // ldr x8, [x19, #0x10]
"""
NEW1 = """    c.x[19] = uint64_t(c.x[0]); // mov x19, x0
    { uint64_t a = c.x[19] + 0x10ull; c.x[8] = uint64_t(nx::ld<uint64_t>(a)); } // ldr x8, [x19, #0x10]
    const uint64_t fss_face0 = c.x[8]; // PATCH-FSS-NULL: face FSS_set_scale validated at entry
"""

OLD2 = """    c.x[30] = NXB + 0x186514ull; sdk_002C971C(c); // bl #0x2c971c
    if (uint32_t(c.x[0]) == 0) goto L_18652C; // cbz w0, #0x18652c
"""
NEW2 = """    c.x[30] = NXB + 0x186514ull; sdk_002C971C(c); // bl #0x2c971c
    if (uint32_t(c.x[0]) == 0) { // cbz w0, #0x18652c
        // PATCH-FSS-NULL: the guest reloads [font+0x10] here and reads [face+0x20] with no null check.
        if (nx::ld<uint64_t>(c.x[19] + 0x10) == 0) {
            static int fss_null_logs = 0;
            if (fss_null_logs < 8) {
                fss_null_logs++;
                nx::log("FSSNULL set_scale font=%llx face_at_entry=%llx w0=%u", (unsigned long long)c.x[19],
                        (unsigned long long)fss_face0, uint32_t(c.x[0]));
            }
            goto L_186520; // FSS's own null-face error (0x131)
        }
        goto L_18652C;
    }
"""


def main():
    t = open(F, encoding="utf-8", errors="replace", newline="").read()
    if "--restore" in sys.argv:
        if "PATCH-FSS-NULL" not in t:
            print("nothing to restore")
            return
        t = t.replace(NEW0, OLD0, 1).replace(NEW1, OLD1, 1).replace(NEW2, OLD2, 1)
        open(F, "w", encoding="utf-8", newline="").write(t)
        print("restored")
        return
    if "PATCH-FSS-NULL" in t:
        print("already applied")
        return
    if OLD0 not in t or OLD1 not in t or OLD2 not in t:
        raise SystemExit("pattern not found: " + F)
    t = t.replace(OLD0, NEW0, 1).replace(OLD1, NEW1, 1).replace(OLD2, NEW2, 1)
    open(F, "w", encoding="utf-8", newline="").write(t)
    print("patched", F)


if __name__ == "__main__":
    main()
