#!/usr/bin/env python3
"""Count live graphics pipelines + log them (temporary accounting, pairs with patch-memory-accounting.py).

The 60-frame line already shows how many pipelines a window *created*; the memory question is how many are
alive, because the pipeline cache keeps every VkPipeline for the life of the process.  Increment a counter at
the cache insertion and print it next to the live-image total.

Idempotent (--restore).  runtime/src/nvn/nvn_vk.h, nvn_pipeline.cpp, nvn_pipeline_cache.cpp.
"""
import os
import sys

ROOT = os.environ.get("SP2PORT", "/home/hexa/sp2port")
VK_H = os.path.join(ROOT, "runtime/src/nvn/nvn_vk.h")
PIPE = os.path.join(ROOT, "runtime/src/nvn/nvn_pipeline.cpp")
CACHE = os.path.join(ROOT, "runtime/src/nvn/nvn_pipeline_cache.cpp")

H_OLD = "extern std::atomic<uint64_t> g_image_live_count;\n"
H_NEW = (
    "extern std::atomic<uint64_t> g_image_live_count;\n"
    "// PATCH-PIPELINE-COUNT: graphics pipelines in the lifetime cache.\n"
    "extern std::atomic<uint64_t> g_pipelines_alive;\n"
)

P_OLD = "    return (last = &*cache.emplace(k, p).first)->second;\n"
P_NEW = (
    "    g_pipelines_alive++;  // PATCH-PIPELINE-COUNT\n"
    "    return (last = &*cache.emplace(k, p).first)->second;\n"
)

P_DEF_OLD = "namespace nx::nvn {\n"
P_DEF_NEW = (
    "namespace nx::nvn {\n"
    "// PATCH-PIPELINE-COUNT\n"
    "std::atomic<uint64_t> g_pipelines_alive{0};\n"
)

C_OLD = (
    "    log(\"nvn/vk: images live: %llu (%llu MB)\", (unsigned long long)g_image_live_count.load(),\n"
    "        (unsigned long long)(g_image_live_bytes.load() >> 20));\n"
)
C_NEW = (
    "    log(\"nvn/vk: images live: %llu (%llu MB), pipelines live: %llu\", (unsigned long long)g_image_live_count.load(),\n"
    "        (unsigned long long)(g_image_live_bytes.load() >> 20), (unsigned long long)g_pipelines_alive.load());\n"
)


def main():
    restore = "--restore" in sys.argv
    pairs = [(VK_H, H_OLD, H_NEW), (PIPE, P_DEF_OLD, P_DEF_NEW), (PIPE, P_OLD, P_NEW), (CACHE, C_OLD, C_NEW)]
    for path, old, new in pairs:
        t = open(path, encoding="utf-8", errors="replace", newline="").read()
        a, b = (new, old) if restore else (old, new)
        if b in t:
            continue
        if a not in t:
            raise SystemExit("anchor not found in " + path)
        t = t.replace(a, b, 1)
        open(path, "w", encoding="utf-8", newline="").write(t)
    print("restored" if restore else "patched")


if __name__ == "__main__":
    main()
