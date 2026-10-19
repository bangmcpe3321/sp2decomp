param([int]$Seconds = 45, [string]$Tag = "trace1", [string]$Script = "800:R,1000:A,1200:R,1400:A,1600:R,1800:A", [switch]$Skin)
$ErrorActionPreference = 'Continue'
$dir = 'C:\Users\Hexa\Documents\nintendo\sp2win'
$prog = Join-Path $dir ("progress_$Tag.txt")
function P([string]$m) { Add-Content -Path $prog -Value ("{0}  {1}" -f (Get-Date -Format 'HH:mm:ss'), $m) }
Set-Content -Path $prog -Value ("start tag=$Tag seconds=$Seconds script=$Script skin=$Skin")

$target = 'C:\Users\Hexa\Documents\nintendo\hactool-1.4.0-win\romfs'
$link = Join-Path $dir 'private\extract\romfs'
if (-not (Test-Path $link)) { cmd /c mklink /J "$link" "$target" | Out-Null }

$env:NX_HEADLESS = '1'
$env:NX_FENCE_TIMEOUT_MS = '600000'
$env:NX_DATA_ROOT = 'private'
$env:NX_DUMP_FRAMES = '100'
$env:NX_INPUT = $Script
Remove-Item Env:NX_CV_HIST -ErrorAction SilentlyContinue
Remove-Item Env:NX_TRACE_SKIN -ErrorAction SilentlyContinue
if ($Skin) { $env:NX_TRACE_SKIN = '1' }

Set-Location $dir
Get-Process sp2 -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 8
Get-ChildItem (Join-Path $dir 'private\frames\*.ppm') -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
$log = Join-Path $dir ("$Tag.log")
$out = Join-Path $dir ("$Tag" + "_stdout.log")
Remove-Item $log, $out -Force -ErrorAction SilentlyContinue
P "run start"
$p = Start-Process -FilePath (Join-Path $dir 'sp2.exe') -WorkingDirectory $dir -RedirectStandardError $log -RedirectStandardOutput $out -PassThru -NoNewWindow
Start-Sleep -Seconds $Seconds
$alive = -not $p.HasExited
if ($alive) { Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue }
try { $p.WaitForExit(10000) | Out-Null } catch {}
P "run end alive=$alive"
"frames: " + (Get-ChildItem (Join-Path $dir 'private\frames\*.ppm') -ErrorAction SilentlyContinue).Count
