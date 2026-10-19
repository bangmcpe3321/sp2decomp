#!/usr/bin/env python3
import struct, zlib, sys

def ppm_to_png(src, dst):
    f = open(src, "rb")
    magic = f.readline().strip()
    assert magic == b"P6", magic
    line = f.readline()
    while line.startswith(b"#"):
        line = f.readline()
    w, h = map(int, line.split())
    maxv = int(f.readline())
    data = f.read(w * h * 3)
    raw = b""
    for y in range(h):
        raw += b"\x00" + data[y * w * 3:(y + 1) * w * 3]

    def chunk(t, d):
        c = struct.pack(">I", len(d)) + t + d
        c += struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
        return c

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 6))
    png += chunk(b"IEND", b"")
    open(dst, "wb").write(png)
    print("wrote", dst, w, h)

src = sys.argv[1]
dst = sys.argv[2]
ppm_to_png(src, dst)
