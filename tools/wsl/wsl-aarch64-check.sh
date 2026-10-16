#!/usr/bin/env bash
# Check AArch64 verification tooling availability.
echo "=== qemu user-mode ==="
for q in qemu-aarch64 qemu-aarch64-static; do
  if command -v "$q" >/dev/null 2>&1; then echo "  $q: $(command -v "$q")"; else echo "  $q: absent"; fi
done

echo
echo "=== aarch64 cross toolchain ==="
for c in aarch64-linux-gnu-g++ aarch64-linux-gnu-gcc; do
  if command -v "$c" >/dev/null 2>&1; then echo "  $c: present"; else echo "  $c: absent"; fi
done

echo
echo "=== guest libc for cross-compiled binaries ==="
for p in /usr/aarch64-linux-gnu /usr/lib/aarch64-linux-gnu; do
  if [ -d "$p" ]; then echo "  $p: present"; else echo "  $p: absent"; fi
done

echo
echo "=== apt candidates (query only, no install) ==="
apt-cache policy qemu-user-static g++-aarch64-linux-gnu 2>/dev/null | grep -E '^[a-z]|Candidate' | head -10

echo
echo "=== would clang cross-compile without extra packages? ==="
command -v clang++ >/dev/null 2>&1 && echo "  clang++ present" || echo "  clang++ absent"
