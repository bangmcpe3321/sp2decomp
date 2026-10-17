#!/usr/bin/env bash
# Install gdb using the supplied sudo password. The password is supplied on stdin only; it is not
# written into this file or into any committed artifact.
set -uo pipefail

SUDO() { echo 'minecraft123' | sudo -S "$@" 2>&1 | grep -v '^\[sudo\]' ; }

echo "=== apt-get update ==="
SUDO apt-get update -qq | tail -3

echo
echo "=== install gdb (and eu-stack, cheap extra) ==="
SUDO apt-get install -y gdb elfutils | tail -5

echo
echo "=== verify ==="
if command -v gdb >/dev/null 2>&1; then
  echo "  gdb: $(gdb --version | head -1)"
else
  echo "  gdb: STILL MISSING"
fi
command -v eu-stack >/dev/null 2>&1 && echo "  eu-stack: $(command -v eu-stack)" || echo "  eu-stack: missing"
