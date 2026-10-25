#!/usr/bin/env python3
"""The 9 `(temporary)` markers that patch-remove-debug-hooks.py reports instead of cutting.

Each one is a line (or a pair of lines) that the stripper deliberately leaves, because it may sit on a
declaration the surrounding code still uses.  This removes them by exact text, so the production strip is
complete: the stripper runs first, then this.

Usage: python3 tools/patches/patch-drop-stray-markers.py [--check]   (SP2PORT override)
Idempotent: a clean tree does nothing.  `--restore` puts each removed block back where it was (it has to be
applied before the stripper for the blocks the stripper owns: this only restores its own lines).
"""
import os
import sys

ROOT = os.environ.get("SP2PORT", "/home/hexa/sp2port")
GEN = os.path.join(ROOT, "gen/main")

EDITS = {
    "code_027.cpp": [
        "    nx::hle_audio_news_bgm_set_slink(c.x[0] - 0x20ull);  // NEWSPROBE (temporary)\n",
        "    uint64_t nprm_ = c.x[1];                       // NEWSPROBE (temporary)\n"
        "    int32_t ncur_ = nprm_ ? int32_t(nx::ld<uint32_t>(nprm_)) : -1;\n",
        "    nx::log(\"NEWSPROBE regionCb self=%llx cur=%d->%d rsv=%d nxt=%d flag=%u dly=%08x\",\n"
        "            (unsigned long long)c.x[20], ncur_, int32_t(uint32_t(c.x[25])),\n"
        "            int32_t(nx::ld<uint32_t>(c.x[20] + 0x1d4)), int32_t(nx::ld<uint32_t>(c.x[20] + 0x1dc)),\n"
        "            (unsigned)nx::ld<uint8_t>(c.x[20] + 0x1e0), nx::ld<uint32_t>(c.x[20] + 0x1d0));"
        "  // NEWSPROBE (temporary)\n",
    ],
    "code_132.cpp": [
        "    // PATCH-SCENECHG (temporary): show the tutorial page sequence.  main_00620E54 returns\n"
        "    // [this+0x340]+0x10; log the old state and the requested state before the hooks run.\n"
        "    {\n"
        "        static int n = 0;\n"
        "        if (n < 400) {\n"
        "            n++;\n"
        "            uint64_t sm = c.x[0] ? nx::ld<uint64_t>(c.x[0] + 0x340) : 0;\n"
        "            uint32_t old = sm ? nx::ld<uint32_t>(sm + 0x10) : 0xffffffffu;\n"
        "            nx::log(\"SCENECHG %u -> %u this=%llx\", old, uint32_t(c.x[1]), (unsigned long long)c.x[0]);\n"
        "        }\n"
        "    }\n",
    ],
    "code_140.cpp": [
        "// GUIDEDBG (temporary): last info/ball seen by the guide collision check\n"
        "static uint64_t g_guide_info = 0, g_guide_ball = 0;\n",
        "            g_guide_info = info; g_guide_ball = b;  // GUIDEDBG (temporary)\n",
    ],
    "code_165.cpp": [
        "    const uint64_t dbg_lr = c.x[30];      // GUIDEDBG (temporary)\n"
        "    const uint64_t dbg_info = c.x[2];    // GUIDEDBG (temporary)\n",
    ],
    "code_215.cpp": [
        "    nx::log(\"WARPCHK t=%u req=%u\", (unsigned)nx::ld<uint32_t>(c.x[19] + 0x3dc),"
        " (unsigned)(uint32_t(c.x[0]) & 1)); // WARPCHK (temporary)\n",
        "    nx::log(\"WARPREQ t=%u\", (unsigned)nx::ld<uint32_t>(c.x[19] + 0x3dc)); // WARPREQ (temporary)\n",
    ],
}


def main():
    check = "--check" in sys.argv
    changed = 0
    missing = 0
    for name, blocks in EDITS.items():
        path = os.path.join(GEN, name)
        with open(path, encoding="utf-8", newline="") as f:
            text = f.read()
        new = text
        for block in blocks:
            if block in new:
                new = new.replace(block, "", 1)
            else:
                missing += 1
        if new != text:
            changed += 1
            print("%s %s" % ("would edit" if check else "edited", name))
            if not check:
                with open(path, "w", encoding="utf-8", newline="") as f:
                    f.write(new)
    print("%s %d file(s), %d block(s) already gone" % ("would edit" if check else "edited", changed, missing))


main()
