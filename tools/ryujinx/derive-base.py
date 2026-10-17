#!/usr/bin/env python3
# We are sitting at PC = 0xbe707ac executing `svc #0x1c; ret`. The SDK stub table stores one site per SVC.
# Find that exact stub sequence in the sdk image -> offset -> module base -> svcSetHeapSize address.
import struct, os

PC = 0xbe707ac
IMG = os.path.expanduser("~/sp2port/private/analysis/sdk.bin")
data = open(IMG, "rb").read()

def enc_svc(imm):
    return 0xD4000001 | (imm << 5)

RET = 0xD65F03C0
# stub pattern: svc #imm ; ret  (possibly with a preceding str x0,[sp,#-16]!)
seq = struct.pack("<IIIIII", enc_svc(0x1c), RET, enc_svc(0x1d), RET, enc_svc(0x1e), RET)
print("looking for: svc#0x1c;ret;svc#0x1d;ret;svc#0x1e;ret")
idx = data.find(seq)
print(f"  found at sdk offset: {hex(idx) if idx >= 0 else 'NOT FOUND'}")

if idx >= 0:
    # PC is at the svc #0x1c, which is idx+0... but the observed instruction at PC is svc #0x1c
    sdk_base = PC - idx
    print(f"\n  sdk_base          = 0x{sdk_base:x}")
    print(f"  svcSetHeapSize    = sdk_base + 0x9e660 = 0x{sdk_base + 0x9e660:x}")
    print(f"  HeapMgr::initialize (main) needs main_base:")
    # main and sdk are loaded adjacently by rtld; find main by scanning for MOD0 near sdk_base
    for delta in range(0x1000000, 0x40000000, 0x100000):
        pass
else:
    # try a looser pattern
    for i in range(len(data) - 16):
        pass
    # search just svc #0x1c followed by ret
    p = struct.pack("<II", enc_svc(0x1c), RET)
    idx = data.find(p)
    print(f"  loose (svc#0x1c;ret) at: {hex(idx) if idx>=0 else 'NOT FOUND'}")
    if idx >= 0:
        print(f"  sdk_base = 0x{PC - idx:x}")
        print(f"  svcSetHeapSize = 0x{PC - idx + 0x9e660:x}")
