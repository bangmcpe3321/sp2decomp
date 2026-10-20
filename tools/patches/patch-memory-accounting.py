#!/usr/bin/env python3
"""Live memory accounting: Vulkan image allocations and guest heap commit.

The 12:07 run died at 12.13 GB during the title -> gameplay transition, and the log could not say whether that was the
guest heap, the Vulkan images (one dedicated VkDeviceMemory per texture), or staging.  This keeps two counters next to
the allocations and prints them in the 60-frame timing line:

  nvn/vk: images live: N (X MB) ...      images and their VkDeviceMemory, freed in free_retired_images
  memory: ... [heap H GB committed]      the guest heap range (kHeapBase..kHeapMax), from VirtualQuery

Low overhead (two atomics per image), so it stays in production builds.

Idempotent: patches runtime/src/nvn/nvn_vk.h, nvn_image.cpp, nvn_frames.cpp, nvn_pipeline_cache.cpp and
memguard_win.cpp once; --restore puts them back.

Usage: python3 patch-memory-accounting.py [--restore]   (SP2PORT override)
"""

import os
import sys

ROOT = os.environ.get("SP2PORT", "/home/hexa/sp2port")

VK_H = os.path.join(ROOT, "runtime/src/nvn/nvn_vk.h")
IMAGE = os.path.join(ROOT, "runtime/src/nvn/nvn_image.cpp")
FRAMES = os.path.join(ROOT, "runtime/src/nvn/nvn_frames.cpp")
PIPE = os.path.join(ROOT, "runtime/src/nvn/nvn_pipeline_cache.cpp")
GUARD = os.path.join(ROOT, "runtime/src/memguard_win.cpp")

MARK = "// PATCH-MEMORY-ACCOUNTING"

# ---- nvn_vk.h -----------------------------------------------------------------------------------------------------
H_OLD_INC = "#include <string>\n#include <vector>\n"
H_NEW_INC = "#include <atomic>\n#include <string>\n#include <vector>\n"

H_OLD_FIELD = "    uint32_t nvn_format = 0;  // the texture's NVN format\n};\n"
H_NEW_FIELD = (
    "    uint32_t nvn_format = 0;  // the texture's NVN format\n"
    "    uint64_t bytes = 0;       // PATCH-MEMORY-ACCOUNTING: its VkDeviceMemory size, for the live-image total\n"
    "};\n"
    "\n"
    "// PATCH-MEMORY-ACCOUNTING: images allocated for guest textures and not yet freed (nvn_image.cpp / nvn_frames.cpp).\n"
    "extern std::atomic<uint64_t> g_image_live_bytes;\n"
    "extern std::atomic<uint64_t> g_image_live_count;\n"
)

# ---- nvn_image.cpp ------------------------------------------------------------------------------------------------
IMAGE_OLD_ANCHOR = "std::map<StorageKey, std::weak_ptr<GpuImage>> g_live_images;\n"
IMAGE_NEW_ANCHOR = (
    "std::map<StorageKey, std::weak_ptr<GpuImage>> g_live_images;\n"
    "// PATCH-MEMORY-ACCOUNTING\n"
    "std::atomic<uint64_t> g_image_live_bytes{0};\n"
    "std::atomic<uint64_t> g_image_live_count{0};\n"
)

IMAGE_OLD_BIND = "    p_vkBindImageMemory(vk_device(), img->image, img->memory, 0);\n"
IMAGE_NEW_BIND = (
    "    p_vkBindImageMemory(vk_device(), img->image, img->memory, 0);\n"
    "    img->bytes = req.size;  // PATCH-MEMORY-ACCOUNTING\n"
    "    g_image_live_bytes += req.size, g_image_live_count++;\n"
)

# ---- nvn_frames.cpp -----------------------------------------------------------------------------------------------
FRAMES_OLD = "        if (img->memory) p_vkFreeMemory(vk_device(), img->memory, nullptr);\n"
FRAMES_NEW = (
    "        if (img->memory) p_vkFreeMemory(vk_device(), img->memory, nullptr);\n"
    "        // PATCH-MEMORY-ACCOUNTING\n"
    "        g_image_live_bytes -= img->bytes, g_image_live_count--;\n"
)

