#!/usr/bin/env python3
"""Fix a dropped tail call in the generated translation of `main`.

`Cui::Page::findPartsControl` (0x20BD74) is three instructions:

    ldr x8, [x0, #0x3f0]      ; control list of the page
    add x0, x8, #0x38
    b   0x20cf60              ; tail call: Control::List::searchAs<PartsCtrl>

The recompiler emitted the first two and dropped the `b`, so the function returned
`page->controls + 0x38` (a list pointer) to callers that expect a `PartsCtrl*`.
`Cui::CustomizePartsSet::onInitialize` then called `(*ctrl)[0]` through that pointer and
died at boot with `FATAL: call to 50c12201b8, lr main+1d95d4`. The heap address made it
look like a vtable/ABI problem and made the crash depend on heap layout (earlier builds
silently got a null control back instead).

`tools/rework/find-dropped-tailcalls.py` scans every generated function of every module
for this shape (final guest instruction is an unconditional `b` to another function and
the generated body has no call to it) and finds this as the only case in the game.

Usage: python3 tools/patches/patch-tailcall-20bd74.py [--restore]   (SP2PORT override)
"""
import os
import sys

ROOT = os.environ.get("SP2PORT", "/home/hexa/sp2port")
F = os.path.join(ROOT, "gen/main/code_044.cpp")

OLD = """void main_0020BD74(nx::CPU& NX_RESTRICT c) {
    { uint64_t a = c.x[0] + 0x3f0ull; c.x[8] = uint64_t(nx::ld<uint64_t>(a)); } // ldr x8, [x0, #0x3f0]
    c.x[0] = uint64_t(uint64_t(c.x[8]) + uint64_t(0x38ull)); // add x0, x8, #0x38
}"""
NEW = """void main_0020BD74(nx::CPU& NX_RESTRICT c) {
    { uint64_t a = c.x[0] + 0x3f0ull; c.x[8] = uint64_t(nx::ld<uint64_t>(a)); } // ldr x8, [x0, #0x3f0]
    c.x[0] = uint64_t(uint64_t(c.x[8]) + uint64_t(0x38ull)); // add x0, x8, #0x38
    { main_0020CF60(c); return; } // b #0x20cf60  (TAILCALL_FIX: dropped by the transpiler)
}"""


def main():
    t = open(F, encoding="utf-8", errors="replace", newline="").read()
    if "--restore" in sys.argv:
        if NEW not in t:
            print("nothing to restore")
            return
        open(F, "w", encoding="utf-8", newline="").write(t.replace(NEW, OLD, 1))
        print("restored")
        return
    if "TAILCALL_FIX" in t:
        print("already patched")
        return
    if t.count(OLD) != 1:
        sys.exit("anchor found %d times" % t.count(OLD))
    open(F, "w", encoding="utf-8", newline="").write(t.replace(OLD, NEW, 1))
    print("patched", F)


main()
