#!/usr/bin/env python3
# Locate the walk's EXIT TEST: the cbz/cbnz/cmp/b.cond near the loop.
# Scan a wide window around 0xd2f1e8 and print only the CONTROL-FLOW / COMPARE instructions.
import struct

IMG = "/home/hexa/sp2port/private/analysis/main.bin"

def classify(w):
    if (w & 0xFFC0001F) == 0xEB00001F:
        return f"cmp  x{(w>>5)&31}, x{(w>>16)&31}    <== REGISTER compare"
    if (w & 0xFFC0001F) == 0xF100001F:
        return f"cmp  x{(w>>5)&31}, #0          <== ZERO compare"
    if (w & 0xFF000000) == 0xB4000000:
        return f"cbz  x{w&31}, +0x{((w>>5)&0x7FFFF)<<2:x}      <== ZERO test (exit?)"
    if (w & 0xFF000000) == 0xB5000000:
        return f"cbnz x{w&31}, +0x{((w>>5)&0x7FFFF)<<2:x}"
    if (w & 0xFF00001F) == 0xD63F0000:
        return f"blr  x{(w>>5)&31}"
    if (w & 0xFF000010) == 0x54000000:
        return f"b.{['eq','ne','cs','cc','mi','pl','vs','vc','hi','ls','ge','lt','gt','le','al','nv'][w&15]} +0x{((w>>5)&0x7FFFF)<<2:x}"
    if (w & 0xFC000000) == 0x14000000:
        return f"b    +0x{((w&0x3FFFFFF)<<2):x}"
    if w == 0xD65F03C0:
        return "ret"
    if (w & 0x7F000000) == 0x34000000:
        return f"cbz  w{w&31}, +0x{((w>>5)&0x7FFFF)<<2:x}"
    return None

start, end = 0xd2f140, 0xd2f1f0
with open(IMG, "rb") as f:
    f.seek(start); raw = f.read(end - start)

print(f"=== control-flow / compares in main+0x{start:x}..0x{end:x} ===\n")
for i in range(0, len(raw), 4):
    w = struct.unpack("<I", raw[i:i+4])[0]
    c = classify(w)
    if c:
        print(f"  0x{start+i:08x}:  0x{w:08x}   {c}")