# ---- nvn_pipeline_cache.cpp ---------------------------------------------------------------------------------------
PIPE_OLD = (
    "    g_pipelines = g_pipeline_ns = g_astc = g_astc_ns = 0;\n"
)
PIPE_NEW = (
    "    g_pipelines = g_pipeline_ns = g_astc = g_astc_ns = 0;\n"
    "    // PATCH-MEMORY-ACCOUNTING: the images the textures hold right now (one VkDeviceMemory each).\n"
    "    log(\"nvn/vk: images live: %llu (%llu MB)\", (unsigned long long)g_image_live_count.load(),\n"
    "        (unsigned long long)(g_image_live_bytes.load() >> 20));\n"
)

# ---- memguard_win.cpp ---------------------------------------------------------------------------------------------
GUARD_OLD = (
    "            if (++ticks % 120 == 0)\n"
    "                log(\"memory: %.2f GB (peak %.2f GB, limit %.1f GB)\", double(f) / double(1ull << 30),\n"
    "                    double(peak) / double(1ull << 30), gb);\n"
)
GUARD_NEW = (
    "            if (++ticks % 120 == 0)  // PATCH-MEMORY-ACCOUNTING: split out the guest heap's commit\n"
    "                log(\"memory: %.2f GB (peak %.2f GB, limit %.1f GB) [guest heap %.2f GB committed]\",\n"
    "                    double(f) / double(1ull << 30), double(peak) / double(1ull << 30), gb,\n"
    "                    double(committed_in(kHeapBase, kHeapMax)) / double(1ull << 30));\n"
)

GUARD_FN_OLD = (
    "void start_memory_guard() {\n"
)
GUARD_FN_NEW = (
    "// PATCH-MEMORY-ACCOUNTING: committed bytes in a guest range (VirtualQuery walks the regions).\n"
    "static uint64_t committed_in(uint64_t start, uint64_t size) {\n"
    "    uint64_t total = 0, a = start;\n"
    "    while (a < start + size) {\n"
    "        MEMORY_BASIC_INFORMATION mbi{};\n"
    "        if (!VirtualQuery(reinterpret_cast<void*>(a), &mbi, sizeof mbi) || !mbi.RegionSize) break;\n"
    "        if (mbi.State == MEM_COMMIT) total += mbi.RegionSize;\n"
    "        a += mbi.RegionSize;\n"
    "    }\n"
    "    return total;\n"
    "}\n"
    "\n"
    "void start_memory_guard() {\n"
)


def patch(path, pairs):
    t = open(path, encoding="utf-8", errors="replace", newline="").read()
    changed = False
    for old, new in pairs:
        if new in t:
            continue
        if old not in t:
            raise SystemExit("anchor not found in %s:\n%s" % (path, old[:120]))
        t = t.replace(old, new, 1)
        changed = True
    if changed:
        open(path, "w", encoding="utf-8", newline="").write(t)
    return changed


def unpatch(path, pairs):
    t = open(path, encoding="utf-8", errors="replace", newline="").read()
    changed = False
    for old, new in pairs:
        if new not in t:
            continue
        t = t.replace(new, old, 1)
        changed = True
    if changed:
        open(path, "w", encoding="utf-8", newline="").write(t)
    return changed


def main():
    pairs_h = [(H_OLD_INC, H_NEW_INC), (H_OLD_FIELD, H_NEW_FIELD)]
    pairs_image = [(IMAGE_OLD_ANCHOR, IMAGE_NEW_ANCHOR), (IMAGE_OLD_BIND, IMAGE_NEW_BIND)]
    pairs_frames = [(FRAMES_OLD, FRAMES_NEW)]
    pairs_pipe = [(PIPE_OLD, PIPE_NEW)]
    pairs_guard = [(GUARD_FN_OLD, GUARD_FN_NEW), (GUARD_OLD, GUARD_NEW)]
    if "--restore" in sys.argv:
        for path, pairs in ((VK_H, pairs_h), (IMAGE, pairs_image), (FRAMES, pairs_frames), (PIPE, pairs_pipe),
                            (GUARD, pairs_guard)):
            print(("restored " if unpatch(path, pairs) else "unchanged ") + path)
    else:
        for path, pairs in ((VK_H, pairs_h), (IMAGE, pairs_image), (FRAMES, pairs_frames), (PIPE, pairs_pipe),
                            (GUARD, pairs_guard)):
            print(("patched " if patch(path, pairs) else "already applied ") + path)


if __name__ == "__main__":
    main()
