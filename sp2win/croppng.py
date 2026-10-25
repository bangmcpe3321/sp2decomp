"""Crop a PPM (P6) and write a PNG, then report pixel stats for the crop.

usage: crop.py in.ppm out.png x y w h
"""
import struct
import sys
import zlib


def read_ppm(path):
    f = open(path, 'rb')
    assert f.readline().strip() == b'P6'
    line = f.readline()
    while line.startswith(b'#'):
        line = f.readline()
    w, h = map(int, line.split())
    assert int(f.readline()) == 255
    return w, h, f.read(w * h * 3)


def write_png(path, w, h, rows):
    raw = b''.join(b'\x00' + r for r in rows)

    def chunk(t, d):
        c = struct.pack('>I', len(d)) + t + d
        return c + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)

    png = b'\x89PNG\r\n\x1a\n'
    png += chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(raw, 6))
    png += chunk(b'IEND', b'')
    open(path, 'wb').write(png)


def main():
    src, dst = sys.argv[1], sys.argv[2]
    x, y, cw, ch = (int(v) for v in sys.argv[3:7])
    w, h, data = read_ppm(src)
    x = max(0, min(x, w - 1)); y = max(0, min(y, h - 1))
    cw = min(cw, w - x); ch = min(ch, h - y)
    rows = [data[(y + r) * w * 3 + x * 3:(y + r) * w * 3 + (x + cw) * 3] for r in range(ch)]
    write_png(dst, cw, ch, rows)
    nz = sum(1 for b in b''.join(rows) if b)
    tot = cw * ch * 3
    mean = sum(b''.join(rows)) / tot
    print('wrote %s %dx%d non-zero=%d/%d (%.2f%%) mean=%.2f' %
          (dst, cw, ch, nz, tot, 100.0 * nz / tot, mean))
    # count distinct colours and the hue spread, to show it is not a flat fill
    cols = set()
    for r in range(0, ch, 4):
        row = rows[r]
        for c in range(0, cw, 4):
            cols.add(row[c * 3:c * 3 + 3])
    print('distinct sampled colours: %d' % len(cols))


main()
