#!/usr/bin/env python3
"""PPM stats + PNG conversion (optional downscale)."""
import sys


def read_ppm(path):
    d = open(path, "rb").read()
    parts, i = [], 0
    while len(parts) < 4:
        while d[i:i + 1].isspace():
            i += 1
        if d[i:i + 1] == b"#":
            while d[i:i + 1] != b"\n":
                i += 1
            continue
        j = i
        while not d[j:j + 1].isspace():
            j += 1
        parts.append(d[i:j])
        i = j
    i += 1
    w, h = int(parts[1]), int(parts[2])
    return w, h, d[i:i + w * h * 3]


path = sys.argv[1]
w, h, pix = read_ppm(path)
n = w * h
nz = 0
mx = 0
acc = 0
for k in range(0, len(pix), 3):
    v = pix[k]
    if v:
        nz += 1
    if v > mx:
        mx = v
    acc += v
print("%s: %dx%d non-zero=%d/%d (%.3f%%) max=%d mean=%.2f" % (path, w, h, nz, n, 100.0 * nz / n, mx, acc / n))
