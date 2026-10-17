#!/usr/bin/env python3
# If main never calls svcSetHeapSize, the SDK startup must. Scan the sdk module's text for every SVC and
# locate svc #1 specifically -- that offset is the real heap setup the port never reaches.
import struct, os
from collections import Counter

for name, img, tsz in [
    ("sdk",  os.path.expanduser("~/sp2port/private/analysis/sdk.bin"),  0x2ce04c),
    ("main", os.path.expanduser("~/sp2port/private/analysis/main.bin"), 0x1415068),
]:
    if not os.path.exists(img):
        print(f"{name}: image not found"); continue
    data = open(img, "rb").read()
    lim = min(tsz, len(data))
    sites = []
    for off in range(0, lim - 3, 4):
        w = struct.unpack("<I", data[off:off+4])[0]
        if (w & 0xFFE0001F) == 0xD4000001:
            sites.append((off, (w >> 5) & 0xFFFF))
    c = Counter(i for _, i in sites)
    print(f"=== {name} (text 0x{lim:x}) : {len(sites)} svc sites ===")
    print("   " + ", ".join(f"#{i}x{n}" for i, n in sorted(c.items())[:14]))
    heap = [o for o, i in sites if i == 1]
    print(f"   svc #1 (SetHeapSize) at: {[hex(o) for o in heap] if heap else 'NONE'}")
    if heap:
        for o in heap[:3]:
            print(f"     --- context around sdk+0x{o:x} ---")
            for k in range(max(0, o-24), o+16, 4):
                w = struct.unpack("<I", data[k:k+4])[0]
                tag = "  <== svc #1" if (w & 0xFFE0001F) == 0xD4000001 and ((w>>5)&0xFFFF)==1 else ""
                print(f"       +0x{k:06x}:  0x{w:08x}{tag}")
    print()
