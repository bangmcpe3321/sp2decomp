#!/usr/bin/env python3
"""R8 glyph atlas -> RGBA8: keep the CPU-written rows packed.

The font atlas the UI text samples is a 2048x2048 R8 texture created with `stride 0`
(the NVN builder says "tiled"), swizzle (R,1,1,1) and `alpha_from_r` — coverage lives in
R and the sampler replicates it. The game fills the texture **from the CPU**, so its guest
memory is rows of `width` bytes, not block-linear tiles; untiling it produced streak noise
(the `NX_DUMP_ALPHA` dump of the uploaded atlas had no glyph shapes at all).

This patch makes the alpha-from-R upload path use `row_stride = stride ? stride : width`
and widen each byte to (255,255,255,R). Before it, every label drew as white blobs; after
it the whole UI is legible ("ヘアスタイルは どれにする？").

runtime/src/nvn/nvn_upload.cpp; idempotent (--restore).

Usage: python3 tools/patches/patch-alpha-atlas.py [--restore]   (SP2PORT override)
"""
import os
import sys

ROOT = os.environ.get("SP2PORT", "/home/hexa/sp2port")
F = os.path.join(ROOT, "runtime/src/nvn/nvn_upload.cpp")

OLD = """    if (img.alpha_from_r && t.stride) {  // R8 pitch-linear -> RGBA8 (255, 255, 255, R), level 0
        const uint8_t* src = reinterpret_cast<const uint8_t*>(t.memory);
        uint64_t rows = uint64_t(img.height) * layers;
        if (t.stride * rows > t.storage_size) rows = t.storage_size / t.stride;
        // Only the rows the CPU wrote (a single layer), when the texture is already there (NX_FULL_UPLOAD=1: all).
        uint64_t y0 = 0, y1 = rows;
        if (was_uploaded && layers == 1 && !full_upload() && hi != UINT64_MAX)
            y0 = std::min(rows, lo / t.stride), y1 = std::min(rows, (hi + t.stride - 1) / t.stride);
        if (y1 <= y0) return;
        Upload u = upload_alloc((y1 - y0) * img.width * 4, 16);
        for (uint64_t y = y0; y < y1; y++) {
            const uint8_t* s = src + y * t.stride;"""
NEW = """    if (img.alpha_from_r) {  // R8 -> RGBA8 (255, 255, 255, R), level 0; CPU-written, so packed rows
        const uint64_t row_stride = t.stride ? uint64_t(t.stride) : uint64_t(img.width);
        const uint8_t* src = reinterpret_cast<const uint8_t*>(t.memory);
        uint64_t rows = uint64_t(img.height) * layers;
        if (row_stride * rows > t.storage_size) rows = t.storage_size / row_stride;
        // Only the rows the CPU wrote (a single layer), when the texture is already there (NX_FULL_UPLOAD=1: all).
        uint64_t y0 = 0, y1 = rows;
        if (was_uploaded && layers == 1 && !full_upload() && hi != UINT64_MAX)
            y0 = std::min(rows, lo / row_stride), y1 = std::min(rows, (hi + row_stride - 1) / row_stride);
        if (y1 <= y0) return;
        Upload u = upload_alloc((y1 - y0) * img.width * 4, 16);
        for (uint64_t y = y0; y < y1; y++) {
            const uint8_t* s = src + y * row_stride;"""


def main():
    t = open(F, encoding="utf-8", errors="replace", newline="").read()
    if "--restore" in sys.argv:
        if NEW not in t:
            print("nothing to restore")
            return
        open(F, "w", encoding="utf-8", newline="").write(t.replace(NEW, OLD, 1))
        print("restored")
        return
    if NEW in t:
        print("already patched")
        return
    if t.count(OLD) != 1:
        sys.exit("anchor found %d times" % t.count(OLD))
    open(F, "w", encoding="utf-8", newline="").write(t.replace(OLD, NEW, 1))
    print("patched", F)


main()
