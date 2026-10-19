#!/usr/bin/env bash
# build-win.sh [jobs] -- build sp2.exe (Windows x86-64) from the same sources with LLVM-MinGW.
#
#   ./build-win.sh        # 8 parallel units
#   ./build-win.sh 4
#
# The guest modules (gen/**) and the shared runtime compile as they are; the platform
# layer is platform_win.cpp + memguard_win.cpp instead of platform_linux.cpp, and the
# Vulkan headers need VK_USE_PLATFORM_WIN32_KHR (vk_gen.cpp gates the win32 surface on
# it). WINVER 0x0A00 exposes SetProcessDpiAwarenessContext in platform_win.cpp.
#
# Objects land in obj-win/ (incremental), the exe next to this script.
set -uo pipefail
cd "$(dirname "$0")"
CXX="${MINGW_CXX:-$HOME/llvm-mingw/bin/x86_64-w64-mingw32-clang++}"
[ -x "$CXX" ] || { echo "no toolchain at $CXX (set MINGW_CXX)"; exit 1; }
INC="-I runtime/include -I runtime/src -I $HOME/vkheaders/include"
FLAGS="-std=c++20 -c -O1 -w -DVK_USE_PLATFORM_WIN32_KHR -D_WIN32_WINNT=0x0A00 -DWINVER=0x0A00"
JOBS="${1:-8}"
OUT=obj-win
mkdir -p "$OUT/_runtime" "$OUT/main"
: > "$OUT/failed.txt"

unit_src() {
  case "$1" in
    _runtime)
      if   [ -f "runtime/src/$2.cpp" ];     then printf 'runtime/src/%s.cpp' "$2"
      elif [ -f "runtime/src/nvn/$2.cpp" ]; then printf 'runtime/src/nvn/%s.cpp' "$2"
      fi ;;
    *) [ -f "gen/$1/$2.cpp" ] && printf 'gen/%s/%s.cpp' "$1" "$2" ;;
  esac
}

build_one() {  # mod name
  local mod="$1" name="$2" out="$OUT/$1/$2.o" src
  [ -f "$out" ] && return 0
  mkdir -p "$(dirname "$out")"
  src=$(unit_src "$mod" "$name")
  if [ -z "$src" ]; then echo "$mod/$name: no source" >> "$OUT/failed.txt"; return 1; fi
  if ! $CXX $FLAGS $INC "$src" -o "$out" > "$OUT/${mod}_$name.buildlog" 2>&1; then
    echo "$src" >> "$OUT/failed.txt"
    return 1
  fi
  rm -f "$OUT/${mod}_$name.buildlog"
}

# unit list: guest modules exactly as the Linux build compiled them, plus the runtime's actual object set.
units=()
for mod in main sdk subsdk0 subsdk1 subsdk2 subsdk3; do
  for o in obj-all/$mod/*.o; do
    n=${o##*/}
    units+=("$mod ${n%.o}")
  done
done
# runtime units: the actual Linux object set (obj-all/_runtime), not build-runtime.log, so units added after that
# log was written (svc_settings, hle_friends) are not missed. The Linux platform layer is replaced by the Windows ones.
while read -r name; do
  case "$name" in
    platform_linux) continue ;;
    *) units+=("_runtime $name") ;;
  esac
done < <(for o in obj-all/_runtime/*.o; do printf '%s\n' "${o##*/}" | sed 's/\.o$//'; done)
for name in platform_win platform_win_crt memguard_win; do
  case " ${units[*]} " in *" _runtime $name "*) ;; *) units+=("_runtime $name") ;; esac
done

echo "building ${#units[@]} units for Windows with $JOBS jobs"
n=0
for spec in "${units[@]}"; do
  build_one $spec &
  n=$((n + 1))
  [ $((n % JOBS)) -eq 0 ] && wait
done
wait

failed=$(wc -l < "$OUT/failed.txt")
if [ "$failed" != 0 ]; then
  echo
  echo "FAILED UNITS ($failed):"
  sort -u "$OUT/failed.txt" | head -20
  echo
  echo "first errors:"
  for src in $(sort -u "$OUT/failed.txt" | head -3); do
    log="$OUT/$(basename "$(dirname "$src")")_$(basename "${src%.cpp}").buildlog"
    echo "--- $src"
    [ -f "$log" ] && head -12 "$log"
  done
  exit 1
fi

echo "linking sp2.exe"
$CXX -o sp2.exe $(find "$OUT" -name '*.o') \
    -lxaudio2_8 -lxinput -ldbghelp -lole32 -loleaut32 -luuid -luser32 -lgdi32 \
    -lshell32 -lshlwapi -ladvapi32 -lws2_32 -lwinmm -lversion -static \
    > "$OUT/link.log" 2>&1 || { echo "link failed:"; head -25 "$OUT/link.log"; exit 1; }
ls -la sp2.exe
echo "done"
