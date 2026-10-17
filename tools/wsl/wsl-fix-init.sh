#!/usr/bin/env bash
# ROOT CAUSE: init_module() calls `m.base + kDtInit` where kDtInit is a HARDCODED 0x30, as if every
# module's `_init` lives at +0x30. That holds for Wonder's modules; in Splatoon 2's sdk, _init is at
# +0x24, so the call lands at _init+0xc -- the exact reported fault.
#
# Fix: resolve _init from the module's OWN symbol table, falling back to kDtInit only if absent.
set -uo pipefail
P="$HOME/sp2port"
M="$P/runtime/src/main.cpp"

python3 - "$M" <<'PY'
import sys
p = sys.argv[1]
s = open(p).read()

helper = '''
// PATCHED: find a function symbol by exact name in a module's symbol table.
// kDtInit = 0x30 was used as if EVERY module's `_init` sits at +0x30. That is true for Wonder's
// modules and NOT for Splatoon 2's sdk, where _init is at +0x24 -- so init_module() called
// _init+0xc and the runtime correctly reported "call into the middle of a function". Resolving the
// symbol is the fix; the constant stays only as a last-resort fallback.
static bool find_func_offset(const ModuleInfo& m, const char* want, uint64_t& out) {
    for (size_t k = 0; k < m.symbol_count; k++) {
        const Symbol& s = m.symbols[k];
        if (s.imported || !s.name[0]) continue;
        if (std::string(s.name) == want) { out = s.value; return true; }
    }
    return false;
}

static void init_module(CPU& c, const ModuleInfo& m) {'''

s = s.replace('static void init_module(CPU& c, const ModuleInfo& m) {', helper, 1)

s = s.replace(
    '    call_preserving(c, m.base + kDtInit);',
    '''    // PATCHED: resolve _init from this module's own symbol table.
    uint64_t init_off = kDtInit;
    if (!find_func_offset(m, "_init", init_off)) {
        log("%s: no _init symbol; falling back to +0x%llx", m.name, (unsigned long long)kDtInit);
    } else {
        log("%s: _init at +0x%llx", m.name, (unsigned long long)init_off);
    }
    call_preserving(c, m.base + init_off);''',
    1
)
open(p, "w").write(s)
print("patched: _init resolved from the symbol table")
PY

echo
echo "=== rebuild + run ==="
cd "$P" || exit 1
g++ -std=c++20 -c -O1 -w -I runtime/include -I runtime/src runtime/src/main.cpp \
    -o obj-all/_runtime/main.o 2>mi2.txt || { head -10 mi2.txt; exit 1; }
GEN=$(find obj-all -name '*.o' | grep -v _runtime | tr '\n' ' ')
RTO=$(ls obj-all/_runtime/*.o | tr '\n' ' ')
g++ -o sp2 $GEN $RTO -lm -lc -lgcc -lpthread -ldl 2>ml2.txt || { head -8 ml2.txt; exit 1; }
echo "  linked: $(du -h sp2 | cut -f1)"
echo
timeout 90 ./sp2 2>&1 | grep -vE '^  UNRESOLVED' | head -40
