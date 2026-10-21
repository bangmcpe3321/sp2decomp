#!/usr/bin/env python3
"""nvn: re-upload a CPU-written glyph atlas when its bytes change (NX_ATLAS_REFRESH=1).

The layout text of the tutorial banners (BlitzBold at its own size) was drawn with the letters of
whatever face had filled the shared R8 glyph atlas before: clean glyphs, wrong letters.  The font
engine writes the atlas through mapped memory and never reports the range to nvnMemoryPoolFlushMappedRange
(the 32 KB+ flushes seen are other pools), so the image was uploaded once at first use and kept.

With NX_ATLAS_REFRESH=1 a sampled R8-read-as-alpha image is checked once a frame: a sparse FNV over
the guest bytes (one byte in 61) is compared with the previous one, and a change marks the whole image
for upload.  The upload therefore happens only on the frames the font engine actually rasterised
glyphs, not every frame (a full 2048x2048 RGBA upload per frame cost about half the frame rate).
On by default; `NX_ATLAS_REFRESH=0` turns it off.

runtime/src/nvn/nvn_pipeline.cpp; idempotent (--restore).

Usage: python3 tools/patches/patch-atlas-refresh.py [--restore]   (SP2PORT override)
"""
import os
import sys

ROOT = os.environ.get("SP2PORT", "/home/hexa/sp2port")
F = os.path.join(ROOT, "runtime/src/nvn/nvn_pipeline.cpp")

MARK = "// NX-ATLAS-REFRESH:"

OLD = """    if (dirty_hi <= dirty_lo) dirty_lo = 0, dirty_hi = UINT64_MAX;  // marked without a range: all of it
"""

NEW = OLD + """    // NX-ATLAS-REFRESH: a CPU-written glyph atlas (R8 read as alpha) whose flushes never reach this texture is
    // uploaded again when its sampled bytes change, so a face or size change cannot leave stale glyphs in it.
    static const bool atlas_refresh = [] {  // on by default; NX_ATLAS_REFRESH=0 turns it off
        const char* e = std::getenv("NX_ATLAS_REFRESH");
        return e == nullptr || std::atoi(e) != 0;
    }();
    if (atlas_refresh && img->alpha_from_r && img->uploaded && !img->rendered && t->memory && t->storage_size) {
        static std::mutex atlas_lock;
        static std::map<uint64_t, std::pair<uint64_t, uint64_t>> atlas_sig;  // texture: {frame checked, signature}
        const uint64_t frame = nx::g_frame.load();
        bool check = false;
        {
            std::lock_guard lk(atlas_lock);
            auto& e = atlas_sig[texture];
            if (e.first != frame) { e.first = frame; check = true; }
        }
        if (check) {
            const uint8_t* p = reinterpret_cast<const uint8_t*>(t->memory);
            uint64_t h = 1469598103934665603ull;
            for (uint64_t k = 0; k < t->storage_size; k += 61) { h ^= p[k]; h *= 1099511628211ull; }
            std::lock_guard lk(atlas_lock);
            auto& e = atlas_sig[texture];
            if (e.second != h) { e.second = h; dirty = true; dirty_lo = 0; dirty_hi = UINT64_MAX; }
        }
    }
"""


def main():
    restore = "--restore" in sys.argv
    t = open(F, encoding="utf-8").read()
    if restore:
        if MARK not in t:
            print("no block to restore")
            return
        i = t.index(MARK)
        j = t.index("\n    }\n", i) + len("\n    }\n")
        t = t[:i] + t[j:]
        open(F, "w", encoding="utf-8").write(t)
        print("restored", os.path.basename(F))
        return
    if MARK in t:
        print("already patched")
        return
    if OLD not in t:
        sys.exit("pattern not found")
    t = t.replace(OLD, NEW, 1)
    open(F, "w", encoding="utf-8").write(t)
    print("patched", os.path.basename(F), "NX-ATLAS-REFRESH")


main()
