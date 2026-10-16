#!/usr/bin/env bash
# Verify the newly installed toolchain and record exact versions.
set -uo pipefail

echo "=== compilers ==="
for c in gcc g++ cc c++ clang clang++; do
  p="$(command -v "$c" 2>/dev/null)"
  if [ -n "$p" ]; then
    printf "  %-8s %s\n           %s\n" "$c" "$p" "$("$c" --version 2>/dev/null | head -1)"
  else
    printf "  %-8s not found\n" "$c"
  fi
done

echo
echo "=== build system ==="
for c in make cmake ninja pkg-config ar ld; do
  p="$(command -v "$c" 2>/dev/null)"
  if [ -n "$p" ]; then printf "  %-10s %s\n             %s\n" "$c" "$p" "$("$c" --version 2>/dev/null | head -1)"; else printf "  %-10s not found\n" "$c"; fi
done

echo
echo "=== can we actually compile and link a C++ program? ==="
T="$(mktemp -d)"
cat > "$T/t.cpp" <<'EOF'
#include <cstdio>
#include <cstdint>
#include <thread>
#include <mutex>
int main() {
    std::mutex m; int v = 0;
    std::thread t([&]{ std::lock_guard<std::mutex> g(m); v = 42; });
    t.join();
    std::printf("c++20 ok, threads ok, v=%d, ptr=%zu\n", v, sizeof(void*));
    return v == 42 ? 0 : 1;
}
EOF
if g++ -std=c++20 -O2 -pthread "$T/t.cpp" -o "$T/t" 2>&1; then
  echo "  compile: OK"
  "$T/t" && echo "  run    : OK" || echo "  run    : FAILED"
else
  echo "  compile: FAILED"
fi

echo
echo "=== cross-compilation to aarch64 (for substrate testing) ==="
cat > "$T/a.cpp" <<'EOF'
extern "C" unsigned long probe() { return 0x1234; }
EOF
for pair in "aarch64-linux-gnu-g++:cross g++" "clang++:clang target"; do
  c="${pair%%:*}"
  if command -v "$c" >/dev/null 2>&1; then
    echo "  $c present"
  else
    echo "  $c absent"
  fi
done
if g++ -dumpmachine; then echo "  host tuple: $(g++ -dumpmachine)"; fi

echo
echo "=== qemu user-mode for running aarch64 binaries ==="
for q in qemu-aarch64 qemu-aarch64-static; do
  if command -v "$q" >/dev/null 2>&1; then echo "  $q: $(command -v "$q")"; else echo "  $q: absent"; fi
done

rm -rf "$T"
