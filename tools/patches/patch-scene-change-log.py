#!/usr/bin/env python3
"""main_00620ED0: log tutorial state transitions (temporary diagnostic).

`main_00620E54` returns `[this+0x340]+0x10`; `main_00620ED0(this, state)` runs the
state-exit/enter hooks and then stores the new state. The tutorial pages are selected by
a step bitmask (`+0x5d8`) dispatched from `main_00AFD8D4`: bit 4 -> 6, bit 6 -> 7,
bit 7 -> 9, bit 5 -> 10, bit 8 -> 11. Logging the old/new state shows which page the UI
actually entered, so a wrong forced transition (for example a quit-to-title) is obvious.

gen/main/code_132.cpp; idempotent (--restore). The file does not include the runtime
logger by default, so the patch also adds `<nx/runtime.h>` (as the TUTDBG patch did for
code_215.cpp).

Usage: python3 tools/patches/patch-scene-change-log.py [--restore]   (SP2PORT override)
"""
import os
import sys

ROOT = os.environ.get("SP2PORT", "/home/hexa/sp2port")
F = os.path.join(ROOT, "gen/main/code_132.cpp")

MARK = "PATCH-SCENECHG"
INC_OLD = '#include "funcs.h"\n'
INC_NEW = '#include <nx/runtime.h>  // PATCH-SCENECHG (temporary)\n#include "funcs.h"\n'
OLD = "void main_00620ED0(nx::CPU& NX_RESTRICT c) {\n"
NEW = """void main_00620ED0(nx::CPU& NX_RESTRICT c) {
    // PATCH-SCENECHG (temporary): show the tutorial page sequence.  main_00620E54 returns
    // [this+0x340]+0x10; log the old state and the requested state before the hooks run.
    {
        static int n = 0;
        if (n < 400) {
            n++;
            uint64_t sm = c.x[0] ? nx::ld<uint64_t>(c.x[0] + 0x340) : 0;
            uint32_t old = sm ? nx::ld<uint32_t>(sm + 0x10) : 0xffffffffu;
            nx::log("SCENECHG %u -> %u this=%llx", old, uint32_t(c.x[1]), (unsigned long long)c.x[0]);
        }
    }
"""


def main():
    restore = "--restore" in sys.argv
    text = open(F, encoding="utf-8").read()
    if restore:
        changed = False
        if NEW in text:
            text = text.replace(NEW, OLD, 1)
            changed = True
        if INC_NEW in text:
            text = text.replace(INC_NEW, INC_OLD, 1)
            changed = True
        if changed:
            open(F, "w", encoding="utf-8").write(text)
            print("restored", F)
        else:
            print("not patched:", F)
        return
    if MARK in text:
        # The function log may already be there; still add the missing runtime include.
        if INC_NEW in text:
            print("already patched:", F)
            return
        text = text.replace(INC_OLD, INC_NEW, 1)
        open(F, "w", encoding="utf-8").write(text)
        print("added runtime include:", F)
        return
    if OLD not in text:
        print("anchor not found in", F)
        sys.exit(1)
    text = text.replace(INC_OLD, INC_NEW, 1)
    text = text.replace(OLD, NEW, 1)
    open(F, "w", encoding="utf-8").write(text)
    print("patched", F)


if __name__ == "__main__":
    main()
