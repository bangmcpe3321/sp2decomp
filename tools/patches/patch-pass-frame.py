#!/usr/bin/env python3
"""Pass trace by frame, with colour/depth image sizes: NX_TRACE_PASSES_FROM_FRAME=<frame>.

`NX_TRACE_PASSES` selects passes by global draw index, which cannot target the tutorial (its draw
index is ~1.4M and drifts between runs).  This adds a frame condition next to it and logs, for each
pass, the frame, the draw index, the cleared flag, and the colour/depth image (identity, size,
format).  That is what showed the tutorial scene being rendered into a 1920x1080 image and then
cleared mid-frame before the UI.

runtime/src/nvn/nvn_draw_trace.cpp; idempotent (--restore).

Usage: python3 tools/patches/patch-pass-frame.py [--restore]   (SP2PORT override)
"""
import os
import sys

ROOT = os.environ.get("SP2PORT", "/home/hexa/sp2port")
F = os.path.join(ROOT, "runtime/src/nvn/nvn_draw_trace.cpp")

MARK = "PATCH-PASS-FRAME"

OLD = """void trace_pass(const char* what, const Targets& t, uint32_t a, uint32_t b) {
    static const char* env = std::getenv("NX_TRACE_PASSES");
    static const uint64_t from = env ? std::strtoull(env, nullptr, 10) : 0;
    static int n = 0;
    if (!env || g_stats.done < from || n++ >= 4000) return;
    Texture* c0 = t.color_count && t.colors[0] ? get<Texture>(t.colors[0]) : nullptr;
    log("pass: %s %x %x after draw %llu: %u colours, 0 = %llx (%ux%u f%x L%u l%u view f%x) depth %llx", what, a, b,
        (unsigned long long)g_stats.done, t.color_count, (unsigned long long)t.colors[0], c0 ? c0->width : 0,
        c0 ? c0->height : 0, c0 ? c0->format : 0, t.views.level[0], t.views.layer[0], t.views.format[0],
        (unsigned long long)t.depth);
}
"""

NEW = """void trace_pass(const char* what, const Targets& t, uint32_t a, uint32_t b) {
    static const char* env = std::getenv("NX_TRACE_PASSES");
    static const uint64_t from = env ? std::strtoull(env, nullptr, 10) : 0;
    // PATCH-PASS-FRAME: also select passes by presented frame.
    static const char* frame_env = std::getenv("NX_TRACE_PASSES_FROM_FRAME");
    static const uint64_t frame_from = frame_env ? std::strtoull(frame_env, nullptr, 10) : 0;
    static int n = 0;
    if ((!env && !frame_env) || (env ? g_stats.done < from : false) || (frame_from && g_frame.load() < frame_from) ||
        n++ >= 8000)
        return;
    GpuImage* ci = t.color_count && t.colors[0] ? image_of(t.colors[0]) : nullptr;
    GpuImage* di = t.depth ? image_of(t.depth) : nullptr;
    log("pass: %s f=%llu done=%llu a=%u b=%u col=%llx(img %llx %ux%u f%x) depth=%llx(img %llx %ux%u f%x)", what,
        (unsigned long long)g_frame.load(), (unsigned long long)g_stats.done, a, b, (unsigned long long)t.colors[0],
        (unsigned long long)(uintptr_t)ci, ci ? ci->width : 0, ci ? ci->height : 0, ci ? ci->format : 0,
        (unsigned long long)t.depth, (unsigned long long)(uintptr_t)di, di ? di->width : 0, di ? di->height : 0,
        di ? di->format : 0);
}
"""


def main():
    t = open(F, encoding="utf-8", errors="replace", newline="").read()
    if "--restore" in sys.argv:
        if MARK not in t:
            print("nothing to restore")
            return
        t = t.replace(NEW, OLD, 1)
        open(F, "w", encoding="utf-8", newline="").write(t)
        print("restored")
        return
    if MARK in t:
        print("already applied")
        return
    if OLD not in t:
        raise SystemExit("pattern not found: " + F)
    t = t.replace(OLD, NEW, 1)
    open(F, "w", encoding="utf-8", newline="").write(t)
    print("patched", F)


if __name__ == "__main__":
    main()
