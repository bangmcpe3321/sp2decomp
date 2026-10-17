#!/usr/bin/env bash
set -uo pipefail
cd "$HOME/sp2port/runtime" || exit 1

echo "=== where are the nx:: helpers (ld, st, subs32, call, V128) implemented? ==="
grep -rln 'void call(CPU&' src/ 2>/dev/null
grep -rln 'nx::subs32\|uint64_t subs32\|void subs32' src/ include/ 2>/dev/null | head -6

echo
echo "=== nx/cpu.h: what it declares (the surface a harness must provide) ==="
grep -nE '^(inline|void|uint|int|bool|struct|using|namespace|template)' include/nx/cpu.h 2>/dev/null | head -34

echo
echo "=== is ld/st/vzero header-inline or out-of-line? ==="
grep -n 'ld(' include/nx/cpu.h 2>/dev/null | head -4
grep -n 'vzero' include/nx/cpu.h 2>/dev/null | head -4

echo
echo "=== main.cpp: how Wonder starts the guest ==="
sed -n '1,40p' src/main.cpp 2>/dev/null
