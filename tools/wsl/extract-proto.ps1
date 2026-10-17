#!/usr/bin/env pwsh
# Extract the Splatoon 2 March-2017 proto NSP and pull its ExeFS, so we can compare it with retail:
#   - SDK era (nnos* vs nn::init::Start)
#   - module count and sizes
#   - whether nn::nex / nn::pia appear in static init
$ErrorActionPreference = 'Continue'
$h   = 'C:\Users\Hexa\Documents\nintendo\hactool-1.4.0-win'
$nsp = 'C:\Users\Hexa\Documents\nintendo\2017 proto\Splatoon 2 - Proto March - Repacked.nsp'
$work = 'C:\Users\Hexa\Documents\nintendo\proto-extract'
New-Item -ItemType Directory -Force -Path $work | Out-Null

Push-Location $h

"=== 1. extract PFS0 (5.9 GB) ==="
& .\hactool.exe -k prod.keys -t pfs0 --pfs0dir="$work\nsp" "$nsp" 2>$null | Select-Object -Last 4
"  exit=$LASTEXITCODE"
Get-ChildItem "$work\nsp" -ErrorAction SilentlyContinue |
  ForEach-Object { "  {0,14:N0}  {1}" -f $_.Length, $_.Name }

$big = Get-ChildItem "$work\nsp\*.nca" -ErrorAction SilentlyContinue |
       Sort-Object Length -Descending | Select-Object -First 1
if (-not $big) { "  no NCA found -- aborting"; Pop-Location; exit 1 }
"  program NCA: $($big.Name)  $('{0:N0}' -f $big.Length) bytes"

"`n=== 2. NCA info (does it need a title key?) ==="
& .\hactool.exe -k prod.keys -t nca -i "$($big.FullName)" 2>$null |
  Select-String -Pattern 'Encrypted|Rights|Key|Content|Title|Type' | Select-Object -First 14

"`n=== 3. extract ExeFS ==="
& .\hactool.exe -k prod.keys -t nca --exefsdir="$work\exefs" "$($big.FullName)" 2>$null | Select-Object -Last 3
"  exit=$LASTEXITCODE"
Get-ChildItem "$work\exefs" -ErrorAction SilentlyContinue |
  ForEach-Object { "  {0,14:N0}  {1}" -f $_.Length, $_.Name }

Pop-Location
