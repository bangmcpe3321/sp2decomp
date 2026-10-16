#!/usr/bin/env bash
# Find the DelegateEvent / Slot definitions in the cloned open-ead/sead reference, to
# settle the ambiguity that defeated the registerCallback port.
#
# The decompiled body showed the connection field holding either a connection object or a
# pointer into the event, with a refcount written through it at +0x10. sead's own headers
# should say which -- this was the cheap route I skipped.
set -uo pipefail

SEAD="$HOME/refs/sead"
[ -d "$SEAD" ] || { echo "sead reference not cloned; run tools/wsl/wsl-clone-refs.sh"; exit 1; }
cd "$SEAD"

echo "=== files mentioning DelegateEvent or Slot ==="
find . -iname '*.h' -o -iname '*.hpp' | xargs grep -l -iE 'DelegateEvent|class Slot' 2>/dev/null | head -12

echo
echo "=== DelegateEvent header candidates ==="
find . -iname '*delegate*' 2>/dev/null | head -12

echo
echo "=== any file defining AssertConfig ==="
find . -iname '*.h' -o -iname '*.hpp' | xargs grep -l 'AssertConfig' 2>/dev/null | head -6

echo
echo "=== the layout question: where does the refcount sit? ==="
echo "    decompile reads slot+0x38 then *(int*)(that+0x10) as a refcount."
echo "    searching for a class with a refcount near +0x10 and a Slot/ListNode at +0x20..."
for f in $(find . -iname '*.h' | xargs grep -l -iE 'DelegateEvent' 2>/dev/null | head -4); do
  echo "--- $f ---"
  grep -nE 'class |struct |mRefCount|refCount|_refCounter|ListNode|Slot|Delegate' "$f" | head -30
done
