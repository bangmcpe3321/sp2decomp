param([int]$Seconds = 100, [string]$Tag = "input1", [string]$Script = "1100:R,1300:R,1500:R,1700:R,1900:R,2100:R,2300:R,2500:R,2700:R,2900:R,3100:R,3300:R,3500:R,3800:R,4100:R,4400:R")
$ErrorActionPreference = 'Continue'
$dir = 'C:\Users\Hexa\Documents\nintendo\sp2win'
$prog = Join-Path $dir ("progress_$Tag.txt")
function P([string]$m) { Add-Content -Path $prog -Value ("{0}  {1}" -f (Get-Date -Format 'HH:mm:ss'), $m) }
Set-Content -Path $prog -Value ("start tag=$Tag seconds=$Seconds script=$Script")

$target = 'C:\Users\Hexa\Documents\nintendo\hactool-1.4.0-win\romfs'
$link = Join-Path $dir 'private\extract\romfs'
if (-not (Test-Path $link)) { cmd /c mklink /J "$link" "$target" | Out-Null }

$env:NX_HEADLESS = '1'
$env:NX_FENCE_TIMEOUT_MS = '600000'
$env:NX_DATA_ROOT = 'private'
$env:NX_DUMP_FRAMES = '100'
$env:NX_INPUT = $Script
Remove-Item Env:NX_CV_HIST -ErrorAction SilentlyContinue

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
$l = Get-Content $log -ErrorAction SilentlyContinue
P ("summary crash=" + [bool]($l | Select-String 'CRASH:' -Quiet) + " hang=" + [bool]($l | Select-String 'hang: no frame' -Quiet))
if ($l) { $l | Select-String 'hid: first buttons|nvn: present #' | Select-Object -Last 12 | ForEach-Object { P ("  " + $_.Line) } }
"frames: " + (Get-ChildItem (Join-Path $dir 'private\frames\*.ppm') -ErrorAction SilentlyContinue).Count
