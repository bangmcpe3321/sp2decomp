#!/usr/bin/env python3
"""Find tail calls the recompiler dropped.

For every function of every module, take the last real instruction before the next
function start (skipping `nop`/`udf` padding). If it is an unconditional `b` to a target
outside the function and the generated body never calls that target, the recompiler lost
a `b <other function>; ret` pair.

This found exactly one case in Splatoon 2 (all modules):
`main_0020BD74` (`Cui::Page::findPartsControl`) must tail-call `0x20CF60`
(`Control::List::searchAs<PartsCtrl>`); without it the function returns a list pointer as
if it were a control, which was the boot fatal in `Cui::CustomizePartsSet::onInitialize`.
Fix: tools/patches/patch-tailcall-20bd74.py.

Usage: python3 tools/rework/find-dropped-tailcalls.py [--write-list FILE]  (SP2PORT override)
"""
import glob
import os
import re
import struct
import sys

ROOT = os.environ.get("SP2PORT", "/home/hexa/sp2port")
PREFIX = ("main", "sdk", "subsdk0", "subsdk1", "subsdk2", "subsdk3")


def func_starts(mod):
    txt = open(f"{ROOT}/gen/{mod}/table.cpp", encoding="utf-8", errors="replace").read()
    return sorted({int(m.group(1), 16) for m in re.finditer(r"\{0x([0-9a-fA-F]+), (?:main|sdk|subsdk\d)_[0-9A-F]+\}", txt)})


def body_map(mod):
    out = {}
    for path in glob.glob(f"{ROOT}/gen/{mod}/code_*.cpp"):
        txt = open(path, encoding="utf-8", errors="replace").read()
        for m in re.finditer(r"void (?:(?:main|sdk|subsdk\d)_([0-9A-F]+))\(nx::CPU& NX_RESTRICT c\) \{\n(.*?)\n\}\n", txt, re.S):
            out[int(m.group(1), 16)] = m.group(2)
    return out


def last_instr(code, lo, hi):
    pos = hi - 4
    while pos > lo:
        w = struct.unpack_from("<I", code, pos)[0]
        if w not in (0x00000000, 0xD503201F):  # udf / nop padding
            return pos, w
        pos -= 4
    return None, None


def dropped_in(mod):
    starts = func_starts(mod)
    code = open(f"{ROOT}/private/analysis/{mod}.bin", "rb").read()
    bodies = body_map(mod)
    nxt = {starts[i]: starts[i + 1] for i in range(len(starts) - 1)}
    out = []
    ends = 0
    for s in starts:
        n = nxt.get(s)
        if n is None or s >= len(code) or n > len(code) or n - s < 8 or s not in bodies:
            continue
        pos, w = last_instr(code, s, n)
        if pos is None or (w & 0xFC000000) != 0x14000000:
            continue
        ends += 1
        imm = w & 0x03FFFFFF
        if imm & 0x02000000:
            imm -= 0x04000000
        t = pos + imm * 4
        if s <= t < n:
            continue  # branch inside the function: emitted as a goto
        if re.search(r"(?:main|sdk|subsdk\d)_%08X\(c\)" % t, bodies[s]):
            continue
        out.append((s, pos, t))
    return ends, out


def main():
    bad = 0
    for mod in PREFIX:
        if not os.path.isdir(f"{ROOT}/gen/{mod}"):
            continue
        ends, out = dropped_in(mod)
        bad += len(out)
        print(f"{mod}: functions ending in b {ends}, dropped {len(out)}")
        for s, pos, t in out[:20]:
            print(f"   {s:06X} .. b at {pos:06X} -> {t:06X}")
    if "--write-list" in sys.argv:
        path = sys.argv[sys.argv.index("--write-list") + 1]
        with open(path, "w") as f:
            for mod in PREFIX:
                if not os.path.isdir(f"{ROOT}/gen/{mod}"):
                    continue
                for s, pos, t in dropped_in(mod)[1]:
                    f.write(f"{mod} {s:06X} {t:06X}\n")
        print("wrote", path)
    print("total dropped:", bad)


main()
