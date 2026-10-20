#!/usr/bin/env python3
"""Neutralize the agl dynamic-texture allocator's diagnostic dump, and log why it fires.

`gsys::Layer::postDrawImpl` calls `DynamicTextureAllocator::dump()` whenever the allocator's
`getUseSize()` differs from the layer's recorded value, then walks the allocator's intrusive
lists with `dump_`.  Those lists are updated under the draw context's lock, but the dump takes
no lock of its own; with the port's threaded command replay the walk can meet a list mid-update
and never return.  The 13:35 run hung at frame 687: the render worker sat in
`DynamicTextureAllocator::dump_` -> `dump`'s list walker while the main thread waited in
`sead::WorkerMgr::sync()`.

The dump only prints allocator state, so returning at once is safe.  The postDraw call site in
`gsys::Layer::postDrawImpl` gets a one-time log of both sizes (first 8 mismatches) so the
mismatch itself stays visible.

gen/main/code_324.cpp (dump()) and gen/main/code_335.cpp (postDrawImpl); idempotent (--restore).

Usage: python3 patch-skip-dyntex-dump.py [--restore]   (SP2PORT override)
"""

import os
import sys

ROOT = os.environ.get("SP2PORT", "/home/hexa/sp2port")

F_DUMP = os.path.join(ROOT, "gen/main/code_324.cpp")
DUMP_SIG = "void main_00F070C8(nx::CPU& NX_RESTRICT c) {"
DUMP_MARK = "// PATCH-SKIP-DYNTEX-DUMP"
DUMP_NEW_BODY = """void main_00F070C8(nx::CPU& NX_RESTRICT c) {
    // PATCH-SKIP-DYNTEX-DUMP: agl::utl::DynamicTextureAllocator::dump() only prints allocator state.
    // It walks the allocator's intrusive lists without their lock, and the port's threaded replay
    // can expose a list mid-update, spinning forever (main thread then stuck in WorkerMgr::sync()).
    (void)c;
    return;
}
"""

F_LAYER = os.path.join(ROOT, "gen/main/code_335.cpp")
LAYER_INCLUDE_OLD = "#include \"funcs.h\"\n"
LAYER_INCLUDE_NEW = "#include \"funcs.h\"\n#include <nx/runtime.h>  // PATCH-DYNTEX-SIZE-LOG (nx::log)\n"
LAYER_ANCHOR = (
    "    { uint64_t a = c.x[19] + 0xde8ull; c.x[8] = uint32_t(nx::ld<uint32_t>(a)); } "
    "// ldr w8, [x19, #0xde8]\n"
)
LAYER_MARK = "// PATCH-DYNTEX-SIZE-LOG-BEGIN"
LAYER_LOG = (
    "    // PATCH-DYNTEX-SIZE-LOG-BEGIN\n"
    "    { static int n = 0; if (n++ < 8) nx::log(\"DYNTEX size mismatch layer=%llx use=%llu recorded=%u\",\n"
    "        (unsigned long long)c.x[19], (unsigned long long)c.x[0], uint32_t(c.x[8])); }\n"
    "    // PATCH-DYNTEX-SIZE-LOG-END\n"
)


def extract_body(text, sig):
    start = text.find(sig)
    if start < 0:
        return None, None
    end = text.find("\n}\n", start)
    if end < 0:
        return None, None
    end += 3
    return start, end


