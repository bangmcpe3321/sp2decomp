#!/usr/bin/env python3
"""Remove the ad-hoc (temporary) guest diagnostics before a production build.

During the tutorial investigation a number of debug hooks were pasted straight into the
generated guest code (UIDBG, PARTSDBG, MSGDBG, TITLEDBG, CTRLDBG, LPCTRLDBG, LPDATA2DBG,
PATCH-CUIINPUT).  Each is wrapped in a pair of markers:

    { // CTRLDBG (temporary)
    ...
    } // CTRLDBG (temporary)

and some files have a matching `#include <nx/runtime.h>  // CTRLDBG (temporary)` line.
The hooks are useful while debugging but they log on every input change and are not part of
the port.  This removes every marked block (and its include) and leaves the code the
decompiler generated.  Idempotent: running it on a clean tree does nothing.

gen/main/code_*.cpp; writes only the files that changed.

Usage: python3 tools/patches/patch-remove-debug-hooks.py [--check]   (SP2PORT override)
"""
import glob
import os
import re
import sys

ROOT = os.environ.get("SP2PORT", "/home/hexa/sp2port")
GEN = os.path.join(ROOT, "gen/main")

BLOCK = re.compile(r"[ \t]*\{ // [A-Za-z0-9_/-]+ \(temporary\)[^\n]*\n.*?\n[ \t]*\} // [A-Za-z0-9_/-]+ \(temporary\)[^\n]*\n", re.S)
INCLUDE = re.compile(r"#include <nx/runtime\.h>[ \t]*// [A-Za-z0-9_/-]+ \(temporary\)[^\n]*\n")


def main():
    check = "--check" in sys.argv
    changed = 0
    leftover = 0
    for path in sorted(glob.glob(os.path.join(GEN, "code_*.cpp"))):
        with open(path, encoding="utf-8", newline="") as f:
            text = f.read()
        new = BLOCK.sub("", text)
        new = INCLUDE.sub("", new)
        if "(temporary)" in new and "FONTLOG" not in new:
            leftover += 1
        if new != text:
            changed += 1
            if not check:
                with open(path, "w", encoding="utf-8", newline="") as f:
                    f.write(new)
    print(("would clean" if check else "cleaned"), changed, "file(s);", leftover, "file(s) still mention (temporary)")


main()
