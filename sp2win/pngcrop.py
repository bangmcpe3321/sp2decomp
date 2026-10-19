#!/usr/bin/env python3
"""Decode a PNG (8-bit RGB/RGBA, non-interlaced) and crop+zoom a region to a new PNG."""
import sys, zlib, struct

def decode_png(path):
    data = open(path, "rb").read()
    assert data[:8] == b"\x89PNG\r\n\x1a\n"
    i = 8
    idat = b""
    w = h = bitd = ctype = None
    while i < len(data):
        ln = struct.unpack(">I", data[i:i + 4])[0]
        tag = data[i + 4:i + 8]
        body = data[i + 8:i + 8 + ln]
        if tag == b"IHDR":
            w, h, bitd, ctype = struct.unpack(">IIBB", body[:10])
        elif tag == b"IDAT":
            idat += body
        elif tag == b"IEND":
            break
        i += 12 + ln
    assert bitd == 8 and ctype in (2, 6), (bitd, ctype)
    bpp = 3 if ctype == 2 else 4
    raw = zlib.decompress(idat)
    stride = w * bpp
    out = bytearray(h * stride)
    prev = bytearray(stride)
    pos = 0
    for y in range(h):
        f = raw[pos]; pos += 1
        line = bytearray(raw[pos:pos + stride]); pos += stride
        if f == 1:
            for x in range(bpp, stride):
                line[x] = (line[x] + line[x - bpp]) & 0xff
        elif f == 2:
            for x in range(stride):
                line[x] = (line[x] + prev[x]) & 0xff
        elif f == 3:
            for x in range(stride):
                a = line[x - bpp] if x >= bpp else 0
                line[x] = (line[x] + ((a + prev[x]) >> 1)) & 0xff
        elif f == 4:
            for x in range(stride):
                a = line[x - bpp] if x >= bpp else 0
                b = prev[x]
                c = prev[x - bpp] if x >= bpp else 0
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[x] = (line[x] + pr) & 0xff
        out[y * stride:(y + 1) * stride] = line
        prev = line
    return w, h, bpp, bytes(out)

def write_png(path, w, h, rgb):
    rows = b"".join(b"\x00" + rgb[y * w * 3:(y + 1) * w * 3] for y in range(h))
    def chunk(tag, d):
        return struct.pack(">I", len(d)) + tag + d + struct.pack(">I", zlib.crc32(tag + d) & 0xffffffff)
    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(rows, 9))
    png += chunk(b"IEND", b"")
    open(path, "wb").write(png)

def main():
    src, x, y, cw, ch, scale, out = sys.argv[1:8]
    x, y, cw, ch, scale = int(x), int(y), int(cw), int(ch), int(scale)
    w, h, bpp, px = decode_png(src)
    cw = min(cw, w - x); ch = min(ch, h - y)
    o = bytearray()
    for yy in range(ch * scale):
        sy = y + yy // scale
        for xx in range(cw * scale):
            sx = x + xx // scale
            o += px[(sy * w + sx) * bpp:(sy * w + sx) * bpp + 3]
    write_png(out, cw * scale, ch * scale, bytes(o))
    print("wrote %s (%dx%d) from %s @ %d,%d %dx%d x%d" % (out, cw * scale, ch * scale, src, x, y, cw, ch, scale))

main()
