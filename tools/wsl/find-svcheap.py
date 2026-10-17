#!/usr/bin/env python3
# WHERE is svcSetHeapSize in the game? We call _init at +0x24 and nnMain, and the trace showed ZERO svc #1
# calls. If a svc #1 exists in main's text, its offset tells us which start-up code we are skipping.
import struct, os

IMG = os.path.expanduser("~/sp2port/private/analysis/main.bin")
data = open(IMG, "rb").read()
text_size = 0x1415068            # main's text size from the NSO segments

hits = []
for off in range(0, min(text_size, len(data)) - 3, 4):
    w = struct.unpack("<I", data[off:off+4])[0]
    if (w & 0xFFE0001F) == 0xD4000001:
        imm = (w >> 5) & 0xFFFF
        if imm == 1:
            hits.append(off)

print(f"main text size          : 0x{text_size:x}")
print(f"svc #1 (SetHeapSize) sites: {len(hits)}")
for o in hits:
    print(f"   main+0x{o:x}")

print("\n=== first 0x60 bytes of main's text (the entry region we may be skipping) ===")
for off in range(0, 0x60, 4):
    w = struct.unpack("<I", data[off:off+4])[0]
    tag = ""
    if (w & 0xFFE0001F) == 0xD4000001:
        tag = f"   <== svc #{(w>>5)&0xFFFF}"
    elif (w & 0xFF00001F) == 0xD63F0000:
        tag = "   <== blr x%d" % ((w>>5)&31)
    elif w == 0xD65F03C0:
        tag = "   <== ret"
    elif (w & 0xFC000000) == 0x14000000:
        tag = "   <== b +0x%x" % ((w & 0x3FFFFFF) << 2)
    print(f"   main+0x{off:04x}:  0x{w:08x}{tag}")
