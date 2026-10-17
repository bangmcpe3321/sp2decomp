#!/usr/bin/env bash
set -uo pipefail
cd "$HOME/sp2port" || exit 1
python3 - <<'PY'
p = "runtime/src/platform_linux.cpp"
s = open(p).read()
old = "#include <execinfo.h>\n#include <signal.h>"
new = "#include <signal.h>\n\n#include <nx/cpu.h>\n#include <nx/runtime.h>"
if old in s:
    s = s.replace(old, new, 1)
else:
    # include may already have been moved
    if "<nx/cpu.h>" not in s:
        s = s.replace("#include <signal.h>", "#include <signal.h>\n#include <nx/cpu.h>\n#include <nx/runtime.h>", 1)
# backtrace() is glibc's execinfo; keep it optional
if "backtrace(frames" in s and "execinfo" not in s:
    s = s.replace("void* frames[32];", "void* frames[32]; // execinfo.h is glibc-only; declared here")
open(p, "w").write(s)
print("includes fixed")
PY

echo "=== declare backtrace() if execinfo is absent ==="
python3 - <<'PY'
p = "runtime/src/platform_linux.cpp"
s = open(p).read()
if "extern \"C\" int backtrace(" not in s:
    s = s.replace("namespace {", "extern \"C\" int backtrace(void**, int); // glibc execinfo, no header needed\n\nnamespace {", 1)
    open(p, "w").write(s)
    print("declared backtrace()")
else:
    print("already declared")
PY

echo
echo "=== compile ==="
g++ -std=c++20 -c -O1 -w -I runtime/include -I runtime/src runtime/src/platform_linux.cpp \
    -o obj-all/_runtime/platform_linux.o 2>pf.txt
echo "  exit=$?"
head -10 pf.txt | sed 's/^/    /'
