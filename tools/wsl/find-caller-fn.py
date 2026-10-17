#!/usr/bin/env python3
# STEP 2: what is sdk+0x86868 -- the caller of svcSetHeapSize?
# Decide: does it have its OWN prologue (a distinct function the port never calls), or does it sit inside a
# larger function (a guard preceding the call)?
import struct, os

IMG = os.path.expanduser("~/sp2port/private/analysis/sdk.bin")
CALLER = 0x86868
data = open(IMG, "rb").read()

def w(off):
    return struct.unpack("<I", data[off:off+4])[0]

def is_prologue(x):
    # stp x29,x30,[sp,#-imm]!  or  sub sp,sp,#imm  or  stp ... [sp,#..]
    if (x & 0xFFC07FFF) == 0xA9807BFD: return "stp x29,x30,[sp,#-N]!"
    if (x & 0xFFC07FFF) == 0xA9007BFD: return "stp x29,x30,[sp,#N]"
    if (x & 0xFFC003FF) == 0xD10003FF: return "sub sp,sp,#N"
    if (x & 0xFFC003FF) == 0xD14003FF: return "add sp,sp,#N"
    return None

print(f"=== sdk+0x{CALLER:x} region (the svcSetHeapSize caller) ===")
# walk backwards to find the nearest function prologue
start = CALLER
for back in range(CALLER, CALLER - 0x400, -4):
    p = is_prologue(w(back))
    if p:
        start = back
        print(f"  nearest prologue looking back: sdk+0x{back:x}  ({p})")
        break
else:
    print("  no prologue found in the previous 0x400 bytes")

print(f"\n=== disassembly from sdk+0x{start:x} to sdk+0x{CALLER+0x30:x} ===")
for off in range(start, CALLER + 0x30, 4):
    x = w(off)
    tag = ""
    if (x & 0xFFE0001F) == 0xD4000001:
        tag = f"   <== svc #{((x>>5)&0xFFFF)}"
    elif (x & 0xFF00001F) == 0xD63F0000:
        tag = f"   <== blr x{(x>>5)&31}"
    elif (x & 0xFC000000) == 0x94000000:
        tgt = off + (((x & 0x3FFFFFF) << 2) ^ 0 and 0)
        imm = x & 0x3FFFFFF
        if imm & 0x2000000: imm -= 0x4000000
        tag = f"   <== bl sdk+0x{off + imm*4:x}"
    elif (x & 0xFC000000) == 0x14000000:
        imm = x & 0x3FFFFFF
        if imm & 0x2000000: imm -= 0x4000000
        tag = f"   <== b  sdk+0x{off + imm*4:x}"
    elif x == 0xD65F03C0:
        tag = "   <== ret"
    mark = " <<< CALLER" if off == CALLER else ""
    print(f"  sdk+0x{off:06x}:  0x{x:08x}{tag}{mark}")
