#!/usr/bin/env bash
# ROUND 6'S HYPOTHESIS CONFIRMED: Splatoon 2's SDK is the OLD nnos* C API era (121 distinct nnos*
# symbols), and it exports `nnosInitialize` -- the system initialisation that sets up mutexes,
# thread pointers and TLS. The port calls nnMain WITHOUT it, which is exactly why
# nn::os::LockMutex found uninitialised state at +0x1b8.
#
# Fix: call nnosInitialize() before nnMain.
set -uo pipefail
P="$HOME/sp2port"
M="$P/runtime/src/main.cpp"

echo "=== where is nnosInitialize? ==="
for t in "$P"/gen/*/table.cpp; do
  grep -o '{"nnosInitialize"[^}]*}' "$t" 2>/dev/null | head -2 | sed "s|^|  $(basename "$(dirname "$t")"): |"
done
grep -n '"nnosInitialize"' "$P/gen"/*/table.cpp 2>/dev/null | head -3

python3 - "$M" <<'PY'
import sys
p = sys.argv[1]
s = open(p).read()

old = '''        log("nn::init::Start absent -- older SDK; entering through nnMain");
        c.x[30] = hle_address("__process_return");
        call(c, hle_address("nnMain"));
        log("returned from nnMain");
        return;'''
new = '''        // Splatoon 2's SDK is the OLD nnos* C API era (121 distinct nnos* symbols) and exports
        // `nnosInitialize` -- the system initialisation that sets up mutexes, thread pointers and
        // TLS. Round 6 found nn::os::LockMutex crashing on uninitialised state precisely because
        // the port entered at nnMain WITHOUT it. Run it first.
        log("nn::init::Start absent -- older SDK; running nnosInitialize, then nnMain");
        uint64_t nnos_init = 0;
        for (const ModuleInfo* mod : { &nx_module_main, &nx_module_sdk }) {
            if (find_func_offset(*mod, "nnosInitialize", nnos_init)) {
                log("nnosInitialize at %s", describe(mod->base + nnos_init).c_str());
                call_preserving(c, mod->base + nnos_init);
                log("nnosInitialize returned");
                break;
            }
        }
        if (!nnos_init) log("nnosInitialize NOT FOUND -- entering nnMain cold (expected to fault)");
        c.x[30] = hle_address("__process_return");
        call(c, hle_address("nnMain"));
        log("returned from nnMain");
        return;'''
if old not in s:
    print("ANCHOR NOT FOUND", file=sys.stderr)
    sys.exit(1)
s = s.replace(old, new)
open(p, "w").write(s)
print("patched: nnosInitialize before nnMain")
PY

echo
echo "=== rebuild + run ==="
cd "$P" || exit 1
g++ -std=c++20 -c -O1 -w -I runtime/include -I runtime/src runtime/src/main.cpp \
    -o obj-all/_runtime/main.o 2>mi3.txt || { head -10 mi3.txt; exit 1; }
GEN=$(find "$P/obj-all" -name '*.o' | grep -v _runtime | tr '\n' ' ')
RTO=$(ls "$P"/obj-all/_runtime/*.o | tr '\n' ' ')
g++ -o "$P/sp2" $GEN $RTO -lm -lc -lgcc -lpthread -ldl 2>ml3.txt || { head -8 ml3.txt; exit 1; }
echo "  linked: $(du -h "$P/sp2" | cut -f1)"
echo
timeout 90 "$P/sp2" 2>&1 | grep -vE '^  UNRESOLVED' | head -40
