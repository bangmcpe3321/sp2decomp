#!/usr/bin/env python3
"""Harden TextureMemoryAllocator::dumpDetail() against a null link.

`agl::utl::TextureMemoryAllocator::dumpDetail()` (guest 0xF2C2F0) is a read-only
debug walk of the allocator's block lists (it makes no stores and calls nothing).
postDrawImpl calls DynamicTextureAllocator::dump() when the allocator's used size
changes, i.e. exactly while other render jobs can be mutating those lists.  On the
port's slower timing the walk can observe a transiently null `next` link and the
x86 translation dereferences address 8 (CRASH exception c0000005, data address 8,
host pc at guest 0xF2C2F0+...).

Because the function has no side effects, stopping the walk at a null link is
safe: the debug dump simply omits the rest of that list.  This is a port
hardening, not a functional change; the underlying guest race is untouched.

Idempotent.  Usage: wsl-patch-dumpdetail-guard.py [--check]
"""
import io
import sys

PATH = "gen/main/code_328.cpp"

LOOPS = [
    (
        "L_F2C330",
        "L_F2C344",
    ),
    (
        "L_F2C384",
        "L_F2C398",
    ),
]

GUARD = (
    "    if (c.x[11] == 0) goto {stop};"
    " // [sp2port] list was transiently corrupt; the debug walk is side-effect free\n"
)


def patch(text, loop_label, stop_label):
    head = loop_label + ":;\n"
    if head not in text:
        raise SystemExit("missing loop label " + loop_label)
    start = text.index(head)
    load = "c.x[11] = uint64_t(nx::ld<uint64_t>(a)); } // ldr x11, [x11, #8]\n"
    at = text.find(load, start)
    if at < 0 or at > start + 600:
        raise SystemExit("missing list load in " + loop_label)
    insert_at = at + len(load)
    already = text[insert_at:insert_at + len(GUARD.format(stop=stop_label))]
    if "[sp2port] list was transiently corrupt" in already:
        return text, False
    return text[:insert_at] + GUARD.format(stop=stop_label) + text[insert_at:], True


def main():
    check = "--check" in sys.argv[1:]
    text = io.open(PATH, encoding="utf-8", newline="").read()
    changed = 0
    for loop_label, stop_label in LOOPS:
        text, did = patch(text, loop_label, stop_label)
        changed += int(did)
    if check:
        print("dumpDetail null-link guard: %s" % ("present" if changed == 0 else "MISSING (%d)" % changed))
        return 0 if changed == 0 else 1
    if changed:
        io.open(PATH, "w", encoding="utf-8", newline="").write(text)
    print("patched %d loop(s)" % changed if changed else "already patched")
    return 0


if __name__ == "__main__":
    sys.exit(main())
