#!/usr/bin/env python3
"""FSS_get_advance: survive a font slot whose engine disappears during a scene transition.

`nn::font::TextureCache::CalculateCharWidth` keeps a pointer to a font slot and calls
`FSS_get_advance` on it.  The plaza scene load frees the font's engine (`[font+0x30]`)
while the UI layout thread is still laying out text, so the guest reloads the slot after
`FSS_set_scale`/the advance call, finds zero, and dereferences `[0+0x24]` -- the
`FSS_get_advance+c0` crash at frame 5958 (data address 0x24).

The guest already has an error path for an invalid font (0x131, the same value the
`FSS_set_scale` null-face patch returns).  This patch checks the engine/data pointers
on entry and again after every reload, records 0x131 in `[font+0x48]`, and returns
through the function's normal epilogue.  The affected glyphs get zero metrics; the game
keeps running and the scene transition can finish.

gen/sdk/code_033.cpp; idempotent (--restore).

Usage: python3 tools/patches/patch-fss-get-advance-null.py [--restore]   (SP2PORT override)
"""
import os
import sys

ROOT = os.environ.get("SP2PORT", "/home/hexa/sp2port")
F = os.path.join(ROOT, "gen/sdk/code_033.cpp")
MARK = "PATCH-FSS-ADVNULL"

ENTRY_OLD = """    c.x[30] = NXB + 0x18a8e4ull; sdk_002BF95C(c); // bl #0x2bf95c
    if (uint32_t(c.x[0]) != 0) goto L_18B034; // cbnz w0, #0x18b034
    { uint64_t a = c.x[19] + 0x38ull; c.x[8] = uint64_t(nx::ld<uint64_t>(a)); } // ldr x8, [x19, #0x38]
"""
ENTRY_NEW = """    c.x[30] = NXB + 0x18a8e4ull; sdk_002BF95C(c); // bl #0x2bf95c
    if (uint32_t(c.x[0]) != 0) goto L_18B034; // cbnz w0, #0x18b034
    // PATCH-FSS-ADVNULL: the scene load can free the font slot's engine/data while a UI
    // layout still holds the slot.  Return FSS's invalid-font error instead of dereferencing 0.
    if (nx::ld<uint64_t>(c.x[19] + 0x30) == 0 || nx::ld<uint64_t>(c.x[19] + 0x38) == 0) {
        static int fss_advnull_entry_logs = 0;
        if (fss_advnull_entry_logs < 8) {
            fss_advnull_entry_logs++;
            nx::log("FSSNULL get_advance entry font=%llx engine=%llx data=%llx",
                    (unsigned long long)c.x[19],
                    (unsigned long long)nx::ld<uint64_t>(c.x[19] + 0x30),
                    (unsigned long long)nx::ld<uint64_t>(c.x[19] + 0x38));
        }
        { uint64_t a = c.x[19] + 0x48ull; nx::st<uint32_t>(a, uint32_t(0x131u)); }
        c.x[0] = uint32_t(0x131ull);
        goto L_18B038;
    }
    { uint64_t a = c.x[19] + 0x38ull; c.x[8] = uint64_t(nx::ld<uint64_t>(a)); } // ldr x8, [x19, #0x38]
"""

