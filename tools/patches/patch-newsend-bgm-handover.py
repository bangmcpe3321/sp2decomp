#!/usr/bin/env python3
"""HLE switch for the news-ending BGM handover in Game::SceneBgmPlaza.

What the game does
------------------
The Off the Hook news ends with SceneBgmPlaza::requestNewsEnding (main_009DF890):
it crossfades the plaza BGM, reserves region 22 on the BgmExeRegionCallbackable
with delay = count/60 s (149 frames for the news), and sets +0x410 = 1.

SignaturePose then polls SceneBgmPlaza::isNewsEndingFinished (main_009DF970):
  +0x410 == 0 -> 0 (no ending requested)
  +0x350 == 0 -> 1
  else -> [*+0x350 + 0x20] != [+0x358]   (a *different* BGM id is playing)

The handover lives in xlinkCalc_ (main_009DFA04) and runs from the xlink event
callbacks of the XlinkSystem.  When the reserved region resolves, the path at
0x9dfac0 waits one elapsed tick (xlink +0xd48 -> 0xc8) and then runs

    main_009DF0B4   SceneBgmPlaza::exitState_
    main_009DF154   SceneBgmPlaza::onEnterProgress_   (searchAndPlayBgm_
                    "BGM_SpeakerMain", new handle -> +0x350/+0x358)
    +0x3f0 = 2      BGM state: progress

That new handle id is what isNewsEndingFinished waits for.  +0x410 is
deliberately *not* cleared: the predicate needs it to stay 1.

Why the port needs a switch
---------------------------
Every step above is event-driven through the xlink audio callbacks.  The port's
audio HLE stubs the stream player, so those callbacks never arrive and the
handover never runs: +0x350 keeps pointing at the old news handle, and the news
pose state machine stays in mode 1 forever (count keeps climbing, SeqPlazaNews
never reaches cPostNews, and SeqMgrPlaza never leaves cNews).

The guest source is generated 1:1 from the binary and must not be rewritten, so
the only edits are calls into runtime hooks gated by runtime state:

    requestNewsEnding()     -> hle_audio_news_bgm_arm(this, count)
    BgmConductor::xlinkCalc -> hle_audio_news_bgm_owner() + hle_audio_news_bgm_take():
                               run the same three steps the branch at 0x9dfac0
                               runs, then retire
    xlinkCalc_()            -> hle_audio_news_bgm_elapsed(): advances the reserved
                               delay on every frame of the plaza scene (it runs
                               even while the plaza BGM object has no xlink
                               conductor yet, so it is the per-frame tick)
    isNewsEndingFinished()  -> while the handover is pending, report the old
                               handle as finished (same answer the resolved
                               region would give after the new handle exists)

The handover cannot run from the plaza's own xlinkCalc_: it is only reached
through Cmn::SceneBgm::xlinkCalc (main_0016249C), which forwards to the xlink
conductor at +0x360, and that pointer is null until the first BGM handle
arrives.  Cmn::BgmConductor::xlinkCalc (main_0014232C) always runs and is what
processes the handle list, so the handover hangs off it instead.

The hooks answer only while the audio HLE reports a stubbed stream player
(nx::hle_audio_news_bgm_available()); once a real backend delivers BGM play
events they go inert and the game's own xlink path runs unchanged.

Idempotent; use --restore.

Usage: python3 patch-newsend-bgm-handover.py [--restore|--check]   (SP2PORT override)
"""
import argparse
import os
import sys

ROOT = os.environ.get("SP2PORT", "/home/hexa/sp2port")
F = os.path.join(ROOT, "gen/main/code_213.cpp")
F2 = os.path.join(ROOT, "gen/main/code_027.cpp")
MARK = "NEWSEND-BGM"

# main_009DF890 requestNewsEnding(int count)
REQ_OLD = "void main_009DF890(nx::CPU& NX_RESTRICT c) {\n"
REQ_NEW = REQ_OLD + """    { // %(m)s arm
        // HLE: remember this news ending and start its reserved delay here, so
        // the handover does not depend on the xlink region callback.
        nx::hle_audio_news_bgm_arm(c.x[0], int32_t(uint32_t(c.x[1])));
    } // %(m)s arm
""" % {"m": MARK}

