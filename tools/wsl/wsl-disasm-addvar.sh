#!/usr/bin/env bash
# Read AddVariable's insertion logic statically. Question: when it inserts, does it write
# node->next = nullptr (correct) or node->next = <itself> (the observed cycle)?
set -uo pipefail
P="$HOME/sp2port"
cd "$P" || exit 1

gdb -q -batch \
  -ex 'set pagination off' \
  -ex 'disassemble /r _ZN2nn3nex24PseudoGlobalVariableList11AddVariableEPNS0_24PseudoGlobalVariableRootE' \
  ./sp2 2>&1 | grep -vE 'Reading symbols|Downloading|^\[New|^\[Thread' | head -70
