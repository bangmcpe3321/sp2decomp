#!/usr/bin/env python3
"""Reject out-of-range texture pointers before the descriptor magic check.

A replayed render pass carried a colour target of 0xfffffffffffffff8, so `image_of(-8)` fell through
to `texture_descriptor_ref(-8)`, which dereferenced it (data address -8) and killed the replay worker
(Splatoon 2, character-create -> scene transition, 13:24 and 13:59 runs).

Guest pointers live in [4 GB, 512 GB): heap 0x50..., stacks 0x6..., modules 0x71...  Anything outside
that range cannot be a copied NVNtexture descriptor.  Returning 0 makes the pass run without that
attachment, exactly as a missing texture already does.  The first few rejects are logged so a run
shows whether the sentinel is constant.

runtime/src/nvn/nvn_objects.cpp; idempotent (--restore).

Usage: python3 patch-nvn-image-of-guard.py [--restore]   (SP2PORT override)
"""

import os
import sys

ROOT = os.environ.get("SP2PORT", "/home/hexa/sp2port")
F = os.path.join(ROOT, "runtime/src/nvn/nvn_objects.cpp")

OLD = "uint64_t texture_descriptor_ref(uint64_t guest) {\n    if (!guest || ld<uint64_t>(guest) != kTextureDescriptorMagic) return 0;\n"

OLD2 = (
    "uint64_t texture_descriptor_ref(uint64_t guest) {\n"
    "    // PATCH-IMAGE-OF-GUARD: guest pointers live above 4 GB (heap 0x50..., stacks 0x6..., modules 0x71...); a\n"
    "    // colour target of -8 from a replayed pass used to be dereferenced here (data address -8).\n"
    "    if (guest < 0x100000000ull || ld<uint64_t>(guest) != kTextureDescriptorMagic) return 0;\n"
)

NEW = (
    "uint64_t texture_descriptor_ref(uint64_t guest) {\n"
    "    // PATCH-IMAGE-OF-GUARD: guest pointers live in [4 GB, 512 GB): heap 0x50..., stacks 0x6..., modules\n"
    "    // 0x71...  A replayed pass carried a colour target of 0xfffffffffffffff8, which used to be\n"
    "    // dereferenced here (data address -8).  Anything outside that range is not a descriptor copy.\n"
    "    if (guest < 0x100000000ull || guest >= 0x8000000000ull) {\n"
    "        static int n = 0;\n"
    "        if (n++ < 8) log(\"nvn: texture_descriptor_ref(%llx): not a guest pointer\", (unsigned long long)guest);\n"
    "        return 0;\n"
    "    }\n"
    "    if (ld<uint64_t>(guest) != kTextureDescriptorMagic) return 0;\n"
)


def main():
    t = open(F, encoding="utf-8", errors="replace", newline="").read()
    if "--restore" in sys.argv:
        if NEW in t:
            t = t.replace(NEW, OLD, 1)
        elif OLD2 in t:
            t = t.replace(OLD2, OLD, 1)
        else:
            print("nothing to restore")
            return
        open(F, "w", encoding="utf-8", newline="").write(t)
        print("restored")
        return
    if NEW in t:
        print("already applied")
        return
    if OLD2 in t:
        t = t.replace(OLD2, NEW, 1)
    elif OLD in t:
        t = t.replace(OLD, NEW, 1)
    else:
        raise SystemExit("pattern not found: " + F)
    open(F, "w", encoding="utf-8", newline="").write(t)
    print("patched", F)


if __name__ == "__main__":
    main()
