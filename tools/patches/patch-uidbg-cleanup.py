#!/usr/bin/env python3
"""Strip the temporary UIDBG instrumentation that was hand-added to gen/main/code_398.cpp.

The blocks logged the key-item context (UIDBG setup / keyItem / trig) while the port was chasing
the input/mask behaviour; they are not part of the game and they flood the log (3000 keyItem lines
before the 13:35 run hung).  Diagnostics are removed before production runs.

Idempotent: removes every `{ // UIDBG (temporary)` ... `} // UIDBG (temporary)` block.

Usage: python3 patch-uidbg-cleanup.py [--check]   (SP2PORT override)
"""

import os
import sys

ROOT = os.environ.get("SP2PORT", "/home/hexa/sp2port")
F = os.path.join(ROOT, "gen/main/code_398.cpp")

BEGIN = "{ // UIDBG (temporary)"
END = "} // UIDBG (temporary)"


def main():
    t = open(F, encoding="utf-8", errors="replace", newline="").read()
    lines = t.splitlines(keepends=True)
    n_blocks = sum(1 for line in lines if BEGIN in line)
    if "--check" in sys.argv:
        print("UIDBG blocks:", n_blocks)
        return
    if n_blocks == 0:
        print("nothing to remove")
        return
    out, i = [], 0
    while i < len(lines):
        if BEGIN in lines[i]:
            j = i
            while j < len(lines) and END not in lines[j]:
                j += 1
            if j >= len(lines):
                raise SystemExit("unterminated UIDBG block at line %d" % (i + 1))
            i = j + 1
            continue
        out.append(lines[i])
        i += 1
    open(F, "w", encoding="utf-8", newline="").write("".join(out))
    print("removed %d UIDBG block(s) from %s" % (n_blocks, F))


if __name__ == "__main__":
    main()
