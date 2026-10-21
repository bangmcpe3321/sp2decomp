#!/usr/bin/env python3
"""fs: make CommitSaveData flush the game's open save file to disk.

The game keeps the save file open through its file device and calls nvn/fs CommitSaveData when the
save is complete.  The HLE was a no-op, so the writes stayed in the C library buffer and a killed
process lost them: PlayerMake ran again on every boot and the next tutorial run had to start from
the splash.  Commit now fflushes every open file (the save is small; the cost is one call per save).

runtime/src/hle_fs.cpp; idempotent (--restore).

Usage: python3 tools/patches/patch-fs-commit.py [--restore]   (SP2PORT override)
"""
import os
import sys

ROOT = os.environ.get("SP2PORT", "/home/hexa/sp2port")
F = os.path.join(ROOT, "runtime/src/hle_fs.cpp")

OLD = "void Commit(CPU& c) { c.x[0] = kOk; }\n"
NEW = """void Commit(CPU& c) {  // commitSaveData: the game keeps the save file open, so flush its buffered writes to disk
    std::lock_guard lk(g_fs);
    for (auto& [handle, f] : g_files)
        if (f) std::fflush(f->f);
    c.x[0] = kOk;
}
"""


def main():
    t = open(F, encoding="utf-8", newline="").read()
    if "--restore" in sys.argv:
        if NEW not in t:
            print("no patch to restore")
            return
        t = t.replace(NEW, OLD, 1)
        open(F, "w", encoding="utf-8", newline="").write(t)
        print("restored", os.path.basename(F))
        return
    if "commitSaveData: the game keeps the save file open" in t:
        print("already patched")
        return
    if OLD not in t:
        sys.exit("pattern not found")
    t = t.replace(OLD, NEW, 1)
    open(F, "w", encoding="utf-8", newline="").write(t)
    print("patched", os.path.basename(F), "CommitSaveData")


main()
