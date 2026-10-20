#!/usr/bin/env python3
"""Log render-target handles that are not guest pointers (temporary diagnostic).

`nvnCommandBufferSetRenderTargets` records the colour texture pointers the game passes.  A pass in
the character-create transition hands over 0xfffffffffffffff8, which the replay later dereferences
as a copied-descriptor pointer.  This logs the first few such handles with the recording call site
(`lr`) so the game function that uses the sentinel is visible.

runtime/src/nvn/nvn_cmd.cpp; idempotent (--restore).

Usage: python3 patch-rt-bad-target-log.py [--restore]   (SP2PORT override)
"""

import os
import sys

ROOT = os.environ.get("SP2PORT", "/home/hexa/sp2port")
F = os.path.join(ROOT, "runtime/src/nvn/nvn_cmd.cpp")

MARK = "// PATCH-RT-BAD-TARGET"
ANCHOR = "    for (uint32_t k = 0; k < n && c.x[2]; k++) cmd.a[k] = ld<uint64_t>(c.x[2] + 8 * k);\n"

BLOCK = (
    "    // PATCH-RT-BAD-TARGET-BEGIN: a colour target outside the guest address space (seen: -8).\n"
    "    for (uint32_t k = 0; k < n && c.x[2]; k++) {\n"
    "        uint64_t tp = ld<uint64_t>(c.x[2] + 8 * k);\n"
    "        if (tp < 0x100000000ull || tp >= 0x8000000000ull) {\n"
    "            static int bad_n = 0;\n"
    "            if (bad_n++ < 8)\n"
    "                log(\"nvn: RT color[%u] out-of-range %llx (n=%u) lr %s\", k, (unsigned long long)tp, n,\n"
    "                    describe(c.x[30]).c_str());\n"
    "        }\n"
    "    }\n"
    "    // PATCH-RT-BAD-TARGET-END\n"
)


def main():
    t = open(F, encoding="utf-8", errors="replace", newline="").read()
    if "--restore" in sys.argv:
        if MARK not in t:
            print("nothing to restore")
            return
        lines = t.splitlines(keepends=True)
        out, i = [], 0
        while i < len(lines):
            if "PATCH-RT-BAD-TARGET-BEGIN" in lines[i]:
                j = i
                while j < len(lines) and "PATCH-RT-BAD-TARGET-END" not in lines[j]:
                    j += 1
                i = j + 1
                continue
            out.append(lines[i])
            i += 1
        open(F, "w", encoding="utf-8", newline="").write("".join(out))
        print("restored")
        return
    if MARK in t:
        print("already applied")
        return
    if t.count(ANCHOR) != 1:
        raise SystemExit("anchor count %d (want 1)" % t.count(ANCHOR))
    t = t.replace(ANCHOR, BLOCK + ANCHOR, 1)
    open(F, "w", encoding="utf-8", newline="").write(t)
    print("patched", F)


if __name__ == "__main__":
    main()
