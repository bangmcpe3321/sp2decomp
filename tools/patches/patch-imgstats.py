#!/usr/bin/env python3
"""Temporary diagnostic: live VkDeviceMemory per host format, so image growth can be attributed.

The live-image total (PATCH-MEMORY-ACCOUNTING) says how much, not what. This keeps count/bytes per
VkFormat and logs the breakdown with the 60-frame timing window, showing whether the multi-GB live
set is RGBA16F render targets, RGBA8 UI targets, BC textures or something else.

runtime/src/nvn/nvn_image.cpp, nvn_frames.cpp, nvn_pipeline_cache.cpp, nvn_vk.h; idempotent.

Usage: python3 tools/patches/patch-imgstats.py [--restore]   (SP2PORT override)
"""
import os
import sys

ROOT = os.environ.get("SP2PORT", "/home/hexa/sp2port")
IMG = os.path.join(ROOT, "runtime/src/nvn/nvn_image.cpp")
FRAMES = os.path.join(ROOT, "runtime/src/nvn/nvn_frames.cpp")
PIPE = os.path.join(ROOT, "runtime/src/nvn/nvn_pipeline_cache.cpp")
HDR = os.path.join(ROOT, "runtime/src/nvn/nvn_vk.h")

MARK = "PATCH-IMGSTATS"

OLD_INC = "#include <algorithm>\n#include <cstdlib>\n#include <map>\n#include <memory>\n#include <tuple>\n"
NEW_INC = "#include <algorithm>\n#include <cstdio>\n#include <cstdlib>\n#include <map>\n#include <memory>\n#include <mutex>\n#include <string>\n#include <tuple>\n"

OLD_ADD = "    img->bytes = req.size;  // PATCH-MEMORY-ACCOUNTING\n"
NEW_ADD = ("    img->bytes = req.size;  // PATCH-MEMORY-ACCOUNTING\n"
           "    image_stats_add(img->format, req.size);  // PATCH-IMGSTATS\n")

OLD_SUB = ("        // PATCH-MEMORY-ACCOUNTING\n"
           "        g_image_live_bytes -= img->bytes, g_image_live_count--;\n")
NEW_SUB = ("        // PATCH-MEMORY-ACCOUNTING\n"
           "        g_image_live_bytes -= img->bytes, g_image_live_count--;\n"
           "        image_stats_sub(img->format, img->bytes);  // PATCH-IMGSTATS\n")

OLD_LOG = """    log("nvn/vk: images live: %llu (%llu MB), pipelines live: %llu", (unsigned long long)g_image_live_count.load(),
        (unsigned long long)(g_image_live_bytes.load() >> 20), (unsigned long long)g_pipelines_alive.load());
"""
NEW_LOG = """    log("nvn/vk: images live: %llu (%llu MB), pipelines live: %llu", (unsigned long long)g_image_live_count.load(),
        (unsigned long long)(g_image_live_bytes.load() >> 20), (unsigned long long)g_pipelines_alive.load());
    image_stats_log();  // PATCH-IMGSTATS
"""

OLD_HDR = "GpuImage* image_of(uint64_t texture);\n"
NEW_HDR = ("GpuImage* image_of(uint64_t texture);\n"
           "// PATCH-IMGSTATS: live image bytes by host VkFormat.\n"
           "void image_stats_add(uint32_t fmt, uint64_t bytes);\n"
           "void image_stats_sub(uint32_t fmt, uint64_t bytes);\n"
           "void image_stats_log();\n")

FUNCS = """
// PATCH-IMGSTATS: live image bytes by host VkFormat, for the 60-frame memory report.
namespace {
std::mutex g_imgstats_mu;
std::map<uint32_t, std::pair<uint64_t, uint64_t>> g_imgstats;  // VkFormat -> (count, bytes)
}  // namespace
void image_stats_add(uint32_t fmt, uint64_t bytes) {
    std::lock_guard lk(g_imgstats_mu);
    auto& e = g_imgstats[fmt];
    e.first++, e.second += bytes;
}
void image_stats_sub(uint32_t fmt, uint64_t bytes) {
    std::lock_guard lk(g_imgstats_mu);
    auto it = g_imgstats.find(fmt);
    if (it == g_imgstats.end()) return;
    if (it->second.first) it->second.first--;
    it->second.second = it->second.second > bytes ? it->second.second - bytes : 0;
}
void image_stats_log() {
    std::lock_guard lk(g_imgstats_mu);
    std::string s;
    for (auto& [fmt, e] : g_imgstats) {
        if (!e.first) continue;
        char b[64];
        std::snprintf(b, sizeof b, " %u:%llu/%.1fMB", fmt, (unsigned long long)e.first,
                      double(e.second) / 1048576.0);
        s += b;
    }
    log("nvn/vk: image bytes by host format (count/MB):%s", s.c_str());
}

"""

OLD_FIRST = "namespace {\n\nbool check(VkResult r, const char* what) {"
NEW_FIRST = FUNCS + "namespace {\n\nbool check(VkResult r, const char* what) {"


def main():
    restore = "--restore" in sys.argv
    files = {IMG: None, FRAMES: None, PIPE: None, HDR: None}
    for f in files:
        files[f] = open(f, encoding="utf-8", errors="replace", newline="").read()
    if restore:
        if MARK not in files[IMG]:
            print("nothing to restore")
            return
        t = files[IMG].replace(NEW_INC, OLD_INC, 1).replace(NEW_FIRST, OLD_FIRST, 1).replace(NEW_ADD, OLD_ADD, 1)
        open(IMG, "w", encoding="utf-8", newline="").write(t)
        t = files[FRAMES].replace(NEW_SUB, OLD_SUB, 1)
        open(FRAMES, "w", encoding="utf-8", newline="").write(t)
        t = files[PIPE].replace(NEW_LOG, OLD_LOG, 1)
        open(PIPE, "w", encoding="utf-8", newline="").write(t)
        t = files[HDR].replace(NEW_HDR, OLD_HDR, 1)
        open(HDR, "w", encoding="utf-8", newline="").write(t)
        print("restored")
        return
    if MARK in files[IMG]:
        print("already applied")
        return
    if OLD_INC not in files[IMG] or OLD_ADD not in files[IMG] or OLD_FIRST not in files[IMG]:
        raise SystemExit("patterns not found in " + IMG)
    if OLD_SUB not in files[FRAMES] or OLD_LOG not in files[PIPE] or OLD_HDR not in files[HDR]:
        raise SystemExit("patterns not found in frames/pipe/hdr")
    t = files[IMG].replace(OLD_INC, NEW_INC, 1).replace(OLD_FIRST, NEW_FIRST, 1).replace(OLD_ADD, NEW_ADD, 1)
    open(IMG, "w", encoding="utf-8", newline="").write(t)
    open(FRAMES, "w", encoding="utf-8", newline="").write(files[FRAMES].replace(OLD_SUB, NEW_SUB, 1))
    open(PIPE, "w", encoding="utf-8", newline="").write(files[PIPE].replace(OLD_LOG, NEW_LOG, 1))
    open(HDR, "w", encoding="utf-8", newline="").write(files[HDR].replace(OLD_HDR, NEW_HDR, 1))
    print("patched")


if __name__ == "__main__":
    main()
