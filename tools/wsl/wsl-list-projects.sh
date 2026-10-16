#!/usr/bin/env bash
# Inspect the WSL-side Ghidra projects.
echo "--- ~/sp2 contents ---"
ls -la "$HOME/sp2/" 2>&1 | head -16
echo
echo "--- project dirs ---"
for d in "$HOME/sp2/proj" "$HOME/sp2/proj-sdk"; do
  echo "  $d:"
  ls -la "$d" 2>&1 | head -6
done
echo
echo "--- which project holds main.elf with symbols? check the saved program's name table via a tiny script is expensive; instead just report existence ---"
