#!/usr/bin/env python3
"""Temporary diagnostic: log and dump the R8 (glyph atlas) texture uploads.

The small hint text and the size-100 banner text come out as scrambled fragments while size ~40 text
is legible, so different atlases (or different upload paths) must disagree. This logs, for every R8
texture at least 64 px wide, its dimensions, stride, pool swizzle, dirty range and whether the image
follows the R8->RGBA "alpha from red" path, and writes some uploads (the 1st, 10th and 40th) as gray
PPMs, both as packed rows and untiled, to <data root>/frames/.

runtime/src/nvn/nvn_upload.cpp; idempotent (--restore). Env: NX_DUMP_ATLAS=<n> (default 12 dumps).

Usage: python3 patch-atlas-dump.py [--restore]   (SP2PORT override)
"""

import os
import sys

ROOT = os.environ.get("SP2PORT", "/home/hexa/sp2port")
F = os.path.join(ROOT, "runtime/src/nvn/nvn_upload.cpp")

OLD0 = "#include <algorithm>\n#include <cstdio>\n#include <cstdlib>\n"
NEW0 = "#include <algorithm>\n#include <cstdio>\n#include <cstdlib>\n#include <map>\n#include <tuple>\n#include <nx/runtime.h>  // PATCH-ATLAS-DUMP (nx::g_frame)\n"

MARKER = "// PATCH-ATLAS-DUMP:"

OLD1 = """    if (std::getenv("NX_TRACE_UPLOADS") && t.storage_size >= (1u << 20)) {
"""

NEW1 = """    // PATCH-ATLAS-DUMP: NX_DUMP_ATLAS=<n> logs every R8 (glyph atlas) upload and writes some of them as gray
    // PPMs, packed and untiled, to see which layout the game wrote and when the glyphs arrive.
    if (const char* da = std::getenv("NX_DUMP_ATLAS"); da && t.format == 0x1 && img.width >= 64) {
        static int dumps = 0;
        static std::map<std::tuple<uint64_t, uint32_t, uint32_t>, int> seen;  // memory, w, h -> uploads seen
        int n = ++seen[std::make_tuple(t.memory, img.width, img.height)];
        if (n == 1 || n % 50 == 0)
            log("atlas: R8 #%d %ux%u stride %u mem %llx storage %llu block_h %u pool_sw %#x alpha %d dirty "
                "%llx..%llx uploaded %d",
                n, img.width, img.height, t.stride, (unsigned long long)t.memory,
                (unsigned long long)t.storage_size, t.block_height_gobs, t.pool_swizzle.load(), int(img.alpha_from_r),
                (unsigned long long)lo, (unsigned long long)hi, int(was_uploaded));
        if ((n == 1 || n == 10 || n == 40) && dumps < std::atoi(da)) {
            const uint64_t row_stride = t.stride ? uint64_t(t.stride) : uint64_t(img.width);
            const uint8_t* dsrc = reinterpret_cast<const uint8_t*>(t.memory);
            uint64_t drows = img.height;
            if (row_stride * drows > t.storage_size) drows = t.storage_size / row_stride;
            auto write_gray = [](const char* p, const uint8_t* buf, uint64_t stride, uint32_t w, uint64_t h) {
                FILE* f = std::fopen(p, "wb");
                if (!f) return;
                std::fprintf(f, "P6\\n%u %u\\n255\\n", w, uint32_t(h));
                std::vector<uint8_t> row(size_t(w) * 3);
                for (uint64_t y = 0; y < h; y++) {
                    const uint8_t* s = buf + y * stride;
                    for (uint32_t x = 0; x < w; x++) row[x * 3] = row[x * 3 + 1] = row[x * 3 + 2] = s[x];
                    std::fwrite(row.data(), 1, row.size(), f);
                }
                std::fclose(f);
            };
            char path[512];
            std::snprintf(path, sizeof path, "%s/frames/atlas_%02d_f%llu_%ux%u_s%u_n%d_packed.ppm",
                          plat::data_root().c_str(), dumps, (unsigned long long)nx::g_frame.load(), img.width,
                          uint32_t(drows), uint32_t(row_stride), n);
            write_gray(path, dsrc, row_stride, img.width, drows);
            std::vector<uint8_t> dlinear;
            uint32_t d_bw = 1, d_bh = 1, d_bytes = 1;
            format_block(t.format, d_bw, d_bh, d_bytes);
            uint32_t dlayers = img.view_type == VK_IMAGE_VIEW_TYPE_3D ? std::max(1u, t.depth) : img.layers;
            auto dlevels = deswizzle_texture(dsrc, t.storage_size, img.width, img.height, dlayers, img.levels, d_bw,
                                            d_bh, d_bytes, dlinear, t.block_height_gobs);
            if (!dlevels.empty()) {
                std::snprintf(path, sizeof path, "%s/frames/atlas_%02d_f%llu_%ux%u_s%u_n%d_tiled.ppm",
                              plat::data_root().c_str(), dumps, (unsigned long long)nx::g_frame.load(), img.width,
                              uint32_t(drows), uint32_t(row_stride), n);
                write_gray(path, dlinear.data() + dlevels[0].offset, img.width, img.width, dlevels[0].height);
            }
            dumps++;
        }
    }
    if (std::getenv("NX_TRACE_UPLOADS") && t.storage_size >= (1u << 20)) {
"""


def main():
    t = open(F, encoding="utf-8", errors="replace", newline="").read()
    if "--restore" in sys.argv:
        if MARKER not in t:
            print("nothing to restore")
            return
        lines = t.splitlines(keepends=True)
        out, i, removed = [], 0, 0
        while i < len(lines):
            if MARKER in lines[i]:
                j = i
                while j < len(lines) and lines[j] != "    }\n":
                    j += 1
                if j >= len(lines):
                    raise SystemExit("could not find the end of the block")
                removed += 1
                i = j + 1
                continue
            out.append(lines[i])
            i += 1
        t = "".join(out)
        t = t.replace(NEW0, OLD0, 1)
        open(F, "w", encoding="utf-8", newline="").write(t)
        print("restored, blocks removed:", removed)
        return
    if MARKER in t:
        print("already applied")
        return
    for need, name in ((OLD0, "OLD0"), (OLD1, "OLD1")):
        if need not in t:
            raise SystemExit("pattern not found (%s): %s" % (name, F))
    t = t.replace(OLD0, NEW0, 1).replace(OLD1, NEW1, 1)
    open(F, "w", encoding="utf-8", newline="").write(t)
    print("patched", F)


if __name__ == "__main__":
    main()
