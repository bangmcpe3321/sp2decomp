#!/usr/bin/env python3
"""Temporary diagnostic: which tutorial state runs, and what the guide message page gets.

`UICheck::PhaseTutorialTest` is a small state machine (Picture -> ExpController -> GuideMsg ->
Gyro -> CircleTimer).  Logging each state's entry shows where the first-launch tutorial sits; the
GuideMsg log adds the tutorial event bits ([app+0x94], [app+0x9e]), the message index and the
message label, and the ParamArg words handed to the page.

gen/main/code_258.cpp; idempotent (--restore).

Usage: python3 tools/patches/patch-tutdbg2.py [--restore]   (SP2PORT override)
"""
import os
import sys

ROOT = os.environ.get("SP2PORT", "/home/hexa/sp2port")
F = os.path.join(ROOT, "gen/main/code_258.cpp")

MARK = "PATCH-TUTDBG2"

OLD0 = '#include "funcs.h"\n'
NEW0 = '#include "funcs.h"\n#include <nx/runtime.h>  // PATCH-TUTDBG2 (nx::g_frame, nx::log)\n'

STATES = {
    "main_00BFA51C": "picture",
    "main_00BFA670": "expcontroller",
    "main_00BFA854": "guidemsg",
    "main_00BFAD58": "gyro",
    "main_00BFAE68": "circletimer",
    "main_00BFA49C": "menu",
}

GUIDE_OLD = """    c.x[30] = NXB + 0xbfa8b4ull; main_012AF368(c); // bl #0x12af368
    { uint64_t a = c.x[0] + 0x94ull; c.x[8] = uint32_t(nx::ld<uint8_t>(a)); } // ldrb w8, [x0, #0x94]
"""

GUIDE_NEW = """    c.x[30] = NXB + 0xbfa8b4ull; main_012AF368(c); // bl #0x12af368
    // PATCH-TUTDBG2: tutorial event flags and the message the guide page shows.
    {
        static uint64_t tutdbg_last = ~0ull;
        const uint64_t tutdbg_f = nx::g_frame.load();
        if (tutdbg_last == ~0ull || tutdbg_f - tutdbg_last >= 120) {
            tutdbg_last = tutdbg_f;
            const uint64_t tutdbg_obj = c.x[0];
            const uint64_t tutdbg_p = nx::ld<uint64_t>(c.x[19] + 0x238);
            char tutdbg_buf[72];
            int tutdbg_n = 0;
            if (tutdbg_p >= 0x100000000ull && tutdbg_p < 0x8000000000ull)
                for (; tutdbg_n < 64; tutdbg_n++) {
                    char ch = char(nx::ld<uint8_t>(tutdbg_p + tutdbg_n));
                    if (!ch) break;
                    tutdbg_buf[tutdbg_n] = (ch >= 32 && ch < 127) ? ch : '.';
                }
            tutdbg_buf[tutdbg_n] = 0;
            nx::log("TUTG f=%llu obj=%llx b12=%02x b94=%02x b9e=%02x idx=%u p238=%llx msg=%s",
                    (unsigned long long)tutdbg_f, (unsigned long long)tutdbg_obj, nx::ld<uint8_t>(tutdbg_obj + 0x12),
                    nx::ld<uint8_t>(tutdbg_obj + 0x94), nx::ld<uint8_t>(tutdbg_obj + 0x9e),
                    nx::ld<uint32_t>(c.x[19] + 0x228), (unsigned long long)tutdbg_p, tutdbg_buf);
        }
    }
    { uint64_t a = c.x[0] + 0x94ull; c.x[8] = uint32_t(nx::ld<uint8_t>(a)); } // ldrb w8, [x0, #0x94]
"""

PARAM_OLD = """    { uint64_t a = c.x[19] + 0x78ull; c.x[0] = uint64_t(nx::ld<uint64_t>(a)); } // ldr x0, [x19, #0x78]
    c.x[1] = uint64_t(uint64_t(c.x[31]) + uint64_t(0x20ull)); // add x1, sp, #0x20
    c.x[30] = NXB + 0xbfa964ull; main_00A56004(c); // bl #0xa56004
"""

