#!/usr/bin/env bash
# Round 3 increment: two precisely-specified changes to runtime/src/main.cpp.
#
#   1. Register ALL SIX modules. boot() hardcoded two; Splatoon 2 has six, and the other four were
#      compiled and linked but never loaded. (Sibling of the g_fast[4] issue.)
#   2. Teach the boot Splatoon 2's older entry convention. Splatoon 2's SDK predates
#      nn::init::Start -- it exports no such symbol -- so instead of a fatal error, fall back to
#      calling the game's own nnMain through the existing nnMain HLE hook.
set -uo pipefail
M="$HOME/sp2port/runtime/src/main.cpp"
cp -f "$M" "$M.orig"

python3 - "$M" <<'PY'
import sys, re
p = sys.argv[1]
s = open(p).read()

# --- 1. six modules -------------------------------------------------------------------------
s = s.replace(
    '    const ModuleInfo* mods[] = {&nx_module_main, &nx_module_sdk};\n'
    '    load_modules(mods, 2, plat::data_root() + "/analysis");',
    '    // PATCHED: Splatoon 2 has SIX modules. The stock list registers two, so the four subsdk\n'
    '    // modules were compiled and linked but never loaded (sibling of the g_fast[4] issue).\n'
    '    extern const ModuleInfo nx_module_subsdk0, nx_module_subsdk1, nx_module_subsdk2, nx_module_subsdk3;\n'
    '    const ModuleInfo* mods[] = {&nx_module_main, &nx_module_sdk,\n'
    '                                &nx_module_subsdk0, &nx_module_subsdk1,\n'
    '                                &nx_module_subsdk2, &nx_module_subsdk3};\n'
    '    load_modules(mods, 6, plat::data_root() + "/analysis");'
)

# --- 2. older-SDK entry fallback --------------------------------------------------------------
old = '''    } else {
        fatal("nn::init::Start not found");
    }'''
new = '''    } else {
        // PATCHED: Splatoon 2's SDK PREDATES nn::init::Start -- it exports no such symbol at all
        // (its whole nn::init surface is GetAllocator/InitializeAllocator and two thread-local
        // allocator helpers). Wonder's runtime treats that as fatal. For an older SDK the game is
        // entered through its own nnMain, which the nnMain HLE hook already knows how to call
        // (it runs the modules' constructors, then the real nnMain).
        log("nn::init::Start absent -- older SDK; entering through nnMain");
        c.x[30] = hle_address("__process_return");
        call(c, hle_address("nnMain"));
        log("returned from nnMain");
        return;
    }'''
if old not in s:
    print("ANCHOR 2 NOT FOUND", file=sys.stderr)
    sys.exit(1)
s = s.replace(old, new)

open(p, "w").write(s)
print("patched main.cpp")
PY

echo
echo "=== verify the two edits ==="
grep -n 'load_modules(mods, 6' "$M" && echo "  6 modules: OK"
grep -n 'older SDK; entering through nnMain' "$M" && echo "  nnMain fallback: OK"
