#!/usr/bin/env bash
# Wire up REA + the existing Ghidra install on the Linux side and test whether the
# provider now accepts this target (Linux should not carry the Windows PE/6502
# restriction that blocked the same call earlier).
set -uo pipefail

export PATH="$HOME/tools/node/bin:$HOME/.npm-global/bin:$PATH"
export JAVA_HOME="$HOME/tools/jdk21"
export GHIDRA_INSTALL_DIR="/mnt/c/Users/Hexa/Documents/nintendo/ghidra_12.1.2_PUBLIC_20260605/ghidra_12.1.2_PUBLIC"

echo "== toolchain =="
echo "  node   : $(node --version)"
echo "  java   : $("$JAVA_HOME/bin/java" --version 2>&1 | head -1)"
echo "  ghidra : $GHIDRA_INSTALL_DIR"
echo "  exists : $([ -d "$GHIDRA_INSTALL_DIR" ] && echo yes || echo NO)"

echo
echo "== rea doctor: ghidra checks =="
timeout 600 rea doctor --json 2>&1 > /tmp/rea-doctor.json
python3 - <<'PY'
import json
d = json.load(open('/tmp/rea-doctor.json'))
for c in d.get('checks', []):
    if 'ghidra' in c.get('name','') or c.get('name') in ('host','java'):
        print(f"  {c['name']:<28} ok={c['ok']}  {c.get('detail','')[:90]}")
for p in d.get('providerInspections', []):
    if p.get('id') == 'ghidra':
        print(f"  provider ghidra: configured={p['configured']} available={p['available']} version={p.get('providerVersion')}")
PY

echo
echo "== capability probe: does Linux accept an ELF/AArch64 target? =="
TARGET="/mnt/c/Users/Hexa/Documents/nintendo/re-work/main.converted.elf"
echo "  target: $TARGET"
echo "  exists: $([ -f "$TARGET" ] && echo yes || echo NO)"
timeout 900 rea inspect "$TARGET" --provider ghidra --format json 2>&1 | head -c 2500
echo
