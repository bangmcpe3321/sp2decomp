#!/usr/bin/env python3
"""Temporary diagnostic: NEWSENDTRC.

Logs
  - Cmn::SceneBgm::searchAndPlayBgm_ (main_00162760) result + handle id match,
  - every write to SceneBgmPlaza +0x3f0 (state numbers),
  - isNewsEndingFinished inputs.
"""
import os
import sys

ROOT = os.environ.get("SP2PORT", "/home/hexa/sp2port")
MARK = "NEWSENDTRC"

F30 = os.path.join(ROOT, "gen/main/code_030.cpp")
F213 = os.path.join(ROOT, "gen/main/code_213.cpp")


def patch(path, anchor, block, tag):
    s = open(path, encoding="utf-8", errors="surrogateescape").read()
    if ("// %s %s" % (MARK, tag)) in s:
        return s
    assert anchor in s, (path, anchor)
    s = s.replace(anchor, anchor + block, 1)
    open(path, "w", encoding="utf-8", errors="surrogateescape").write(s)
    return s


search_block = """    { // %s search
        uint64_t self_ = c.x[0], prm_ = c.x[1];
        uint32_t r_ = uint32_t(c.x[0]);
        uint64_t h_ = (self_ != 0) ? nx::ld<uint64_t>(self_ + 0x350) : 0;
        uint32_t id_ = h_ ? nx::ld<uint32_t>(h_ + 0x20) : 0;
        uint32_t sv_ = (self_ != 0) ? nx::ld<uint32_t>(self_ + 0x358) : 0;
        nx::log("NEWSENDTRC search ret=%u self=%%llx h350=%%llx id=%%u saved=%%u name=%%s",
                r_, (unsigned long long)self_, (unsigned long long)h_, id_, sv_,
                prm_ ? (const char*)nx::ld<uint64_t>(prm_ + 8) : "(null)");
    } // %s search
""" % (MARK, MARK)

F30_ANCHOR = "void main_00162760(nx::CPU& NX_RESTRICT c) {\n"
patch(F30, F30_ANCHOR, search_block, "search")

# log +0x3f0 writes inside SceneBgmPlaza functions
s = open(F213, encoding="utf-8", errors="surrogateescape").read()
if ("// %s f3f0" % MARK) not in s:
    lines = s.split("\n")
    out = []
    for i, l in enumerate(lines):
        out.append(l)
        if ("+ 0x3f0ull; nx::st<uint32_t>" in l) and ("NX_RESTRICT c" not in l):
            indent = l[: len(l) - len(l.lstrip())]
            out.append(
                indent
                + '{ nx::log("NEWSENDTRC f3f0 <- %u self=%llx", uint32_t(c.x[8]), '
                '(unsigned long long)c.x[19]); } // %s f3f0' % MARK
            )
    s = "\n".join(out)
    open(F213, "w", encoding="utf-8", errors="surrogateescape").write(s)
print("applied")
