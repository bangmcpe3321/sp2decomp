#!/usr/bin/env python3
"""Desktop: use B10G11R11_UFLOAT_PACK32 for NVN's R11G11B10F (format 0x3f) when the device can render,
blend, filter and copy it, instead of the RGBA16F emulation.

The emulation doubles every HDR load/store/sample (636 MB of 1020 MB live images at the title alone)
and the 6 GB laptop GPU runs out of device memory at the tutorial.  The native format has the same
bits; its negative results become 0 as Maxwell's do.  Android already did this check; this enables
the same check on Windows/Linux.  NX_R11G11B10_EMULATE=1 keeps the old behaviour (the check is
skipped), NX_R11G11B10_NATIVE=0 too.

runtime/src/nvn/nvn_caps.cpp; idempotent (--restore).

Usage: python3 tools/patches/patch-r11-native.py [--restore]   (SP2PORT override)
"""
import os
import sys

ROOT = os.environ.get("SP2PORT", "/home/hexa/sp2port")
F = os.path.join(ROOT, "runtime/src/nvn/nvn_caps.cpp")

MARK = "PATCH-R11-NATIVE"

OLD = """#else
    bool on = false;
#endif
    state.store(on ? 1 : 0, std::memory_order_release);
"""

NEW = """#else
    // PATCH-R11-NATIVE: the same requirements as Android, on desktop too (opt out with NX_R11G11B10_EMULATE=1
    // or NX_R11G11B10_NATIVE=0).  Same bits as NVN's format, and Vulkan converts negatives to 0 as Maxwell does.
    bool on = false;
    const char* native_env = std::getenv("NX_R11G11B10_NATIVE");
    if (vk_physical() && !(native_env && native_env[0] == '0')) {
        const VkFormatFeatureFlags need = VK_FORMAT_FEATURE_COLOR_ATTACHMENT_BIT |
                                          VK_FORMAT_FEATURE_COLOR_ATTACHMENT_BLEND_BIT | VK_FORMAT_FEATURE_SAMPLED_IMAGE_BIT |
                                          VK_FORMAT_FEATURE_SAMPLED_IMAGE_FILTER_LINEAR_BIT |
                                          VK_FORMAT_FEATURE_TRANSFER_SRC_BIT | VK_FORMAT_FEATURE_TRANSFER_DST_BIT;
        VkFormatProperties fp{};
        p_vkGetPhysicalDeviceFormatProperties(vk_physical(), VK_FORMAT_B10G11R11_UFLOAT_PACK32, &fp);
        on = (fp.optimalTilingFeatures & need) == need && !std::getenv("NX_R11G11B10_EMULATE");
        log("nvn/vk: R11G11B10F %s (format features %#x)", on ? "native (B10G11R11_UFLOAT)" : "as RGBA16F",
            unsigned(fp.optimalTilingFeatures));
    }
#endif
    state.store(on ? 1 : 0, std::memory_order_release);
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
