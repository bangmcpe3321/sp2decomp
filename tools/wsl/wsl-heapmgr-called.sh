#!/usr/bin/env bash
# Is sead::HeapMgr::initialize ever called? If not, the port must call it -- the engine's root heap is
# what Framework::initialize needs, and nothing has created it.
# Then: call it ourselves right before nnMain.
set -uo pipefail
P="$HOME/sp2port"
M="$P/runtime/src/main.cpp"

echo "=== 1. does the game call HeapMgr::initialize at all? ==="
cat > /tmp/hm.gdb <<'GDB'
set pagination off
set confirm off
set $n = 0
break main_00E7C4E0
commands
  silent
  set $n = $n + 1
  printf "HeapMgr::initialize(size=0x%lx) hit #%d\n", *(unsigned long long*)($rdi), $n
  continue
end
break main_00E7C6B8
commands
  silent
  printf "HeapMgr::initialize(Arena*) called\n"
  continue
end
break main_00E7C790
commands
  silent
  printf "HeapMgr::createRootHeap_ called\n"
  continue
end
run
GDB
cd "$P" || exit 1
timeout 400 gdb -q -batch -x /tmp/hm.gdb ./sp2 > /tmp/hm.txt 2>&1
echo "  exit=$?"
echo "  HeapMgr::initialize(size) hits : $(grep -c 'HeapMgr::initialize(size' /tmp/hm.txt)"
echo "  HeapMgr::initialize(Arena) hits: $(grep -c 'HeapMgr::initialize(Arena' /tmp/hm.txt)"
echo "  createRootHeap_ hits           : $(grep -c 'createRootHeap_ called' /tmp/hm.txt)"
grep -E 'HeapMgr::initialize|createRootHeap_' /tmp/hm.txt | head -6
