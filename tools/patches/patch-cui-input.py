#!/usr/bin/env python3
"""Diagnostic: log the button words the CUI parts code reads, when they are non-zero.

The old UIDBG block logged the first 600 calls, all before any input, so it never showed a press.
This logs only non-zero button words, with the caller (`nx::describe`) so the UI path that reads the
pad can be identified, and caps at 300 lines.  It goes where UIDBG was (the end of
`Cui::InputContext::onSetup`), before the epilogue that restores x19/x20/x29/x30.

gen/main/code_038.cpp; idempotent (--restore).

Usage: python3 tools/patches/patch-cui-input.py [--restore]   (SP2PORT override)
"""
import os
import sys

ROOT = os.environ.get("SP2PORT", "/home/hexa/sp2port")
F = os.path.join(ROOT, "gen/main/code_038.cpp")

MARK = "PATCH-CUIINPUT"

ANCHOR = """    { uint64_t a = c.x[31] + 0x10ull; auto v0 = nx::ld<uint64_t>(a + 0); auto v1 = nx::ld<uint64_t>(a + 8); c.x[29] = uint64_t(v0); c.x[30] = uint64_t(v1); } // ldp x29, x30, [sp, #0x10]
    { uint64_t a = c.x[31]; auto v0 = nx::ld<uint64_t>(a + 0); auto v1 = nx::ld<uint64_t>(a + 8); c.x[31] += 0x20ull; c.x[20] = uint64_t(v0); c.x[19] = uint64_t(v1); } // ldp x20, x19, [sp], #0x20
    return; // ret 
}

void main_001CB5F0(nx::CPU& NX_RESTRICT c) {
"""

BLOCK = """    { // PATCH-CUIINPUT (temporary): non-zero pad words the CUI parts code reads.
        static unsigned long long cui_logged = 0;
        unsigned long long cui_ctrl = c.x[0];
        unsigned cui_btn = cui_ctrl ? nx::ld<uint32_t>(cui_ctrl + 0x10) : 0;
        unsigned cui_mask = c.x[20] ? uint32_t(nx::ld<uint32_t>(c.x[20])) : 0;
        unsigned cui_stick = c.x[20] ? uint32_t(nx::ld<uint32_t>(c.x[20] + 4)) : 0;
        if ((cui_btn || cui_stick) && cui_logged < 300) {
            ++cui_logged;
            nx::log("CUIIN btn=%x mask=%x stick=%x lr=%s", cui_btn, cui_mask, cui_stick,
                    nx::describe(c.x[30]).c_str());
        }
    } // PATCH-CUIINPUT (temporary)
"""

NEW_ANCHOR = BLOCK + ANCHOR


def main():
    t = open(F, encoding="utf-8", errors="replace", newline="").read()
    if "--restore" in sys.argv:
        if MARK not in t:
            print("nothing to restore")
            return
        t = t.replace(NEW_ANCHOR, ANCHOR, 1)
        open(F, "w", encoding="utf-8", newline="").write(t)
        print("restored")
        return
    if MARK in t:
        print("already applied")
        return
    if ANCHOR not in t:
        raise SystemExit("anchor not found: " + F)
    t = t.replace(ANCHOR, NEW_ANCHOR, 1)
    open(F, "w", encoding="utf-8", newline="").write(t)
    print("patched", F)


if __name__ == "__main__":
    main()
