#!/usr/bin/env python3
"""Build a minimal AArch64 ELF (one PT_LOAD) around a raw Switch module image and add a .symtab
from the recompiler's symbol table, so Ghidra can analyze it with real names.

usage: mkelf.py <table.cpp> <module.bin> <base-hex> <out.elf>
"""
import io, re, struct, sys

def parse_symbols(path):
    lines = io.open(path, encoding='utf-8', errors='replace').read().splitlines()
    syms, started = [], False
    for line in lines:
        if 'static const nx::Symbol symbols[] = {' in line:
            started = True
            continue
        if started:
            s = line.strip()
            if s == '};':
                break
            m = re.match(r'\{"([^"]*)", 0x([0-9a-f]+), (\d+), (\d+), (\d+),', s)
            if m:
                syms.append((m.group(1), int(m.group(2), 16), int(m.group(3)), int(m.group(4)), int(m.group(5))))
    return syms

def main():
    table, binpath, base_s, out = sys.argv[1:5]
    base = int(base_s, 16)
    data = io.open(binpath, 'rb').read()
    syms = [s for s in parse_symbols(table)
            if s[1] < len(data) and s[2] > 0 and s[3] in (0, 1, 2) and s[4] != 0]
    # stable order, first occurrence per address wins
    seen, picked = set(), []
    for name, off, size, typ, bind in syms:
        if off in seen:
            continue
        seen.add(off)
        picked.append((name, off, size, typ))
    picked.sort(key=lambda t: t[1])
    print('symbols:', len(picked))

    strtab = bytearray(b'\x00')
    str_off = {}
    symtab = bytearray(24)  # null symbol
    for name, off, size, typ in picked:
        if name not in str_off:
            str_off[name] = len(strtab)
            strtab += name.encode('utf-8') + b'\x00'
        info = (1 << 4) | (2 if typ == 2 else 1)  # GLOBAL, FUNC/OBJECT
        symtab += struct.pack('<IBBHQQ', str_off[name], info, 0, 1, base + off, size)

    shstr = bytearray(b'\x00')
    def shname(s):
        o = len(shstr); shstr.extend(s.encode() + b'\x00'); return o
    n_symtab, n_strtab, n_shstr = shname('.symtab'), shname('.strtab'), shname('.shstrtab')

    ehsize, phentsize, shentsize = 64, 56, 64
    phoff = ehsize
    data_off = phoff + phentsize
    sym_off = data_off + len(data)
    str_off_all = sym_off + len(symtab)
    shstr_off = str_off_all + len(strtab)
    shoff = (shstr_off + len(shstr) + 7) & ~7
    shnum = 4

    ehdr = b'\x7fELF' + bytes([2, 1, 1, 0]) + b'\x00' * 8
    ehdr += struct.pack('<HHIQQQIHHHHHH',
                        2, 183, 1, base, phoff, shoff, 0,
                        ehsize, phentsize, 1, shentsize, shnum, 3)

    phdr = struct.pack('<IIQQQQQQ', 1, 7, data_off, base, base, len(data), len(data), 0x1000)

    sects = bytearray(64)
    sects += struct.pack('<IIQQQQIIQQ', n_symtab, 2, 2, 0, sym_off, len(symtab), 2, 1, 8, 24)
    sects += struct.pack('<IIQQQQIIQQ', n_strtab, 3, 0, 0, str_off_all, len(strtab), 0, 0, 1, 0)
    sects += struct.pack('<IIQQQQIIQQ', n_shstr, 3, 0, 0, shstr_off, len(shstr), 0, 0, 1, 0)

    buf = bytearray()
    buf += ehdr + phdr + data + symtab + strtab + shstr
    buf += b'\x00' * (shoff - len(buf))
    buf += sects
    io.open(out, 'wb').write(buf)
    print('wrote %s (%d bytes, base %#x)' % (out, len(buf), base))

main()
