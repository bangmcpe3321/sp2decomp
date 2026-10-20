#!/usr/bin/env python3
"""Diagnostic: name the SDK import that FSS_set_scale calls (sdk_002C971C's PLT target).

FSS_set_scale reads the font's face pointer, calls this import, and then finds the face pointer
zero (FSSNULL).  `nx::describe` resolves the GOT target to a module+symbol, saying which API the
font code is entering when the face disappears.

gen/sdk/code_059.cpp; idempotent (--restore).

Usage: python3 tools/patches/patch-fss-call.py [--restore]   (SP2PORT override)
"""
import os
import sys

ROOT = os.environ.get("SP2PORT", "/home/hexa/sp2port")
F = os.path.join(ROOT, "gen/sdk/code_059.cpp")

MARK = "PATCH-FSSCALL"

OLD0 = '#include "funcs.h"\n'
NEW0 = '#include "funcs.h"\n#include <nx/runtime.h>  // PATCH-FSSCALL (nx::describe)\n'

OLD = """void sdk_002C971C(nx::CPU& NX_RESTRICT c) {
    c.x[16] = uint64_t(NXB + 0x6bb000ull); // adrp x16, #0x6bb000
    { uint64_t a = c.x[16] + 0x718ull; c.x[17] = uint64_t(nx::ld<uint64_t>(a)); } // ldr x17, [x16, #0x718]
    c.x[16] = uint64_t(uint64_t(c.x[16]) + uint64_t(0x718ull)); // add x16, x16, #0x718
    { nx::call(c, c.x[17]); return; } // br x17
}
"""

NEW = """void sdk_002C971C(nx::CPU& NX_RESTRICT c) {
    c.x[16] = uint64_t(NXB + 0x6bb000ull); // adrp x16, #0x6bb000
    { uint64_t a = c.x[16] + 0x718ull; c.x[17] = uint64_t(nx::ld<uint64_t>(a)); } // ldr x17, [x16, #0x718]
    c.x[16] = uint64_t(uint64_t(c.x[16]) + uint64_t(0x718ull)); // add x16, x16, #0x718
    // PATCH-FSSCALL: which import the font scale call enters.
    {
        static int fsscall_n = 0;
        if (fsscall_n++ < 8)
            nx::log("FSSCALL target=%llx %s", (unsigned long long)c.x[17], nx::describe(c.x[17]).c_str());
    }
    { nx::call(c, c.x[17]); return; } // br x17
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
