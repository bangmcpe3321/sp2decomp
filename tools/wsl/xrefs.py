#!/usr/bin/env python3
"""xrefs.py <module> <addr_hex> [calls] -- find code referencing an address (adrp+add/ldr/str),
or direct callers when 'calls' is given."""
import sys

from capstone import Cs, CS_ARCH_ARM64, CS_MODE_LITTLE_ENDIAN
from capstone.arm64 import (
    ARM64_INS_ADD, ARM64_INS_ADRP, ARM64_INS_B, ARM64_INS_BL, ARM64_OP_IMM, ARM64_OP_MEM, ARM64_OP_REG,
)

BASES = {
    'main': 0x7100000000, 'sdk': 0x7101000000, 'subsdk0': 0x7180000000,
    'subsdk1': 0x71c0000000,
}


def main():
    mod, target = sys.argv[1], int(sys.argv[2], 16)
    mode = sys.argv[3] if len(sys.argv) > 3 else 'ref'
    base = BASES[mod]
    data = open('/home/hexa/sp2port/private/analysis/%s.bin' % mod, 'rb').read()
    md = Cs(CS_ARCH_ARM64, CS_MODE_LITTLE_ENDIAN)
    md.detail = True

    if mode == 'calls':
        for insn in md.disasm(data, base):
            if insn.id in (ARM64_INS_BL, ARM64_INS_B) and insn.operands \
                    and insn.operands[0].type == ARM64_OP_IMM and insn.operands[0].imm == target:
                print('%x  %s %s' % (insn.address, insn.mnemonic, insn.op_str))
        return

    regs = {}
    for insn in md.disasm(data, base):
        if insn.id == ARM64_INS_ADRP and len(insn.operands) == 2:
            regs[insn.reg_name(insn.operands[0].reg)] = insn.operands[1].imm
            continue
        if insn.id == ARM64_INS_ADD and len(insn.operands) == 3 \
                and insn.operands[0].type == ARM64_OP_REG and insn.operands[1].type == ARM64_OP_REG \
                and insn.operands[2].type == ARM64_OP_IMM:
            rd = insn.reg_name(insn.operands[0].reg)
            rs = insn.reg_name(insn.operands[1].reg)
            if rs in regs:
                regs[rd] = regs[rs] + insn.operands[2].imm
                if regs[rd] == target:
                    print('%x  %s %s   (%s=%x)' % (insn.address, insn.mnemonic, insn.op_str, rs, target))
            continue
        if insn.mnemonic[:3] in ('ldr', 'str') and insn.operands and insn.operands[0].type == ARM64_OP_REG:
            for op in insn.operands:
                if op.type == ARM64_OP_MEM:
                    rb = insn.reg_name(op.mem.base)
                    if rb in regs and regs[rb] + op.mem.disp == target:
                        print('%x  %s %s   (base %s=%x)' % (insn.address, insn.mnemonic, insn.op_str, rb, target))
                    break


main()