def main():
    restore = "--restore" in sys.argv
    for f in (F_DUMP, F_LAYER):
        if not os.path.exists(f):
            raise SystemExit("missing " + f)

    # ---- dump() ----
    t = open(F_DUMP, encoding="utf-8", errors="replace", newline="").read()
    if restore:
        if DUMP_MARK in t:
            start, end = extract_body(t, DUMP_SIG)
            if start is None:
                raise SystemExit("dump(): body not found")
            orig = (
                "void main_00F070C8(nx::CPU& NX_RESTRICT c) {\n"
                "    { uint64_t a = c.x[31] + 0xffffffffffffffe0ull; nx::st<uint64_t>(a, uint64_t(c.x[19])); c.x[31] = a; } // str x19, [sp, #-0x20]!\n"
                "    { uint64_t a = c.x[31] + 0x10ull; nx::st<uint64_t>(a, uint64_t(c.x[29])); nx::st<uint64_t>(a + 8, uint64_t(c.x[30])); } // stp x29, x30, [sp, #0x10]\n"
                "    c.x[29] = uint64_t(uint64_t(c.x[31]) + uint64_t(0x10ull)); // add x29, sp, #0x10\n"
                "    c.x[8] = uint64_t(NXB + 0x2f9d000ull); // adrp x8, #0x2f9d000\n"
                "    { uint64_t a = c.x[8] + 0xe68ull; c.x[8] = uint64_t(nx::ld<uint64_t>(a)); } // ldr x8, [x8, #0xe68]\n"
                "    c.x[19] = uint64_t(c.x[0]); // mov x19, x0\n"
                "    { uint64_t a = c.x[8]; c.x[0] = uint32_t(nx::ld<uint32_t>(a)); } // ldr w0, [x8]\n"
                "    c.x[30] = NXB + 0xf070e8ull; main_014125E8(c); // bl #0x14125e8\n"
                "    if (c.x[0] == 0) goto L_F070F4; // cbz x0, #0xf070f4\n"
                "    c.x[0] = uint32_t(uint32_t(uint32_t(c.x[0])) - uint32_t(0x1ull)); // sub w0, w0, #1\n"
                "    goto L_F070F8; // b #0xf070f8\n"
                "L_F070F4:;\n"
                "    c.x[30] = NXB + 0xf070f8ull; main_014126B8(c); // bl #0x14126b8\n"
                "L_F070F8:;\n"
                "    { uint64_t a = c.x[29] + 0xfffffffffffffffcull; nx::st<uint32_t>(a, uint32_t(uint32_t(c.x[0]))); } // stur w0, [x29, #-4]\n"
                "    { uint64_t a = c.x[29] + 0xfffffffffffffffcull; c.x[1] = uint32_t(nx::ld<uint32_t>(a)); } // ldur w1, [x29, #-4]\n"
                "    c.x[0] = uint64_t(c.x[19]); // mov x0, x19\n"
                "    { uint64_t a = c.x[31] + 0x10ull; auto v0 = nx::ld<uint64_t>(a + 0); auto v1 = nx::ld<uint64_t>(a + 8); c.x[29] = uint64_t(v0); c.x[30] = uint64_t(v1); } // ldp x29, x30, [sp, #0x10]\n"
                "    { uint64_t a = c.x[31]; c.x[31] += 0x20ull; c.x[19] = uint64_t(nx::ld<uint64_t>(a)); } // ldr x19, [sp], #0x20\n"
                "    { main_00F06EDC(c); return; } // b #0xf06edc\n"
                "}\n"
            )
            t = t[:start] + orig + t[end:]
            open(F_DUMP, "w", encoding="utf-8", newline="").write(t)
            print("restored", F_DUMP)
        else:
            print("nothing to restore in", F_DUMP)
    else:
        if DUMP_MARK in t:
            print("already applied:", F_DUMP)
        else:
            start, end = extract_body(t, DUMP_SIG)
            if start is None:
                raise SystemExit("dump(): body not found in " + F_DUMP)
            t = t[:start] + DUMP_NEW_BODY + t[end:]
            open(F_DUMP, "w", encoding="utf-8", newline="").write(t)
            print("patched", F_DUMP)

    # ---- postDrawImpl call site ----
    t = open(F_LAYER, encoding="utf-8", errors="replace", newline="").read()
    if restore:
        if LAYER_MARK in t:
            lines = t.splitlines(keepends=True)
            out, i, removed = [], 0, 0
            while i < len(lines):
                if LAYER_MARK in lines[i]:
                    j = i
                    while j < len(lines) and "PATCH-DYNTEX-SIZE-LOG-END" not in lines[j]:
                        j += 1
                    removed += 1
                    i = j + 1
                    continue
                out.append(lines[i])
                i += 1
            t = "".join(out).replace(LAYER_INCLUDE_NEW, LAYER_INCLUDE_OLD, 1)
            open(F_LAYER, "w", encoding="utf-8", newline="").write(t)
            print("restored", F_LAYER, "blocks", removed)
        else:
            print("nothing to restore in", F_LAYER)
    else:
        if LAYER_MARK in t:
            if LAYER_INCLUDE_NEW not in t and LAYER_INCLUDE_OLD in t:
                t = t.replace(LAYER_INCLUDE_OLD, LAYER_INCLUDE_NEW, 1)
                open(F_LAYER, "w", encoding="utf-8", newline="").write(t)
                print("added include to", F_LAYER)
            else:
                print("already applied:", F_LAYER)
        else:
            n = t.count(LAYER_ANCHOR)
            if n != 1:
                raise SystemExit("postDraw anchor count %d (want 1) in %s" % (n, F_LAYER))
            if LAYER_INCLUDE_NEW not in t:
                if LAYER_INCLUDE_OLD not in t:
                    raise SystemExit("include anchor not found in " + F_LAYER)
                t = t.replace(LAYER_INCLUDE_OLD, LAYER_INCLUDE_NEW, 1)
            t = t.replace(LAYER_ANCHOR, LAYER_ANCHOR + LAYER_LOG, 1)
            open(F_LAYER, "w", encoding="utf-8", newline="").write(t)
            print("patched", F_LAYER)


if __name__ == "__main__":
    main()
