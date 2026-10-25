"""Region stats + colour spread for a PNG (RGB8, filter 0..4) without third-party libs.

usage: pngstats.py file.png x y w h
"""
import struct
import sys
import zlib


def load(path):
    d = open(path, 'rb').read()
    assert d[:8] == b'\x89PNG\r\n\x1a\n'
    i = 8
    w = h = None
    idat = b''
    while i < len(d):
        ln = struct.unpack('>I', d[i:i + 4])[0]
        typ = d[i + 4:i + 8]
        body = d[i + 8:i + 8 + ln]
        if typ == b'IHDR':
            w, h, bd, ct = struct.unpack('>IIBB', body[:10])
            assert bd == 8 and ct == 2, (bd, ct)
        elif typ == b'IDAT':
            idat += body
        i += 12 + ln
    raw = zlib.decompress(idat)
    stride = w * 3
    rows = []
    prev = bytearray(stride)
    p = 0
    for y in range(h):
        ft = raw[p]; p += 1
        cur = bytearray(raw[p:p + stride]); p += stride
        if ft == 1:
            for x in range(3, stride):
                cur[x] = (cur[x] + cur[x - 3]) & 255
        elif ft == 2:
            for x in range(stride):
                cur[x] = (cur[x] + prev[x]) & 255
        elif ft == 3:
            for x in range(stride):
                a = cur[x - 3] if x >= 3 else 0
                cur[x] = (cur[x] + ((a + prev[x]) >> 1)) & 255
        elif ft == 4:
            for x in range(stride):
                a = cur[x - 3] if x >= 3 else 0
                b = prev[x]
                c = prev[x - 3] if x >= 3 else 0
                pp = a + b - c
                pa, pb, pc = abs(pp - a), abs(pp - b), abs(pp - c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                cur[x] = (cur[x] + pr) & 255
        rows.append(cur)
        prev = cur
    return w, h, rows


def main():
    path = sys.argv[1]
    x, y, cw, ch = (int(v) for v in sys.argv[2:6])
    w, h, rows = load(path)
    px = []
    for r in range(y, min(y + ch, h)):
        row = rows[r]
        for c in range(x, min(x + cw, w)):
            px.append((row[c * 3], row[c * 3 + 1], row[c * 3 + 2]))
    n = len(px)
    nz = sum(1 for p in px if p != (0, 0, 0))
    mean = sum(sum(p) for p in px) / (3.0 * n)
    lum = sorted(sum(p) / 3.0 for p in px)
    print('%s  region (%d,%d %dx%d)' % (path, x, y, cw, ch))
    print('  non-black %d/%d (%.2f%%)  mean %.1f  median luma %.1f  p10 %.1f  p90 %.1f' %
          (nz, n, 100.0 * nz / n, mean, lum[n // 2], lum[n // 10], lum[9 * n // 10]))
    cols = set()
    for i in range(0, n, 7):
        c = px[i]
        cols.add((c[0] >> 3, c[1] >> 3, c[2] >> 3))
    print('  distinct colours (5-bit): %d' % len(cols))
    xy = px
    sat = sum(1 for p in xy if max(p) - min(p) > 20)
    print('  saturated (max-min>20): %.1f%%' % (100.0 * sat / n))


main()
