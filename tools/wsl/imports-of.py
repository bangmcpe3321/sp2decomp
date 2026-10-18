#!/usr/bin/env python3
"""List the import calls of one function with resolved names.

usage: imports-of.py <module> <start_hex> <size_hex>

Reads ~/sp2port/private/analysis/<module>.bin and ~/sp2port/gen/<module>/table.cpp,
disassembles [start, start+size), and resolves every BL into the module's thunk region
(adrp/ldr/br stubs) through the JUMP_SLOT relocs + symbol table.
"""
import re
import sys

from capstone import Cs, CS_ARCH_ARM64, CS_MODE_LITTLE_ENDIAN
from capstone.arm64 import ARM64_INS_B, ARM64_INS_BL, ARM64_OP_IMM, ARM64_OP_MEM

BASES = {
    'main': 0x7100000000, 'sdk': 0x7101000000, 'subsdk0': 0x7180000000,
    'subsdk1': 0x71c0000000,
}


def main():
    mod, start_s, size_s = sys.argv[1], sys.argv[2], sys.argv[3]
    start, size = int(start_s, 16), int(size_s, 16)
    base = BASES[mod]
    data = open('/home/hexa/sp2port/private/analysis/%s.bin' % mod, 'rb').read()

    t = open('/home/hexa/sp2port/gen/%s/table.cpp' % mod).read()
    i = t.index('nx::Symbol symbols[]')
    j = t.index('};', i)
    syms = [l.strip().rstrip(',') for l in t[i:j].splitlines() if l.strip().startswith('{')]
    relocs = {}
    for m in re.finditer(r'\{(0x[0-9a-f]+), (\d+), (\d+),', t):
        relocs[int(m.group(1), 16)] = int(m.group(3))

    md = Cs(CS_ARCH_ARM64, CS_MODE_LITTLE_ENDIAN)
    md.detail = True
    lo, hi = base + 0x1400000, base + 0x1500000  # thunk region (all modules use +0x14xxxxx)

    off = start - base
    for insn in md.disasm(data[off:off + size], start):
        if insn.id not in (ARM64_INS_BL, ARM64_INS_B):
            continue
        if not insn.operands or insn.operands[0].type != ARM64_OP_IMM:
            continue
        tgt = insn.operands[0].imm
        if not (lo <= tgt < hi):
            continue
        th = data[tgt - base:tgt - base + 12]
        page = slot = None
        for ti in md.disasm(th, tgt):
            if ti.mnemonic == 'adrp':
                page = ti.operands[1].imm
            elif ti.mnemonic == 'ldr' and ti.operands[1].type == ARM64_OP_MEM:
                slot = page + ti.operands[1].mem.disp
                break
        name = '?'
        if slot is not None:
            si = relocs.get(slot - base)
            if si is not None and si < len(syms):
                name = syms[si].split('"')[1]
        print('%x  = func+%-5x bl %-18s -> %s' % (insn.address, insn.address - start, hex(tgt), name))


main()