# main_009DFA04 xlinkCalc_
XCALC_OLD = "void main_009DFA04(nx::CPU& NX_RESTRICT c) {\n"
XCALC_NEW = XCALC_OLD + """    { // %(m)s tick
        // HLE: advance the reserved news-ending delay once per frame.  This
        // runs from the BGM actor's calc even while the scene has no xlink
        // conductor yet, so the handover below is not deferred by the tick.
        if (nx::hle_audio_news_bgm_available()) {
            nx::hle_audio_news_bgm_elapsed(c.x[0]);
        }
    } // %(m)s tick
""" % {"m": MARK}

# main_0014232C Cmn::BgmConductor::xlinkCalc
COND_OLD = "void main_0014232C(nx::CPU& NX_RESTRICT c) {\n"
COND_NEW = COND_OLD + """    { // %(m)s handover
        // HLE: the branch at 0x9dfac0 waits one elapsed tick after the reserved
        // region resolves, then runs exitState_ + onEnterProgress_ and sets the
        // BGM state to progress.  Run exactly that, once, when the delay is over.
        // Inert without stubbed audio (then the xlink path does it).
        if (nx::hle_audio_news_bgm_available()) {
            uint64_t plaza_ = nx::hle_audio_news_bgm_owner();
            if (plaza_ != 0 && nx::ld<uint8_t>(plaza_ + 0x410ull) != 0 &&
                nx::hle_audio_news_bgm_take(plaza_)) {
                uint64_t saved_ = c.x[0];
                c.x[0] = plaza_;
                main_009DF0B4(c);
                c.x[0] = plaza_;
                main_009DF154(c);
                nx::st<uint32_t>(plaza_ + 0x3f0ull, uint32_t(0x2u));
                c.x[0] = saved_;
                nx::log("%(m)s handover self=%%llx", (unsigned long long)plaza_);
            }
        }
    } // %(m)s handover
""" % {"m": MARK}

# main_009DF970 isNewsEndingFinished
FINISH_OLD = "void main_009DF970(nx::CPU& NX_RESTRICT c) {\n"
FINISH_NEW = FINISH_OLD + """    { // %(m)s finish
        // HLE: while the news ending is still waiting for the xlink handover,
        // the old news handle must count as finished, which is what the
        // resolved region reports once the new handle exists.
        if (nx::hle_audio_news_bgm_available() && c.x[0] != 0 &&
            nx::ld<uint8_t>(c.x[0] + 0x410ull) != 0 &&
            nx::hle_audio_news_bgm_pending(c.x[0])) {
            c.x[0] = 1ull;
            return;
        }
    } // %(m)s finish
""" % {"m": MARK}


def load(path=F):
    with open(path, encoding="utf-8", errors="surrogateescape") as f:
        return f.read()


def save(s, path=F):
    with open(path, "w", encoding="utf-8", errors="surrogateescape") as f:
        f.write(s)


def strip(text):
    out, skipping = [], False
    for line in text.split("\n"):
        if line.startswith("    { // " + MARK):
            skipping = True
            continue
        if skipping:
            if line.startswith("    } // " + MARK):
                skipping = False
            continue
        out.append(line)
    return "\n".join(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--restore", action="store_true")
    ap.add_argument("--check", action="store_true")
    a = ap.parse_args()
    text = load(F)
    text2 = load(F2)
    applied = ("    { // " + MARK) in text
    applied2 = ("    { // " + MARK) in text2
    if a.check:
        print("applied" if applied and applied2 else "not applied")
        return 0
    if a.restore:
        if applied or applied2:
            if applied:
                save(strip(text), F)
            if applied2:
                save(strip(text2), F2)
            print("restored", F, F2)
        else:
            print("nothing to restore")
        return 0
    if applied or applied2:
        print("already applied")
        return 0
    for anchor in (REQ_OLD, XCALC_OLD, FINISH_OLD):
        if anchor not in text:
            print("ERROR: anchor not found: %r" % anchor, file=sys.stderr)
            return 1
    if COND_OLD not in text2:
        print("ERROR: anchor not found in %s: %r" % (F2, COND_OLD), file=sys.stderr)
        return 1
    text = text.replace(REQ_OLD, REQ_NEW, 1)
    text = text.replace(XCALC_OLD, XCALC_NEW, 1)
    text = text.replace(FINISH_OLD, FINISH_NEW, 1)
    text2 = text2.replace(COND_OLD, COND_NEW, 1)
    save(text, F)
    save(text2, F2)
    print("applied", F, F2)
    return 0


if __name__ == "__main__":
    sys.exit(main())
