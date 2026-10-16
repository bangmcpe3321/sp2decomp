# Export a function/symbol/section/string inventory from the analyzed Switch
# module. Runs under Ghidra's PyGhidra (Python 3) or Jython.
# @category REA-Export

import sys

out_path = "inventory.txt"
try:
    args = getScriptArgs()
    if len(args) > 0:
        out_path = args[0]
except Exception:
    pass

prog = currentProgram
# Keep this open() call compatible with both Jython 2.7 and Python 3: the
# `encoding` keyword does not exist on Jython's file object.
try:
    f = open(out_path, "w", encoding="utf-8")
except TypeError:
    f = open(out_path, "w")

f.write("PROGRAM\t%s\n" % prog.getName())
f.write("LANGUAGE\t%s\n" % prog.getLanguageID())
f.write("COMPILER\t%s\n" % prog.getCompilerSpec().getCompilerSpecID())
f.write("IMAGEBASE\t%s\n" % prog.getImageBase())
f.write("MINADDR\t%s\n" % prog.getMinAddress())
f.write("MAXADDR\t%s\n" % prog.getMaxAddress())

block_count = 0
f.write("SECTION\tNAME\tSTART\tEND\tSIZE\tR\tW\tX\tINITIALIZED\n")
for b in prog.getMemory().getBlocks():
    f.write("SECTION\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n" % (
        b.getName(), b.getStart(), b.getEnd(), b.getSize(),
        b.isRead(), b.isWrite(), b.isExecute(), b.isInitialized()))
    block_count += 1

fn_count = 0
try:
    fns = prog.getFunctionManager().getFunctions(True)
    for fn in fns:
        try:
            sig = fn.getPrototypeString(False, False)
        except Exception:
            sig = "<no signature>"
        sig = sig.replace("\t", " ").replace("\n", " ").replace("\r", " ")
        f.write("FUNCTION\t%s\t%s\t%s\t%s\t%s\t%s\n" % (
            fn.getEntryPoint(), fn.getName(), fn.getBody().getNumAddresses(),
            "thunk" if fn.isThunk() else "normal",
            "external" if fn.isExternal() else "internal", sig))
        fn_count += 1
except Exception as e:
    f.write("FUNCTION_ERROR\t%s\n" % e)

sym_count = 0
try:
    syms = prog.getSymbolTable().getAllSymbols(True)
    for s in syms:
        nm = s.getName()
        if not nm:
            continue
        f.write("SYMBOL\t%s\t%s\t%s\n" % (s.getAddress(), s.getSymbolType(), nm.replace("\t", " ")))
        sym_count += 1
except Exception as e:
    f.write("SYMBOL_ERROR\t%s\n" % e)

str_count = 0
try:
    data = prog.getListing().getDefinedData(True)
    for d in data:
        v = d.getValue()
        if v is None:
            continue
        sv = str(v)
        if len(sv) < 4:
            continue
        if not isinstance(v, str):
            continue
        f.write("STRING\t%s\t%s\t%s\n" % (
            d.getAddress(), d.getLength(),
            sv.replace("\t", " ").replace("\n", "\\n").replace("\r", "")))
        str_count += 1
except Exception as e:
    f.write("STRING_ERROR\t%s\n" % e)

f.write("SUMMARY\tfunctions=%d\tsymbols=%d\tstrings=%d\tblocks=%d\n" % (
    fn_count, sym_count, str_count, block_count))
f.close()

print("ExportInventory wrote %s (functions=%d symbols=%d strings=%d)" % (
    out_path, fn_count, sym_count, str_count))
