#!/usr/bin/env bash
# Set up a Splatoon 2 port tree from the MIT Wonder runtime + our generated code.
#
# Layout mirrors Wonder's (games/<game>/), because the runtime expects per-game glue in that shape:
#   sp2/
#     runtime/          <- copied from the MIT repo (kernel, IPC, HLE, nx helpers)
#     gen/main/         <- our generated main   (433 TUs + table.cpp)
#     gen/sdk/          <- our generated sdk    (60 TUs)
#     gen/subsdkN/      <- our generated subsdk (16/2/1/4 TUs)
#     games/sp2/        <- glue we write
set -uo pipefail

WONDER="$HOME/refs/wonder"
GEN="$HOME/sp2recomp"
OUT="$HOME/sp2port"

mkdir -p "$OUT"

echo "=== copy the MIT runtime ==="
if [ ! -d "$OUT/runtime" ]; then
  cp -r "$WONDER/runtime" "$OUT/runtime"
  cp "$WONDER/LICENSE" "$OUT/LICENSE-Wonder-MIT" 2>/dev/null || true
  echo "  copied runtime/ ($(find "$OUT/runtime" -name '*.cpp' | wc -l) cpp, $(find "$OUT/runtime" -name '*.h' | wc -l) h)"
else
  echo "  already present"
fi

echo
echo "=== stage the generated code ==="
for pair in "gen:main" "gen_sdk:sdk" "gen_subsdk0:subsdk0" "gen_subsdk1:subsdk1" \
            "gen_subsdk2:subsdk2" "gen_subsdk3:subsdk3"; do
  src="$GEN/${pair%%:*}"; dst="$OUT/gen/${pair##*:}"
  if [ -d "$src" ]; then
    mkdir -p "$dst"
    cp -f "$src"/*.cpp "$src"/*.h "$dst"/ 2>/dev/null
    printf '  %-10s %3s cpp  %s\n' "${pair##*:}" \
      "$(ls "$dst"/code_*.cpp 2>/dev/null | wc -l)" \
      "$(du -sh "$dst" 2>/dev/null | cut -f1)"
  fi
done

echo
echo "=== totals ==="
echo "  cpp files: $(find "$OUT/gen" -name 'code_*.cpp' | wc -l)"
echo "  size:      $(du -sh "$OUT/gen" | cut -f1)"
echo "  disk free: $(df -h "$HOME" | tail -1 | awk '{print $4}')"

echo
echo "=== module bases (as generated) ==="
printf '  %-10s %s\n' main 0x7100000000 sdk 0x7101000000 subsdk0 0x7102000000 \
  subsdk1 0x7104000000 subsdk2 0x7106000000 subsdk3 0x7108000000
