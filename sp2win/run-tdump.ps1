param([int]$Seconds = 25, [string]$Tag = "tdump1", [string]$Textures = "6a00fff368,6a00fff968")
$ErrorActionPreference = 'Continue'
$dir = 'C:\Users\Hexa\Documents\nintendo\sp2win'
Set-Location $dir
$target = 'C:\Users\Hexa\Documents\nintendo\hactool-1.4.0-win\romfs'
$link = Join-Path $dir 'private\extract\romfs'
if (-not (Test-Path $link)) { cmd /c mklink /J "$link" "$target" | Out-Null }

$env:NX_HEADLESS = '1'
$env:NX_FENCE_TIMEOUT_MS = '600000'
$env:NX_DATA_ROOT = 'private'
$env:NX_DUMP_FRAMES = '100'
$env:NX_DUMP_TEXTURES = $Textures
Remove-Item Env:NX_TRACE_DRAWS -ErrorAction SilentlyContinue
Remove-Item Env:NX_INPUT -ErrorAction SilentlyContinue

Get-Process sp2 -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 8
Get-ChildItem (Join-Path $dir 'private\frames\*.ppm') -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
$log = Join-Path $dir ("$Tag.log")
Remove-Item $log -Force -ErrorAction SilentlyContinue
$p = Start-Process -FilePath (Join-Path $dir 'sp2.exe') -WorkingDirectory $dir -RedirectStandardError $log -RedirectStandardOutput (Join-Path $dir "$Tag`_stdout.log") -PassThru -NoNewWindow
Start-Sleep -Seconds $Seconds
if (-not $p.HasExited) { Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue }
try { $p.WaitForExit(10000) | Out-Null } catch {}
"frames: " + (Get-ChildItem (Join-Path $dir 'private\frames\*.ppm') -ErrorAction SilentlyContinue).Count
