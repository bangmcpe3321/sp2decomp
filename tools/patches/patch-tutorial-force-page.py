#!/usr/bin/env python3
"""Temporary diagnostic: jump from the stuck Move page to the warp-to-plaza page.

The Move page (manager state 6, `main_00A00300`) never leaves mode 3 in the port, so the
left-stick prompt is drawn but the UI page step never runs and the game's own timeline
(`main_00A00BDC`, state 6 -> 8) is never reached.  This patch adds a counter to the Move
page; after a few hundred calls it calls `main_00620ED0(this, TUTORIAL_FORCE_STATE)` and
tail-calls out.  It is a diagnostic to probe the later tutorial pages, not a port fix.

State numbers are the ones used by `Lp::Utl::StateMachine` (also the state-name order in
the SeqMgrTutorial constructor), not the manager's vtable slot order:

  7 = State::cWarpToPlaza  (exec `main_00A004A4`, the plaza request)
  8 = State::cFinish_ShowFloor (name only: the constructor never installs its delegate
      functions, so forcing 8 freezes the state machine)
  9 = the tutorial restart page

The state machine's per-state timer is at `sm+0x14` (`this+0x3dc`): `changeState` stores
it as 0 (`stp w19, wzr, [x20, #0x10]`) and `executeState` adds one per frame.  Do NOT
preset it.  `stateWarpToPlaza` uses it on the normal timeline: at 60 it sets up the warp
camera and at 180 it requests the plaza scene.  Presetting 180 skipped the camera setup
and left the camera inside the player.

Apply:   SP2PORT=/home/hexa/sp2port python3 patch-tutorial-force-page.py
Options: TUTORIAL_FORCE_STATE=7 (default), TUTORIAL_FORCE_AFTER=600 (default)
Restore: SP2PORT=/home/hexa/sp2port python3 patch-tutorial-force-page.py --restore
"""
import os
import sys
from pathlib import Path

ROOT = Path(os.environ.get("SP2PORT", "/home/hexa/sp2port"))
SRC = ROOT / "gen/main/code_215.cpp"
STATE = int(os.environ.get("TUTORIAL_FORCE_STATE", "7"))
AFTER = int(os.environ.get("TUTORIAL_FORCE_AFTER", "600"))

ANCHOR = "    } // PATCH-TUTORIAL-SKIP-MOVE (temporary)\n"
BEGIN = "    { // PATCH-TUTORIAL-FORCE-PAGE (temporary)"
END = "    } // PATCH-TUTORIAL-FORCE-PAGE (temporary)\n"

BLOCK = f"""{BEGIN}
      // The Move page UI never leaves mode 3; enter state {STATE} directly so the later
      // tutorial pages can be tested.  This is not the missing UI step.
        static int force_n = 0;
        if (++force_n == {AFTER}) {{
            nx::log("TUTSKIP move force state {STATE} after %d frames", force_n);
            uint64_t force_this = c.x[19];
            c.x[0] = force_this;
            c.x[1] = {STATE};
            c.x[30] = NXB + 0xa00300ull;
            main_00620ED0(c);
            // changeState reset the state timer (sm+0x14 == this+0x3dc) to 0; executeState
            // advances it.  stateWarpToPlaza uses 60 (camera setup) and 180 (plaza request).
            nx::log("TUTSKIP move force state {STATE}: timer %u",
                    (unsigned)nx::ld<uint32_t>(force_this + 0x3dc));
            goto L_A00384;
        }}
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
    print(f"applied state {STATE} after {AFTER} Move-page frames to {SRC}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
