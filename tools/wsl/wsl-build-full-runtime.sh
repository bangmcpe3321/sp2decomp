#!/usr/bin/env bash
# Round 15: build the WHOLE runtime. The nvn/ directory (47 files -- the port's Vulkan-backed NVN
# implementation) and the vk_* bridge were never compiled in this workspace, so nvnBootstrapLoader had no
# HLE: main's import fell through to subsdk0's REAL driver, which aborted in NvOsDrvOpen (no nvdrv IPC).
# Also (re)build the missing top-level runtime sources for Linux.
set -uo pipefail
P="$HOME/sp2port"
cd "$P" || exit 1

rm -f obj-all/_runtime/*.err build-runtime.log

VKINC="$HOME/vkheaders/include"
[ -d "$VKINC/vulkan" ] || VKINC="$HOME/vkdev/usr/include"
[ -d "$VKINC/vulkan" ] || VKINC=""
echo "  vulkan include: ${VKINC:-<none>}"

sources() {
    for f in runtime/src/*.cpp runtime/src/nvn/*.cpp; do
        case "$f" in
            runtime/src/platform_win.cpp|runtime/src/platform_mac.cpp|runtime/src/platform_android.cpp|\
            runtime/src/platform_android_audio.cpp|runtime/src/platform_android_input.cpp|\
            runtime/src/memguard_win.cpp|runtime/src/memguard_mac.cpp|runtime/src/memguard_android.cpp)
                continue;;
        esac
        echo "$f"
    done
}

echo "=== compiling runtime ==="
ok=0; fail=0; running=0
for f in $(sources); do
    b=$(basename "$f" .cpp)
    (
        if g++ -std=c++20 -c -O1 -w -I runtime/include -I runtime/src ${VKINC:+-I "$VKINC"} "$f" \
                -o "obj-all/_runtime/$b.o" 2> "obj-all/_runtime/$b.err"; then
            echo "OK   $b"
        else
            echo "FAIL $b"
        fi
    ) >> build-runtime.log 2>&1 &
    running=$((running + 1))
    if [ "$running" -ge 8 ]; then wait; running=0; fi
done
wait

ok=$(grep -c '^OK' build-runtime.log)
fail=$(grep -c '^FAIL' build-runtime.log)
echo "  ok: $ok  fail: $fail"

if [ "$fail" -gt 0 ]; then
    echo
    echo "=== failures ==="
    grep '^FAIL' build-runtime.log
    for e in obj-all/_runtime/*.err; do
        [ -s "$e" ] || continue
        echo "--- $e"
        head -8 "$e"
    done
    exit 1
fi

echo
echo "=== linking ==="
GEN=$(find "$P/obj-all" -name '*.o' | grep -v _runtime | tr '\n' ' ')
RTO=$(find "$P/obj-all/_runtime" -name '*.o' | tr '\n' ' ')
g++ -o "$P/sp2.new" $GEN $RTO -lm -lc -lgcc -lpthread -ldl 2> link-full.txt
if [ $? -ne 0 ]; then
    echo "LINK FAILED:"
    head -30 link-full.txt
    exit 1
fi
mv -f "$P/sp2.new" "$P/sp2"
echo "  linked: $(du -h "$P/sp2" | cut -f1)"

echo
echo "=== run ==="
timeout 300 "$P/sp2" > "$P/full.log" 2>&1
echo "  exit: $?"

echo
echo "=== signal ==="
grep -nE 'nvnBootstrapLoader|nvn:|fault address|guest lr|missing import|vi:|linked:|FATAL|assert' "$P/full.log" | head -50
echo "=== tail ==="
tail -30 "$P/full.log"
