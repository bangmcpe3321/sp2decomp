#!/usr/bin/env python3
"""Log which PipelineKey field makes a graphics pipeline new (temporary diagnostic).

The tutorial/character screens create ~1 pipeline per frame; the cache keeps them for the life of the process and
the process reached 13 GB (each VkPipeline ~1 MB).  This prints the first differing field against the previous
miss (NX_PIPE_DIFF=1), every 25th miss and with the frame number, plus whether the shader hashes are unchanged
state churn (same_vs/same_fs) or a new program.

Idempotent (--restore).  runtime/src/nvn/nvn_pipeline.cpp.
"""
import os
import sys

ROOT = os.environ.get("SP2PORT", "/home/hexa/sp2port")
F = os.path.join(ROOT, "runtime/src/nvn/nvn_pipeline.cpp")

INC_OLD = "#include <cstdlib>\n#include <cstring>\n"
INC_NEW = "#include <cstddef>\n#include <cstdlib>\n#include <cstring>\n#include <nx/runtime.h>  // PATCH-PIPE-DIFF (nx::g_frame)\n"

BEGIN = "    // PATCH-PIPE-DIFF-BEGIN"
END = "    // PATCH-PIPE-DIFF-END"
ANCHOR = "    if (auto it = cache.find(k); it != cache.end()) return (last = &*it)->second;\n"

BLOCK = """    if (auto it = cache.find(k); it != cache.end()) return (last = &*it)->second;
    // PATCH-PIPE-DIFF-BEGIN: which key field made this a new pipeline?
    {
        static const bool on = std::getenv("NX_PIPE_DIFF") != nullptr;
        static std::vector<uint8_t> prev(sizeof key);
        static std::string prev_vs, prev_fs;
        static bool have = false;
        static uint64_t misses = 0, logs = 0;
        struct Field { const char* name; size_t off, elem; };
        static const Field fields[] = {
            {"vs", offsetof(PipelineKey, vs), sizeof(const ShaderInfo*)},
            {"fs", offsetof(PipelineKey, fs), sizeof(const ShaderInfo*)},
            {"topology", offsetof(PipelineKey, topology), sizeof(uint32_t)},
            {"attribs", offsetof(PipelineKey, attribs), sizeof(VertexAttrib)},
            {"streams", offsetof(PipelineKey, streams), sizeof(VertexStream)},
            {"attrib_count", offsetof(PipelineKey, attrib_count), sizeof(uint32_t)},
            {"stream_count", offsetof(PipelineKey, stream_count), sizeof(uint32_t)},
            {"blend", offsetof(PipelineKey, blend), sizeof(BlendTarget)},
            {"color", offsetof(PipelineKey, color), sizeof(ColorStateInfo)},
            {"mask", offsetof(PipelineKey, mask), sizeof(ChannelMaskInfo)},
            {"depth", offsetof(PipelineKey, depth), sizeof(DepthStencilInfo)},
            {"polygon", offsetof(PipelineKey, polygon), sizeof(PolygonInfo)},
            {"color_formats", offsetof(PipelineKey, color_formats), sizeof(VkFormat)},
            {"color_count", offsetof(PipelineKey, color_count), sizeof(uint32_t)},
            {"depth_format", offsetof(PipelineKey, depth_format), sizeof(VkFormat)},
            {"depth_clamp", offsetof(PipelineKey, depth_clamp), sizeof(uint32_t)},
            {"ufloat_colors", offsetof(PipelineKey, ufloat_colors), sizeof(uint32_t)},
            {"alpha_to_coverage", offsetof(PipelineKey, alpha_to_coverage), sizeof(uint32_t)},
        };
        const std::string vs_h = key.vs ? key.vs->hash : "-", fs_h = key.fs ? key.fs->hash : "-";
        if (on) {
            if (have && (misses % 25) == 0 && logs < 400) {
                size_t first = 0;
                while (first < sizeof key && prev[first] == k.b[first]) first++;
                if (first < sizeof key) {
                    const char* name = "?";
                    size_t idx = 0;
                    for (const Field& f : fields)
                        if (first >= f.off && first < f.off + f.elem) {
                            name = f.name, idx = (first - f.off) / f.elem;
                        }
                    uint32_t a = 0, b = 0;  // up to 4 bytes at the difference
                    for (size_t i = 0; i < 4 && first + i < sizeof key; i++) a |= uint32_t(prev[first + i]) << (8 * i);
                    for (size_t i = 0; i < 4 && first + i < sizeof key; i++) b |= uint32_t(k.b[first + i]) << (8 * i);
                    logs++;
                    log("PIPEDIFF f=%llu miss=%llu off=%zu %s[%zu] old=%08x new=%08x same_vs=%d same_fs=%d vs=%s fs=%s",
                        (unsigned long long)nx::g_frame.load(), (unsigned long long)misses, first, name, idx, a, b,
                        int(vs_h == prev_vs), int(fs_h == prev_fs), vs_h.c_str(), fs_h.c_str());
                }
            }
            misses++;
            prev.assign(k.b, k.b + sizeof key), prev_vs = vs_h, prev_fs = fs_h, have = true;
        }
    }
    // PATCH-PIPE-DIFF-END
"""


def strip_block(t):
    lines = t.splitlines(keepends=True)
    out, i = [], 0
    while i < len(lines):
        if BEGIN in lines[i]:
            j = i
            while j < len(lines) and END not in lines[j]:
                j += 1
            i = j + 1
            continue
        out.append(lines[i])
        i += 1
    return "".join(out)


def main():
    t = open(F, encoding="utf-8", errors="replace", newline="").read()
    if "--restore" in sys.argv:
        if BEGIN not in t:
            print("nothing to restore")
            return
        t = strip_block(t)
        t = t.replace("#include <cstddef>\n", "", 1).replace(
            "#include <nx/runtime.h>  // PATCH-PIPE-DIFF (nx::g_frame)\n", "", 1)
        open(F, "w", encoding="utf-8", newline="").write(t)
        print("restored")
        return
    if BEGIN in t:
        t = strip_block(t)  # upgrade: replace the earlier block with this one
    if t.count(ANCHOR) != 1:
        raise SystemExit("anchor count %d" % t.count(ANCHOR))
    if "#include <cstddef>\n" not in t:
        t = t.replace("#include <cstdlib>\n", "#include <cstddef>\n#include <cstdlib>\n", 1)
    if "#include <nx/runtime.h>" not in t:
        t = t.replace("#include <cstring>\n", "#include <cstring>\n#include <nx/runtime.h>  // PATCH-PIPE-DIFF (nx::g_frame)\n", 1)
    t = t.replace(ANCHOR, BLOCK, 1)
    open(F, "w", encoding="utf-8", newline="").write(t)
    print("patched", F)


if __name__ == "__main__":
    main()
