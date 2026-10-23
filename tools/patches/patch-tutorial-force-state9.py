#!/usr/bin/env python3
"""Temporary diagnostic: jump from the stuck Move page to tutorial state 9.

The Move page (manager state 6, `main_00A00300`) never leaves mode 3 in the port, so the
left-stick prompt is drawn but the UI page step never runs and the game's own timeline
(`main_00A00BDC`, state 6 -> 8) is never reached.  This patch adds a counter to the Move
page; after 3,000 calls it calls `main_00620ED0(this, 9)` (the final page) and tail-calls
out.  It is a diagnostic to reach the tutorial end and the plaza, not a port fix.

Apply:   SP2PORT=/home/hexa/sp2port python3 patch-tutorial-force-state9.py
Restore: SP2PORT=/home/hexa/sp2port python3 patch-tutorial-force-state9.py --restore
"""
import os
import sys
from pathlib import Path

ROOT = Path(os.environ.get("SP2PORT", "/home/hexa/sp2port"))
SRC = ROOT / "gen/main/code_215.cpp"

ANCHOR = "    } // PATCH-TUTORIAL-SKIP-MOVE (temporary)\n"
BEGIN = "    { // PATCH-TUTORIAL-FORCE-STATE9 (temporary)"
END = "    } // PATCH-TUTORIAL-FORCE-STATE9 (temporary)\n"

BLOCK = BEGIN + """
      // The Move page UI never leaves mode 3; enter the final page directly so the tutorial
      // end/plaza can be tested.  This is not the missing UI step.
        static int force_n = 0;
        if (++force_n == 3000) {
            nx::log("TUTSKIP move force state 9 after %d frames", force_n);
            c.x[0] = c.x[19];
            c.x[1] = 9;
            c.x[30] = NXB + 0xa00300ull;
            main_00620ED0(c);
            goto L_A00384;
        }
    """ + END


def main() -> int:
    src = SRC.read_text()
    if "--restore" in sys.argv:
        start = src.find(BEGIN)
        if start < 0:
            print(f"not applied: {SRC}")
            return 0
        end = src.find(END, start)
        if end < 0:
            print(f"broken patch block: {SRC}")
            return 1
        src = src[:start] + src[end + len(END):]
        SRC.write_text(src)
        print(f"restored {SRC}")
        return 0
    if BEGIN in src:
        print(f"already applied: {SRC}")
        return 0
    if ANCHOR not in src:
        print(f"anchor not found: {SRC}")
        return 1
    src = src.replace(ANCHOR, ANCHOR + BLOCK, 1)
    SRC.write_text(src)
    print(f"applied {SRC}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
