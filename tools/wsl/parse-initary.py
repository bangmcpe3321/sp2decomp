#!/usr/bin/env python3
# Properly parse main's FULL init_array (it spans many lines) and look for duplicate entries.
# The duplicate AddVariable registrations prove the same PGV constructor ran twice; the question is
# whether init_array itself lists it twice.
import re, collections, sys

p = "/home/hexa/sp2port/gen/main/table.cpp"
src = open(p, encoding="utf-8", errors="replace").read()

m = re.search(r"init_array\[\]\s*=\s*\{(.*?)\};", src, re.S)
if not m:
    print("init_array not found"); sys.exit(1)
body = m.group(1)
vals = [int(x, 16) for x in re.findall(r"0x[0-9a-fA-F]+", body)]
nz = [v for v in vals if v != 0]

print(f"entries parsed      : {len(vals)}")
print(f"non-zero entries    : {len(nz)}")
print(f"declared init_count : ", end="")
mc = re.search(r"init_array,\s*(\d+)", src)
print(mc.group(1) if mc else "?")

c = collections.Counter(nz)
dups = {k: v for k, v in c.items() if v > 1}
print(f"\nduplicate non-zero entries: {len(dups)}")
for k, v in sorted(dups.items())[:20]:
    print(f"  0x{k:x}  appears {v}x")

print(f"\nfirst 3 : {[hex(x) for x in nz[:3]]}")
print(f"last  3 : {[hex(x) for x in nz[-3:]]}")
