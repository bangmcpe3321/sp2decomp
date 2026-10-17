#!/usr/bin/env python3
# Read the ORIGINAL AArch64 from the DECOMPRESSED image (exefs/main is LZ4-compressed, so raw file
# offsets give garbage). main.bin is the flat image: VA offset == file offset.
import struct

IMG = "/home/hexa/sp2port/private/analysis/main.bin"

def decode(w):
    if (w & 0xFFC0001F) == 0xEB00001F:
        return f"cmp x{(w>>5)&31}, x{(w>>16)&31}      <== REGISTER compare"
    if (w & 0xFFC0001F) == 0xF100001F:
        return f"cmp x{(w>>5)&31}, #0          <== ZERO compare"
    if (w & 0xFF000000) == 0xB4000000:
        return f"cbz x{w&31}, +0x{((w>>5)&0x7FFFF)<<2:x}     <== ZERO test"
    if (w & 0xFF000000) == 0xB5000000:
        return f"cbnz x{w&31}, +0x{((w>>5)&0x7FFFF)<<2:x}    <== NONZERO test"
    if (w & 0xFF00001F) == 0xD63F0000:
        return f"blr x{(w>>5)&31}              <== indirect call"
    if (w & 0xFF000010) == 0x54000000:
        return f"b.cond {w&15}, +0x{((w>>5)&0x7FFFF)<<2:x}"
    if w == 0xD65F03C0:
        return "ret"
    if (w & 0x9F000000) == 0x90000000:
        return f"adrp x{w&31}, ..."
    if (w & 0xFFC00000) == 0xF9400000:
        return f"ldr x{w&31}, [x{(w>>5)&31}, #{((w>>10)&0xFFF)*8:#x}]"
    if (w & 0xFFC00000) == 0xF9000000:
        return f"str x{w&31}, [x{(w>>5)&31}, #{((w>>10)&0xFFF)*8:#x}]"
    return f".word 0x{w:08x}"

start, end = 0xd2f1e0, 0xd2f240
with open(IMG, "rb") as f:
    f.seek(start)
    raw = f.read(end - start)

print(f"=== AArch64 main+0x{start:x} .. 0x{end:x} (decompressed image) ===\n")
for i in range(0, len(raw), 4):
    w = struct.unpack("<I", raw[i:i+4])[0]
    print(f"  0x{start+i:08x}:  0x{w:08x}   {decode(w)}")
