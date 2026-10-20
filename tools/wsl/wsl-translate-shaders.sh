#!/usr/bin/env bash
# Translate the shader blocks the port dumped with NX_DUMP_SHADER_MISSES=1 into private/spirv/<hash>.spv.
#
#   wsl-translate-shaders.sh [misses dir] [spirv dir]
#
# The port loads each stage's SPIR-V from <data root>/spirv/<hash>.spv, where <hash> is the first 16 hex digits
# of the SHA-1 of the Maxwell code block (nvn_shaders.cpp). A draw whose program has no translated stage is
# skipped ("no program"), which is what leaves characters and some effects invisible.
#
#   1. run the game with NX_DUMP_SHADER_MISSES=1: it writes code_<hash>.bin / ctrl_<hash>.bin pairs to
#      <data root>/shader_misses/ for every stage that has no .spv;
#   2. run this script: it drives the offline Ryujinx-based harness (tools/maxwell/spirv_harness, built by
#      the port into private/build/spirv_harness) over those pairs and copies the results into <data root>/spirv/;
#   3. restart the game: misses are cached per process, so a running instance keeps skipping them.
#
# The harness writes a fresh results.tsv; the new records are appended to the existing one here (the port reads
# it for storage-buffer bindings). Requires the .NET SDK (default /home/hexa/dotnet-sdk, override DOTNET_SDK).
set -uo pipefail

MISSES="${1:-/mnt/c/Users/Hexa/Documents/nintendo/sp2win/private/shader_misses}"
SPIRV="${2:-/mnt/c/Users/Hexa/Documents/nintendo/sp2win/private/spirv}"
PORT="${SP2PORT:-/home/hexa/sp2port}"
DOTNET="${DOTNET_SDK:-/home/hexa/dotnet-sdk}/dotnet"
HARNESS="$PORT/private/build/spirv_harness/bin/Release/net10.0/spirv_harness.dll"
OUT="$PORT/private/build/spirv_out"

export DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=1
export DOTNET_CLI_TELEMETRY_OPTOUT=1

pairs=$(ls "$MISSES"/code_*.bin 2>/dev/null | wc -l)
echo "pairs: $pairs"
[ "$pairs" -eq 0 ] && { echo "nothing to translate"; exit 0; }
[ -x "$DOTNET" ] || { echo "no .NET SDK at $DOTNET (set DOTNET_SDK)"; exit 2; }
[ -f "$HARNESS" ] || { echo "no harness at $HARNESS (build tools/maxwell/spirv_harness)"; exit 2; }

rm -rf "$OUT"
mkdir -p "$OUT"
"$DOTNET" "$HARNESS" --batch "$MISSES" --out "$OUT" --jobs 4 --no-val 2>&1 | tail -6

ok=$(ls "$OUT"/*.spv 2>/dev/null | wc -l)
echo "translated: $ok"
[ "$ok" -eq 0 ] && exit 1

mkdir -p "$SPIRV"
cp "$OUT"/*.spv "$SPIRV"/
if [ -f "$OUT/results.tsv" ] && [ -f "$SPIRV/results.tsv" ]; then
  tail -n +2 "$OUT/results.tsv" >> "$SPIRV/results.tsv"
else
  cp "$OUT/results.tsv" "$SPIRV/results.tsv"
fi
echo "spirv files: $(ls "$SPIRV"/*.spv | wc -l), results.tsv: $(wc -l < "$SPIRV/results.tsv") lines"
