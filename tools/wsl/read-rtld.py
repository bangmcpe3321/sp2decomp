#!/usr/bin/env python3
# READ SPLATOON 2's REAL START-UP. The exefs contains `rtld` (13,040 bytes) -- the module that on hardware
# runs FIRST, maps the modules, sets up process memory and calls the program entry. This port never loaded it.
# Decompress it and scan for every SVC, which tells us immediately whether it calls svcSetHeapSize (svc #1).
import struct, subprocess, sys, os

E = "/mnt/c/Users/Hexa/Documents/nintendo/hactool-1.4.0-win/exefs/rtld"
OUT = os.path.expanduser("~/rtld.bin")

if not os.path.exists(OUT):
    r = subprocess.run([sys.executable, os.path.expanduser("~/refs/wonder/tools/nso2bin.py"), E, OUT],
                       capture_output=True, text=True)
    print("nso2bin:", r.returncode, (r.stdout or r.stderr)[:300])
else:
    print("using existing", OUT)

data = open(OUT, "rb").read()
print(f"image size: {len(data)} bytes")

# NSO0 header: text_size at 0x10, offsets of text/ro/data at 0x20/.. -- but scan the whole text region.
text_size = struct.unpack("<I", data[0x10:0x14])[0] if data[:4] == b"NSO0" else None
print("magic:", data[:4], " text_size:", hex(text_size) if text_size else "n/a")

# The decompressed image from nso2bin is the flat module image; text starts at 0.
limit = min(len(data), text_size or len(data))

svcs = []
for off in range(0, limit - 3, 4):
    w = struct.unpack("<I", data[off:off+4])[0]
    if (w & 0xFFE0001F) == 0xD4000001:          # svc #imm
        imm = (w >> 5) & 0xFFFF
        svcs.append((off, imm))

print(f"\nsvc instructions in text: {len(svcs)}")
from collections import Counter
c = Counter(i for _, i in svcs)
for imm, n in sorted(c.items()):
    print(f"  svc #{imm:<3} (0x{imm:02x})  x{n}")

print("\n=== first 24 svc sites ===")
for off, imm in svcs[:24]:
    print(f"  +0x{off:06x}  svc #{imm}")
