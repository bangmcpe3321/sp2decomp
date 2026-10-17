#!/usr/bin/env python3
# Is NVN statically linked into Splatoon 2, or resolved externally at runtime?
# Decision matters enormously:
#   - if NVN code is IN the game  -> we only need nvdrv/nvhost/nvmap ioctl handlers (Ryujinx's layer)
#   - if NVN is resolved by name  -> we must implement the 453 NVN API functions ourselves
import re, os, collections

T = os.path.expanduser("~/sp2port/gen/main/table.cpp")
src = open(T, encoding="utf-8", errors="replace").read()

# symbol entries look like: {"name", 0xOFF, size, type, ?, imported}
pat = re.compile(r'\{"([^"]+)",\s*0x([0-9a-f]+),\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+)\}')
entries = pat.findall(src)
print(f"symbol entries parsed: {len(entries)}")

def look(tag, pred):
    hits = [e for e in entries if pred(e[0])]
    defs = [e for e in hits if int(e[1], 16) != 0]
    imps = [e for e in hits if int(e[1], 16) == 0]
    print(f"\n=== {tag} ===")
    print(f"  total {len(hits)}   with offset!=0 (DEFINED) {len(defs)}   with offset==0 (IMPORTED) {len(imps)}")
    for e in hits[:6]:
        kind = "DEF" if int(e[1], 16) else "IMP"
        print(f"    [{kind}] {e[1]:>10}  size={e[2]:>6}  {e[0][:70]}")
    return defs, imps

look("nvn* API names", lambda n: n.startswith("nvn") or n.startswith("_ZN2nv"))
look("nvdrv / nvhost / nvmap services", lambda n: "nvdrv" in n or "nvhost" in n or "nvmap" in n or "nvdisp" in n)

# raw string search in the decompressed images
for name, img in [("main", "~/sp2port/private/analysis/main.bin"),
                  ("sdk",  "~/sp2port/private/analysis/sdk.bin")]:
    p = os.path.expanduser(img)
    if not os.path.exists(p):
        continue
    d = open(p, "rb").read()
    print(f"\n=== raw string presence in {name} ===")
    for s in [b"nvnBootstrapLoader", b"nvdrv", b"nvhost-ctrl-gpu", b"nvmap", b"nvnDeviceInitialize",
              b"/dev/nvhost", b"nvdisp"]:
        print(f"  {s.decode():<24} {d.count(s)}")
