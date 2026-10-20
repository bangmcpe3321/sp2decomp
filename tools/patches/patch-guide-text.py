#!/usr/bin/env python3
"""Diagnostic: log the two SafeStrings handed to TutorialGuideMsgPage::setParam.

The tutorial guide page gets its text through `PageHandlerTutorial::setParam(const ParamArg&)`;
ParamArg holds two sead::SafeString objects (vtable at +0, mString at +8).  Logging them names the
message label (or the literal text) of the step on screen, so a tutorial step can be matched to its
MSBT entry and to the input it waits for.

gen/main/code_223.cpp; idempotent (--restore).

Usage: python3 tools/patches/patch-guide-text.py [--restore]   (SP2PORT override)
"""
import os
import sys

ROOT = os.environ.get("SP2PORT", "/home/hexa/sp2port")
F = os.path.join(ROOT, "gen/main/code_223.cpp")

MARK = "PATCH-GUIDETEXT"

OLD0 = '#include "funcs.h"\n'
NEW0 = '#include "funcs.h"\n#include <nx/runtime.h>  // PATCH-GUIDETEXT (nx::log)\n'

OLD = """void main_00A58624(nx::CPU& NX_RESTRICT c) {
"""

NEW = """void main_00A58624(nx::CPU& NX_RESTRICT c) {
    // PATCH-GUIDETEXT: the two SafeStrings of the ParamArg handed to the guide message page.
    {
        static int guidedbg_n = 0;
        if (guidedbg_n++ < 60) {
            const uint64_t guidedbg_a = c.x[1];
            const uint64_t guideddbg_q0 = nx::ld<uint64_t>(guidedbg_a);
            const uint64_t guideddbg_q1 = nx::ld<uint64_t>(guidedbg_a + 8);
            const uint64_t guideddbg_q2 = nx::ld<uint64_t>(guidedbg_a + 0x10);
            const uint64_t guideddbg_q3 = nx::ld<uint64_t>(guidedbg_a + 0x18);
            char guideddbg_s1[72], guideddbg_s2[72];
            guideddbg_s1[0] = guideddbg_s2[0] = 0;
            if (guideddbg_q1 >= 0x100000000ull && guideddbg_q1 < 0x8000000000ull) {
                int n = 0;
                for (; n < 64; n++) {
                    char ch = char(nx::ld<uint8_t>(guideddbg_q1 + n));
                    if (!ch) break;
                    guideddbg_s1[n] = (ch >= 32 && ch < 127) ? ch : '.';
                }
                guideddbg_s1[n] = 0;
            }
            if (guideddbg_q3 >= 0x100000000ull && guideddbg_q3 < 0x8000000000ull) {
                int n = 0;
                for (; n < 64; n++) {
                    char ch = char(nx::ld<uint8_t>(guideddbg_q3 + n));
                    if (!ch) break;
                    guideddbg_s2[n] = (ch >= 32 && ch < 127) ? ch : '.';
                }
                guideddbg_s2[n] = 0;
            }
            nx::log("GUIDETEXT arg=%llx q=%llx,%llx,%llx,%llx s1='%s' s2='%s'",
                    (unsigned long long)guidedbg_a, (unsigned long long)guideddbg_q0, (unsigned long long)guideddbg_q1,
                    (unsigned long long)guideddbg_q2, (unsigned long long)guideddbg_q3, guideddbg_s1, guideddbg_s2);
        }
    }
"""


def main():
    t = open(F, encoding="utf-8", errors="replace", newline="").read()
    if "--restore" in sys.argv:
        if MARK not in t:
            print("nothing to restore")
            return
        t = t.replace(NEW, OLD, 1).replace(NEW0, OLD0, 1)
        open(F, "w", encoding="utf-8", newline="").write(t)
        print("restored")
        return
    if MARK in t:
        print("already applied")
        return
    if OLD0 not in t or OLD not in t:
        raise SystemExit("pattern not found: " + F)
    t = t.replace(OLD0, NEW0, 1).replace(OLD, NEW, 1)
    open(F, "w", encoding="utf-8", newline="").write(t)
    print("patched", F)


if __name__ == "__main__":
    main()
