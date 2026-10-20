#!/usr/bin/env python3
"""Draw tracing from a presented-frame number, plus dumps of R8 atlases at the draw.

NX_TRACE_DRAWS selects draws by global draw index, which is awkward when the interesting draw is
known by frame (the tutorial banner appears around frame 4200).  NX_TRACE_FROM_FRAME=<frame> starts
the same 80-draw trace (NX_TRACE_COUNT) at that frame; NX_TRACE_GLYPHS also writes the guest-side
content of every bound R8 texture under frames/tex_draw_<n>.ppm, which is where a CPU-built glyph
atlas lives at draw time.

runtime/src/nvn/nvn_draw_trace.cpp; idempotent (--restore).

Usage: python3 tools/patches/patch-trace-frame.py [--restore]   (SP2PORT override)
"""
import os
import sys

ROOT = os.environ.get("SP2PORT", "/home/hexa/sp2port")
F = os.path.join(ROOT, "runtime/src/nvn/nvn_draw_trace.cpp")

MARK = "PATCH-TRACE-FRAME"

OLD_INC = '#include "nvn_draw_state.h"\n'
NEW_INC = '#include "nvn_draw_state.h"\n#include "platform.h"  // PATCH-TRACE-FRAME (plat::data_root)\n'

OLD = """    static const char* trace_env = std::getenv("NX_TRACE_DRAWS");
    static const uint64_t trace_from = trace_env ? std::strtoull(trace_env, nullptr, 10) : 0;
"""

NEW = """    static const char* trace_env = std::getenv("NX_TRACE_DRAWS");
    static const uint64_t trace_from = trace_env ? std::strtoull(trace_env, nullptr, 10) : 0;
    // PATCH-TRACE-FRAME: also start the trace at a presented frame (NX_TRACE_FROM_FRAME).
    static const char* frame_env = std::getenv("NX_TRACE_FROM_FRAME");
    static const uint64_t trace_frame_from = frame_env ? std::strtoull(frame_env, nullptr, 10) : 0;
"""

OLD2 = """    if (trace_env && g_stats.done >= trace_from && traced < trace_count && (!trace_target || t.colors[0] == trace_target) &&
        (!fs_env || (fs && std::strstr(fs_env, fs->hash.c_str())))) {  // one hash or a comma list
"""

NEW2 = """    if ((trace_env || frame_env) && (!trace_env || g_stats.done >= trace_from) &&
        (!trace_frame_from || nx::g_frame.load() >= trace_frame_from) && traced < trace_count &&
        (!trace_target || t.colors[0] == trace_target) &&
        (!fs_env || (fs && std::strstr(fs_env, fs->hash.c_str())))) {  // one hash or a comma list
        // PATCH-TRACE-FRAME: dump the guest side of a bound R8 texture (a CPU-built glyph atlas) once.
        if (std::getenv("NX_TRACE_GLYPHS")) {
            static int dumped = 0;
            static uint64_t seen[32] = {};
            static int seen_n = 0;
            for (size_t k = 0; k < tex_bindings.size() && dumped < 32; k++) {
                uint64_t texture = 0;
                SamplerInfo si;
                ViewInfo vw;
                texture_for(handles[k], texture, si, &vw);
                Texture* tx = texture ? get<Texture>(texture) : nullptr;
                if (!tx || tx->format != 0x1 || !tx->memory || tx->width < 64 || tx->height < 64) continue;
                bool dup = false;
                for (int s = 0; s < seen_n; s++) dup |= seen[s] == texture;
                if (dup) continue;
                if (seen_n < 32) seen[seen_n++] = texture;
                uint64_t pitch = tx->stride ? tx->stride : tx->width;
                uint64_t rows = tx->height;
                if (pitch * rows > tx->storage_size) rows = tx->storage_size / pitch;
                char path[512];
                std::snprintf(path, sizeof path, "%s/frames/tex_draw_%02d_%llux%llu_f%llu.pgm", plat::data_root().c_str(),
                              dumped, (unsigned long long)tx->width, (unsigned long long)rows,
                              (unsigned long long)nx::g_frame.load());
                FILE* fp = std::fopen(path, "wb");
                if (fp) {
                    std::fprintf(fp, "P5\\n%u %u\\n255\\n", tx->width, uint32_t(rows));
                    const uint8_t* base = reinterpret_cast<const uint8_t*>(tx->memory);
                    for (uint64_t y = 0; y < rows; y++) std::fwrite(base + y * pitch, 1, tx->width, fp);
                    std::fclose(fp);
                    log("nvn: glyph atlas dump %s (stride %u block_h %u storage %llu)", path, tx->stride,
                        tx->block_height_gobs, (unsigned long long)tx->storage_size);
                    dumped++;
                }
            }
        }
"""


def main():
    t = open(F, encoding="utf-8", errors="replace", newline="").read()
    if "--restore" in sys.argv:
        if MARK not in t:
            print("nothing to restore")
            return
        t = t.replace(NEW, OLD, 1).replace(NEW2, OLD2, 1).replace(NEW_INC, OLD_INC, 1)
        open(F, "w", encoding="utf-8", newline="").write(t)
        print("restored")
        return
    if MARK in t:
        print("already applied")
        return
    if OLD not in t or OLD2 not in t or OLD_INC not in t:
        raise SystemExit("pattern not found: " + F)
    t = t.replace(OLD_INC, NEW_INC, 1).replace(OLD, NEW, 1).replace(OLD2, NEW2, 1)
    open(F, "w", encoding="utf-8", newline="").write(t)
    print("patched", F)


if __name__ == "__main__":
    main()
