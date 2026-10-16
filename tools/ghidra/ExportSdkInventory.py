# Export every named function and symbol from an analysed sdk program.
#
# The sdk artefact is much smaller than main and DOES carry MOD0 export names, so
# this gives real names for the platform functions rather than FUN_*.
# @category REA-Export

out_path = "sdk-inventory.tsv"

try:
    a = getScriptArgs()
    if len(a) > 0 and a[0]:
        out_path = a[0]
except Exception:
    pass

prog = currentProgram
fm = prog.getFunctionManager()
st = prog.getSymbolTable()

f = open(out_path, "w")
try:
    f.write("KIND\tADDRESS\tSIZE\tNAME\n")

    # functions with bodies
    nfun = 0
    for fn in fm.getFunctions(True):
        try:
            size = fn.getBody().getNumAddresses()
        except Exception:
            size = -1
        f.write("FUNCTION\t%s\t%d\t%s\n" % (fn.getEntryPoint(), size, fn.getName()))
        nfun += 1

    # every symbol, which is where the MOD0/module names live
    nsym = 0
    for s in st.getAllSymbols(True):
        nm = s.getName()
        if not nm:
            continue
        f.write("SYMBOL\t%s\t0\t%s\n" % (s.getAddress(), nm))
        nsym += 1

    f.write("SUMMARY\tfunctions=%d\tsymbols=%d\n" % (nfun, nsym))
finally:
    f.close()

print("ExportSdkInventory wrote %s" % out_path)
