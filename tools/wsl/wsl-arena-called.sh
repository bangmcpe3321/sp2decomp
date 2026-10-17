#!/usr/bin/env bash
# Is sead::Arena ever constructed or initialised? If neither runs, HeapMgr::sDefaultArena is empty and
# HeapMgr::initialize(size) has no buffer -- exactly the fault we now see.
set -uo pipefail
P="$HOME/sp2port"
cd "$P" || exit 1

cat > /tmp/ar.gdb <<'GDB'
set pagination off
set confirm off
break main_00EB9F0C
commands
  silent
  printf "Arena::Arena(this=0x%lx)\n", *(unsigned long long*)($rdi)
  bt 6
  continue
end
break main_00EB9F1C
commands
  silent
  printf "Arena::initialize(this=0x%lx, size=0x%lx)\n", *(unsigned long long*)($rdi), *(unsigned long long*)($rdi+8)
  bt 6
  continue
end
run
GDB

echo "=== run under gdb (up to 700s) ==="
timeout 700 gdb -q -batch -x /tmp/ar.gdb ./sp2 > /tmp/ar.txt 2>&1
echo "exit=$?"
echo
echo "  Arena::Arena hits       : $(grep -c 'Arena::Arena(' /tmp/ar.txt)"
echo "  Arena::initialize hits  : $(grep -c 'Arena::initialize(' /tmp/ar.txt)"
echo
awk '/Arena::Arena\(|Arena::initialize\(/{p=1} p' /tmp/ar.txt | head -30
