# Decompile specific functions from an already-analysed program and write their
# pseudocode to a file. Cheap to run because analysis is already complete.
#
# @category REA-Export

import os

out_path = "decompiled.txt"
targets = []

try:
    a = getScriptArgs()
    if len(a) > 0 and a[0]:
        out_path = a[0]
    if len(a) > 1 and a[1]:
        targets = [int(x, 16) for x in a[1].split(",") if x.strip()]
except Exception:
    pass

DEFAULT = [
    0x710090AB30,  # Game::PlayerInkAction::shotBullet_B
    0x71011F5B20,  # Lp::Sys::SysInit::Init
    0x71011F5AB4,  # Lp::Sys::SysInit::nninitStartup
    0x7100E6724C,  # sead::GameFrameworkNx::initialize
    0x7101375144,  # nn::ui2d::Pane::Pane()
]
if not targets:
    targets = DEFAULT

prog = currentProgram
fm = prog.getFunctionManager()
af = prog.getAddressFactory().getDefaultAddressSpace()


def demangle(name):
    try:
        from ghidra.app.util.demangler import DemanglerUtil
        d = DemanglerUtil.demangle(prog, name)
        if d is not None:
            return d.getDemangledName()
    except Exception:
        pass
    return name


f = open(out_path, "w")
try:
    f.write("Decompiled functions from %s\n" % prog.getName())
    f.write("language: %s\n" % prog.getLanguageID())
    f.write("image base: %s\n\n" % prog.getImageBase())

    from ghidra.app.decompiler import DecompInterface
    di = DecompInterface()
    di.openProgram(prog)

    total = 0
    for va in targets:
        addr = af.getAddress(va)
        fn = fm.getFunctionContaining(addr) if addr is not None else None
        f.write("=" * 78 + "\n")
        if fn is None:
            f.write("0x%x  NO FUNCTION\n\n" % va)
            continue
        total += 1
        f.write("0x%x  %s\n" % (va, fn.getName()))
        f.write("  demangled: %s\n" % demangle(fn.getName()))
        f.write("  entry    : %s\n" % fn.getEntryPoint())
        try:
            f.write("  body size: %d bytes\n" % fn.getBody().getNumAddresses())
        except Exception:
            pass
        f.write("-" * 78 + "\n")
        res = di.decompileFunction(fn, 120, monitor)
        if res is not None and res.decompileCompleted():
            f.write(res.getDecompiledFunction().getC())
        else:
            msg = res.getErrorMessage() if res is not None else "no result"
            f.write("<decompilation failed: %s>\n" % msg)
        f.write("\n\n")
    di.dispose()
    f.write("functions decompiled: %d of %d requested\n" % (total, len(targets)))
finally:
    f.close()

print("ExtractDecompiled wrote %s" % out_path)
