param([int]$Seconds = 45, [switch]$NoClean, [int]$DumpEvery = 100, [switch]$ColdCache)
$ErrorActionPreference = 'Continue'
$dir = 'C:\Users\Hexa\Documents\nintendo\sp2win'
Set-Location $dir

$target = 'C:\Users\Hexa\Documents\nintendo\hactool-1.4.0-win\romfs'
$link = Join-Path $dir 'private\extract\romfs'
if (-not (Test-Path $link)) { cmd /c mklink /J "$link" "$target" | Out-Null }

$env:NX_HEADLESS = '1'
$env:NX_FENCE_TIMEOUT_MS = '600000'
$env:NX_DUMP_FRAMES = "$DumpEvery"
$env:NX_DATA_ROOT = 'private'
if ($ColdCache) { Get-ChildItem (Join-Path $dir 'private\pipelines_*.bin') -ErrorAction SilentlyContinue | Remove-Item -Force; Write-Output 'pipeline cache deleted' }
if (-not $NoClean) { Get-ChildItem (Join-Path $dir 'private\frames\*.ppm') -ErrorAction SilentlyContinue | Remove-Item -Force }

$sw = [Diagnostics.Stopwatch]::StartNew()
$p = Start-Process -FilePath (Join-Path $dir 'sp2.exe') -WorkingDirectory $dir `
     -RedirectStandardError (Join-Path $dir 'run.log') -RedirectStandardOutput (Join-Path $dir 'run_out.log') `
     -PassThru -NoNewWindow
Start-Sleep -Seconds $Seconds
$alive = -not $p.HasExited
if ($alive) { Stop-Process -Id $p.Id -Force }
$sw.Stop()
Write-Output "ran $([int]$sw.Elapsed.TotalSeconds) s; still running at the end: $alive"

Write-Output ''
Write-Output '== status =='
Write-Output ("presents: " + ((Select-String -Path (Join-Path $dir 'run.log') -Pattern 'present #' -AllMatches).Count) + " lines")
Select-String -Path (Join-Path $dir 'run.log') -Pattern 'present #' | Select-Object -Last 3 | ForEach-Object { $_.Line }
Write-Output ("hang reports: " + ((Select-String -Path (Join-Path $dir 'run.log') -Pattern 'hang: no frame' -AllMatches).Count))
Write-Output ("stalls: " + ((Select-String -Path (Join-Path $dir 'run.log') -Pattern 'stall: ' -AllMatches).Count))
Write-Output ("VUIDs: " + ((Select-String -Path (Join-Path $dir 'run.log') -Pattern 'VUID' -AllMatches).Count))
Write-Output ("faults: " + ((Select-String -Path (Join-Path $dir 'run.log') -Pattern 'fault report|SIGSEGV' -AllMatches).Count))
Select-String -Path (Join-Path $dir 'run.log') -Pattern 'per frame over 60' | Select-Object -Last 3 | ForEach-Object { $_.Line }
Write-Output ''
Write-Output '== frames =='
Get-ChildItem (Join-Path $dir 'private\frames\*.ppm') -ErrorAction SilentlyContinue | Select-Object Name, Length | Format-Table -AutoSize | Out-String
