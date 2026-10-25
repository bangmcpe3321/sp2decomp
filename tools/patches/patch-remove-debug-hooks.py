#!/usr/bin/env python3
"""Remove the ad-hoc (temporary) guest diagnostics before a production build.

During the tutorial and encourager investigations a number of debug hooks were pasted straight
into the generated guest code.  Each is wrapped in a pair of markers, in one of these shapes:

    { // CTRLDBG (temporary)
    ...
    } // CTRLDBG (temporary)          (or a bare `}` where the closer was not marked)

    #include <nx/runtime.h>  // CTRLDBG (temporary)

and the tag may contain spaces, '>' or a trailing description, e.g. `// NEWSDBG pose (temporary)`
or `// PATCH-CUIINPUT (temporary): non-zero pad words the CUI parts code reads.`  The hooks are
useful while debugging but they log on every input change and are not part of the port.

This removes every braced block that a marker opens and the same tag closes (or, when the file has
no such closer, the next bare `}` at the same depth), then drops the marker from an
`#include <nx/runtime.h>` line (the include stays if the file still calls nx::).  Single-line and
comment-only markers are NOT touched: they can sit on a declaration the surrounding code uses, so
they are reported with file:line for a hand edit.

gen/main/code_*.cpp; writes only the files that changed.  Idempotent: a clean tree does nothing.

Usage: python3 tools/patches/patch-remove-debug-hooks.py [--check]   (SP2PORT override)
"""
import glob
import os
import re
import sys

ROOT = os.environ.get("SP2PORT", "/home/hexa/sp2port")
GEN = os.path.join(ROOT, "gen/main")

MARK = re.compile(r"//[ \t]*(?P<tag>[^\n]+?)[ \t]*\(temporary\)")
OPEN = re.compile(r"^(?P<indent>[ \t]*)\{[ \t]*//[ \t]*(?P<tag>[^\n]+?)[ \t]*\(temporary\)[^\n]*$")
CLOSE = re.compile(r"^[ \t]*\}[ \t]*//[ \t]*(?P<tag>[^\n]+?)[ \t]*\(temporary\)[^\n]*$")
BARE = re.compile(r"^[ \t]*\}[ \t]*$")
INCLUDE = re.compile(r"^(?P<lead>[ \t]*#include <nx/runtime\.h>)[ \t]*//[ \t]*(?P<tag>[^\n]+?)[ \t]*\(temporary\)[^\n]*$")


def strip_blocks(lines):
    """Remove every `{ // TAG (temporary)` block, innermost first."""
    removed = 0
    i = 0
    while i < len(lines):
        m = OPEN.match(lines[i].rstrip("\r\n"))
        if not m:
            i += 1
            continue
        tag = m.group("tag")
        has_marked_close = any((c := CLOSE.match(l.rstrip("\r\n"))) and c.group("tag") == tag for l in lines[i + 1:])
        depth = 1
        j = i + 1
        end = -1
        while j < len(lines):
            cur = lines[j].rstrip("\r\n")
            c = CLOSE.match(cur)
            if c and c.group("tag") == tag and depth == 1:
                end = j
                break
            if not has_marked_close and depth == 1 and BARE.match(cur):
                end = j
                break
            depth += cur.count("{") - cur.count("}")
            if depth <= 0:  # unbalanced: the marker does not wrap this block, leave it alone
                break
            j += 1
        if end < 0:
            i += 1
            continue
        del lines[i:end + 1]
        removed += 1
    return removed


def main():
    check = "--check" in sys.argv
    changed = 0
    removed = 0
    leftover = []
    for path in sorted(glob.glob(os.path.join(GEN, "code_*.cpp"))):
        with open(path, encoding="utf-8", newline="") as f:
            text = f.read()
        lines = text.splitlines(keepends=True)
        n = strip_blocks(lines)
        # Drop the marker comment from an include line; the include itself stays while nx:: is used.
        for k, line in enumerate(lines):
            mi = INCLUDE.match(line.rstrip("\r\n"))
            if not mi:
                continue
            rest = "".join(l for idx, l in enumerate(lines) if idx != k)
            lines[k] = ("%s\n" % mi.group("lead")) if "nx::" in rest else ""
        new = "".join(lines)
        for k, line in enumerate(new.splitlines(), 1):
            if MARK.search(line):
                leftover.append((path, k, line.strip()[:110]))
        if n or new != text:
            changed += 1
            removed += n
            if not check:
                with open(path, "w", encoding="utf-8", newline="") as f:
                    f.write(new)
    print(("would clean" if check else "cleaned"), changed, "file(s),", removed, "marked block(s)")
    if leftover:
        print("%d marker line(s) left for a hand edit:" % len(leftover))
        for path, k, line in leftover:
            print("  %s:%d  %s" % (os.path.basename(path), k, line))


main()