RELOAD_OLD = """    { uint64_t a = c.x[19] + 0x48ull; c.x[0] = uint32_t(nx::ld<uint32_t>(a)); } // ldr w0, [x19, #0x48]
    if (uint32_t(c.x[0]) != 0) goto L_18B038; // cbnz w0, #0x18b038
    { uint64_t a = c.x[19] + 0x30ull; c.x[8] = uint64_t(nx::ld<uint64_t>(a)); } // ldr x8, [x19, #0x30]
    { uint64_t a = c.x[8] + 0x24ull; c.x[8] = uint32_t(nx::ld<uint8_t>(a)); } // ldrb w8, [x8, #0x24]
"""
RELOAD_NEW = """    { uint64_t a = c.x[19] + 0x48ull; c.x[0] = uint32_t(nx::ld<uint32_t>(a)); } // ldr w0, [x19, #0x48]
    if (uint32_t(c.x[0]) != 0) goto L_18B038; // cbnz w0, #0x18b038
    { uint64_t a = c.x[19] + 0x30ull; c.x[8] = uint64_t(nx::ld<uint64_t>(a)); } // ldr x8, [x19, #0x30]
    // PATCH-FSS-ADVNULL: the engine can be freed after the advance call; do not reload-deref null.
    if (c.x[8] == 0) {
        static int fss_advnull_reload_logs = 0;
        if (fss_advnull_reload_logs < 8) {
            fss_advnull_reload_logs++;
            nx::log("FSSNULL get_advance reload font=%llx (engine null)", (unsigned long long)c.x[19]);
        }
        { uint64_t a = c.x[19] + 0x48ull; nx::st<uint32_t>(a, uint32_t(0x131u)); }
        c.x[0] = uint32_t(0x131ull);
        goto L_18B038;
    }
    { uint64_t a = c.x[8] + 0x24ull; c.x[8] = uint32_t(nx::ld<uint8_t>(a)); } // ldrb w8, [x8, #0x24]
"""

AB24_OLD = """L_18AB24:;
    { uint64_t a = c.x[19] + 0x30ull; c.x[9] = uint64_t(nx::ld<uint64_t>(a)); } // ldr x9, [x19, #0x30]
    { uint64_t a = c.x[9] + 0x24ull; c.x[9] = uint32_t(nx::ld<uint32_t>(a)); } // ldr w9, [x9, #0x24]
"""
AB24_NEW = """L_18AB24:;
    { uint64_t a = c.x[19] + 0x30ull; c.x[9] = uint64_t(nx::ld<uint64_t>(a)); } // ldr x9, [x19, #0x30]
    // PATCH-FSS-ADVNULL: same null engine on the post-advance attribute path.
    if (c.x[9] == 0) {
        static int fss_advnull_attr_logs = 0;
        if (fss_advnull_attr_logs < 8) {
            fss_advnull_attr_logs++;
            nx::log("FSSNULL get_advance attr font=%llx (engine null)", (unsigned long long)c.x[19]);
        }
        { uint64_t a = c.x[19] + 0x48ull; nx::st<uint32_t>(a, uint32_t(0x131u)); }
        c.x[0] = uint32_t(0x131ull);
        goto L_18B038;
    }
    { uint64_t a = c.x[9] + 0x24ull; c.x[9] = uint32_t(nx::ld<uint32_t>(a)); } // ldr w9, [x9, #0x24]
"""

PAIRS = [(ENTRY_OLD, ENTRY_NEW), (RELOAD_OLD, RELOAD_NEW), (AB24_OLD, AB24_NEW)]


def main() -> int:
    t = open(F, encoding="utf-8", errors="replace", newline="").read()
    if "--restore" in sys.argv:
        if MARK not in t:
            print("nothing to restore")
            return 0
        for old, new in PAIRS:
            t = t.replace(new, old, 1)
        open(F, "w", encoding="utf-8", newline="").write(t)
        print("restored", F)
        return 0

    if "#include <nx/runtime.h>" not in t:
        t = t.replace('#include "funcs.h"\n', '#include "funcs.h"\n#include <nx/runtime.h>  // PATCH-FSS-ADVNULL\n', 1)

    added = 0
    for old, new in PAIRS:
        if new in t:
            continue
        if old not in t:
            raise SystemExit("anchor not found (already partially patched?): " + F)
        t = t.replace(old, new, 1)
        added += 1
    if added == 0:
        print("already applied")
        return 0
    open(F, "w", encoding="utf-8", newline="").write(t)
    print(f"patched {added} site(s) in {F}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
