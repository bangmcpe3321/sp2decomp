#!/usr/bin/env bash
# Verify the AArch64 cross toolchain, then cross-compile the port and run the full
# contract suite under qemu-aarch64.
#
# Why this matters: everything so far has been tested on x86-64 only, which cannot
# reveal AArch64 struct-layout/alignment differences or calling-convention mismatches in
# reconstructed headers. This is the closest available thing to a real substrate.
set -uo pipefail

PORT="/mnt/c/Users/Hexa/Documents/nintendo/sp2decomp/port"
BUILD="$HOME/sp2port-aarch64"
TOOLCHAIN="$HOME/aarch64-toolchain.cmake"

echo "=== toolchain ==="
aarch64-linux-gnu-g++ --version | head -1
echo "  tuple: $(aarch64-linux-gnu-g++ -dumpmachine)"
qemu-aarch64 --version | head -1
echo "  guest libc: $(ls -d /usr/aarch64-linux-gnu 2>/dev/null || echo absent)"

echo
echo "=== write a CMake toolchain file ==="
cat > "$TOOLCHAIN" <<'EOF'
set(CMAKE_SYSTEM_NAME Linux)
set(CMAKE_SYSTEM_PROCESSOR aarch64)
set(CMAKE_C_COMPILER   aarch64-linux-gnu-gcc)
set(CMAKE_CXX_COMPILER aarch64-linux-gnu-g++)
set(CMAKE_FIND_ROOT_PATH /usr/aarch64-linux-gnu)
set(CMAKE_FIND_ROOT_PATH_MODE_PROGRAM NEVER)
set(CMAKE_FIND_ROOT_PATH_MODE_LIBRARY ONLY)
set(CMAKE_FIND_ROOT_PATH_MODE_INCLUDE ONLY)
EOF
sed -n '1,10p' "$TOOLCHAIN"

echo
echo "=== configure (cross) ==="
cmake -S "$PORT" -B "$BUILD" -G Ninja \
  -DCMAKE_TOOLCHAIN_FILE="$TOOLCHAIN" \
  -DCMAKE_BUILD_TYPE=RelWithDebInfo \
  -DCMAKE_EXE_LINKER_FLAGS="-static" \
  -DTHREADS_PREFER_PTHREAD_FLAG=ON 2>&1 | tail -6

echo
echo "=== build ==="
cmake --build "$BUILD" 2>&1 | grep -E 'error|warning|Linking|FAILED|Building' | head -25
echo "   build exit=${PIPESTATUS[0]}"

echo
echo "=== confirm the binaries really are AArch64 ==="
for t in platform_tests services_tests boot_integration engine_tests list_node_tests boot_engine_tests; do
  if [ -x "$BUILD/$t" ]; then
    printf "  %-18s %s\n" "$t" "$(file -b "$BUILD/$t" | cut -c1-70)"
  fi
done

echo
echo "=== run under qemu-aarch64 ==="
rc=0
for t in platform_tests services_tests boot_integration engine_tests list_node_tests boot_engine_tests; do
  echo "--- $t ---"
  if [ -x "$BUILD/$t" ]; then
    QEMU_LD_PREFIX=/usr/aarch64-linux-gnu qemu-aarch64 "$BUILD/$t" 2>&1 | tail -6
    e=$?
    [ $e -ne 0 ] && rc=$e
    echo "    exit=$e"
  else
    echo "    not built"
    rc=1
  fi
done

echo
echo "aarch64 rc=$rc"
exit $rc
