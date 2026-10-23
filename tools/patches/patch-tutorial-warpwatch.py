#!/usr/bin/env python3
"""Temporary diagnostics for the tutorial's warp-to-plaza state (0xa004a4).

Logs the warp timer [+0x3dc], the `isReqChangeScene` check result and the moment the
plaza scene change is requested.  Used with patch-tutorial-force-page.py (state 8), whose
Move-page force now presets the timer to 0xb4 so the request branch can run.

Apply:   SP2PORT=/home/hexa/sp2port python3 patch-tutorial-warpwatch.py
Restore: SP2PORT=/home/hexa/sp2port python3 patch-tutorial-warpwatch.py --restore
"""
import os
import sys
from pathlib import Path

ROOT = Path(os.environ.get("SP2PORT", "/home/hexa/sp2port"))
SRC = ROOT / "gen/main/code_215.cpp"

FUNC = "void main_00A004A4(nx::CPU& NX_RESTRICT c) {"
PROLOGUE = "    c.x[19] = uint64_t(c.x[0]); // mov x19, x0\n"
CHECK = "    c.x[30] = NXB + 0xa004c4ull; main_012C67C0(c); // bl #0x12c67c0\n"
REQUEST = "    c.x[30] = NXB + 0xa004e0ull; main_0013905C(c); // bl #0x13905c\n"

BEGIN = "    { // WARPWATCH (temporary)\n"
END = "    } // WARPWATCH (temporary)\n"
WATCH = BEGIN + """\
        static int wn = 0;
        if (wn < 300 && (wn++ % 30) == 0) {
            nx::log("WARPWATCH n=%d t=%u", wn, (unsigned)nx::ld<uint32_t>(c.x[19] + 0x3dc));
        }
""" + END

CHK = '    nx::log("WARPCHK t=%u req=%u", (unsigned)nx::ld<uint32_t>(c.x[19] + 0x3dc), (unsigned)(uint32_t(c.x[0]) & 1)); // WARPCHK (temporary)\n'
REQ = '    nx::log("WARPREQ t=%u", (unsigned)nx::ld<uint32_t>(c.x[19] + 0x3dc)); // WARPREQ (temporary)\n'


def main() -> int:
    src = SRC.read_text()
    if "--restore" in sys.argv:
        for s in (WATCH, CHK, REQ):
            src = src.replace(s, "")
        SRC.write_text(src)
        print(f"restored {SRC}")
        return 0
    if WATCH in src:
        print(f"already applied: {SRC}")
        return 0
    start = src.find(FUNC)
    if start < 0:
        print(f"function not found: {SRC}")
        return 1
    end = src.find("\nvoid ", start + len(FUNC))
    if end < 0:
        end = len(src)
    body = src[start:end]
    for needle in (PROLOGUE, CHECK, REQUEST):
        if body.count(needle) != 1:
            print(f"anchor count {body.count(needle)} in {FUNC}: {needle!r}")
            return 1
    body = body.replace(PROLOGUE, PROLOGUE + WATCH, 1)
    body = body.replace(CHECK, CHECK + CHK, 1)
    body = body.replace(REQUEST, REQ + REQUEST, 1)
    src = src[:start] + body + src[end:]
    SRC.write_text(src)
    print(f"applied {SRC}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
