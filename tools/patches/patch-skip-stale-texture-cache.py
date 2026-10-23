#!/usr/bin/env python3
"""Skip texture-cache updates for a font slot with no font data.

`TextureCache::UpdateTextureCache` calls `ScalableFontEngine::AcquireGlyphmap` with the
font pointer from `[this+8]`.  For the slot freed during the plaza/news transition the
engine returns null; the update then dereferences `[x0+0x1e]` and the process dies
(`c0000005`, data address 0x1e).

The stale slot is the same one reported by `FSSNULL ... data=0`.  Returning from
`UpdateTextureCache` when `[[this+8]+0x38] == 0` leaves the stale atlas alone and prevents
the crash; valid font caches still update normally.

Applies after patch-font-stale-data.py; idempotent (--restore).

Usage: python3 tools/patches/patch-skip-stale-texture-cache.py [--restore]   (SP2PORT override)
"""
import os
import sys

ROOT = os.environ.get("SP2PORT", "/home/hexa/sp2port")
F = os.path.join(ROOT, "gen/main/code_417.cpp")
MARK = "PATCH-SKIP-STALE-TEXCACHE"

OLD = "void main_01364578(nx::CPU& NX_RESTRICT c) {\n"
NEW = """void main_01364578(nx::CPU& NX_RESTRICT c) {
    // PATCH-SKIP-STALE-TEXCACHE: AcquireGlyphmap returns null for the released font slot,
    // and the original update dereferences the null glyph map at +0x1e.
    if (c.x[0] == 0) {
        return;
    }
    {
        uint64_t fss_font = nx::ld<uint64_t>(c.x[0] + 0x8ull);
        if (fss_font == 0 || nx::ld<uint64_t>(fss_font + 0x38ull) == 0) {
            static int fss_skip_texcache_logs = 0;
            if (fss_skip_texcache_logs < 8) {
                fss_skip_texcache_logs++;
                nx::log(\"FSSNULL skip_texcache font=%llx data=%llx\",
                        (unsigned long long)fss_font,
                        fss_font ? (unsigned long long)nx::ld<uint64_t>(fss_font + 0x38ull) : 0ull);
            }
            return;
        }
    }
"""


def main():
    t = open(F, encoding="utf-8", errors="replace", newline="").read()
    if "--restore" in sys.argv:
        if MARK not in t:
            print("nothing to restore")
            return 0
        t = t.replace(NEW, OLD, 1)
        open(F, "w", encoding="utf-8", newline="").write(t)
        print("restored")
        return 0
    if MARK in t:
        print("already applied")
        return 0
    if OLD not in t:
        raise SystemExit("anchor not found in " + F)
    t = t.replace(OLD, NEW, 1)
    open(F, "w", encoding="utf-8", newline="").write(t)
    print("patched")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