PARAM_NEW = """    { uint64_t a = c.x[19] + 0x78ull; c.x[0] = uint64_t(nx::ld<uint64_t>(a)); } // ldr x0, [x19, #0x78]
    // PATCH-TUTDBG2: ParamArg handed to the guide-message page (its first words, plus any strings).
    {
        static uint64_t tutdbg_last = ~0ull;
        const uint64_t tutdbg_f = nx::g_frame.load();
        if (tutdbg_last == ~0ull || tutdbg_f - tutdbg_last >= 120) {
            tutdbg_last = tutdbg_f;
            uint64_t tutdbg_q[8];
            for (int i = 0; i < 8; i++) tutdbg_q[i] = nx::ld<uint64_t>(c.x[31] + 0x20 + 8 * i);
            char tutdbg_s[8][40];
            for (int i = 0; i < 8; i++) {
                tutdbg_s[i][0] = 0;
                uint64_t p = tutdbg_q[i];
                if (p >= 0x100000000ull && p < 0x8000000000ull) {
                    int n = 0;
                    for (; n < 32; n++) {
                        char ch = char(nx::ld<uint8_t>(p + n));
                        if (!ch) break;
                        tutdbg_s[i][n] = (ch >= 32 && ch < 127) ? ch : '.';
                    }
                    tutdbg_s[i][n] = 0;
                }
            }
            nx::log("TUTP f=%llu q=%llx,%llx,%llx,%llx,%llx,%llx,%llx,%llx | s='%s' '%s' '%s' '%s'",
                    (unsigned long long)tutdbg_f, (unsigned long long)tutdbg_q[0], (unsigned long long)tutdbg_q[1],
                    (unsigned long long)tutdbg_q[2], (unsigned long long)tutdbg_q[3], (unsigned long long)tutdbg_q[4],
                    (unsigned long long)tutdbg_q[5], (unsigned long long)tutdbg_q[6], (unsigned long long)tutdbg_q[7],
                    tutdbg_s[0], tutdbg_s[1], tutdbg_s[2], tutdbg_s[3]);
        }
    }
    c.x[1] = uint64_t(uint64_t(c.x[31]) + uint64_t(0x20ull)); // add x1, sp, #0x20
    c.x[30] = NXB + 0xbfa964ull; main_00A56004(c); // bl #0xa56004
"""


def entry_log(fn, name):
    return (
        "void %s(nx::CPU& NX_RESTRICT c) {\n"
        "    // PATCH-TUTDBG2: tutorial state entered.\n"
        "    { static uint64_t tutdbg_last = ~0ull; const uint64_t tutdbg_f = nx::g_frame.load();\n"
        "      if (tutdbg_last == ~0ull || tutdbg_f - tutdbg_last >= 120) { tutdbg_last = tutdbg_f;\n"
        "        nx::log(\"TUTSTATE %s f=%%llu\", (unsigned long long)tutdbg_f); } }\n" % (fn, name)
    )


def main():
    t = open(F, encoding="utf-8", errors="replace", newline="").read()
    if "--restore" in sys.argv:
        if MARK not in t:
            print("nothing to restore")
            return
        for fn in STATES:
            t = t.replace(entry_log(fn, STATES[fn]), "void %s(nx::CPU& NX_RESTRICT c) {\n" % fn, 1)
        t = t.replace(GUIDE_NEW, GUIDE_OLD, 1).replace(PARAM_NEW, PARAM_OLD, 1).replace(NEW0, OLD0, 1)
        open(F, "w", encoding="utf-8", newline="").write(t)
        print("restored")
        return
    if MARK in t:
        print("already applied")
        return
    if OLD0 not in t or GUIDE_OLD not in t or PARAM_OLD not in t:
        raise SystemExit("pattern not found: " + F)
    for fn in STATES:
        old = "void %s(nx::CPU& NX_RESTRICT c) {\n" % fn
        if old not in t:
            raise SystemExit("state entry not found: " + fn)
        t = t.replace(old, entry_log(fn, STATES[fn]), 1)
    t = t.replace(OLD0, NEW0, 1).replace(GUIDE_OLD, GUIDE_NEW, 1).replace(PARAM_OLD, PARAM_NEW, 1)
    open(F, "w", encoding="utf-8", newline="").write(t)
    print("patched", F)


if __name__ == "__main__":
    main()
