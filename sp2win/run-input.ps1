param(
    [int]$Seconds = 100,
    [string]$Tag = "input1",
    [string]$Script = "1100:R,1300:R,1500:R,1700:R,1900:R,2100:R,2300:R,2500:R,2700:R,2900:R,3100:R,3300:R,3500:R,3800:R,4100:R,4400:R",
    [int]$DumpEvery = 100
)
# Runs sp2.exe unattended with NX_INPUT scripted presses, dumps every Nth frame, and retries the
# startup alias race.  Start it from the folder that holds sp2.exe and private/ (the data root).
$ErrorActionPreference = 'Continue'
$dir = 'C:\Users\Hexa\Documents\nintendo\sp2win'
$prog = Join-Path $dir ("progress_$Tag.txt")
function P([string]$m) { Add-Content -Path $prog -Value ("{0}  {1}" -f (Get-Date -Format 'HH:mm:ss'), $m) }
Set-Content -Path $prog -Value ("start tag=$Tag seconds=$Seconds script=$Script")

$env:NX_HEADLESS = '1'
$env:NX_FENCE_TIMEOUT_MS = '120000'
$env:NX_DATA_ROOT = 'private'
$env:NX_DUMP_FRAMES = "$DumpEvery"
$env:NX_INPUT = $Script
$env:NX_ATLAS_REFRESH = '1'      # re-upload a CPU-written glyph atlas when its bytes change
$env:NX_SIXAXIS_WOBBLE = '1'     # a controller being tilted, for the tutorial's aim/tilt steps
$env:NX_MEM_LIMIT_GB = '13'
Remove-Item Env:NX_CV_HIST -ErrorAction SilentlyContinue
Remove-Item Env:NX_THREAD_DUMP_AT -ErrorAction SilentlyContinue

$target = 'C:\Users\Hexa\Documents\nintendo\hactool-1.4.0-win\romfs'
$link = Join-Path $dir 'private\extract\romfs'
if (-not (Test-Path $link)) { cmd /c mklink /J "$link" "$target" | Out-Null }

$ok = $false
for ($attempt = 1; $attempt -le 6 -and -not $ok; $attempt++) {
    P "attempt $attempt"
    Get-Process sp2 -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 30
    $log = Join-Path $dir ("$Tag.log")
    $out = Join-Path $dir ("$Tag" + "_stdout.log")
    Remove-Item $log, $out -Force -ErrorAction SilentlyContinue
    Remove-Item (Join-Path $dir 'private\frames\*.ppm') -Force -ErrorAction SilentlyContinue
    Set-Location $dir
    $p = Start-Process -FilePath (Join-Path $dir 'sp2.exe') -WorkingDirectory $dir -RedirectStandardError $log -RedirectStandardOutput $out -PassThru -NoNewWindow
    Start-Sleep -Seconds 8
    $t = Get-Content $log -Raw -ErrorAction SilentlyContinue
    if ($p.HasExited -or ($t -match 'cannot reserve alias')) {
        if (-not $p.HasExited) { Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue }
        P "attempt ${attempt}: startup failed"
        continue
    }
    P "run start pid=$($p.Id)"
    $sw = [Diagnostics.Stopwatch]::StartNew()
    $lastSize = 0; $lastChange = $sw.Elapsed.TotalSeconds
    while ($sw.Elapsed.TotalSeconds -lt $Seconds -and -not $p.HasExited) {
        Start-Sleep -Seconds 15
        $sz = 0
        try { $sz = (Get-Item $log).Length } catch {}
        if ($sz -ne $lastSize) { $lastSize = $sz; $lastChange = $sw.Elapsed.TotalSeconds }
        elseif (($sw.Elapsed.TotalSeconds - $lastChange) -gt 90) { P "watchdog: no log growth for 90 s"; break }
    }
    $alive = -not $p.HasExited
    if ($alive) { Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue }
    try { $p.WaitForExit(10000) | Out-Null } catch {}
    P ("run end alive=$alive elapsed={0:n0}s" -f $sw.Elapsed.TotalSeconds)
    $l = Get-Content $log -ErrorAction SilentlyContinue
    P ("summary crash=" + [bool]($l | Select-String 'CRASH:' -Quiet) +
       " allocfail=" + [bool]($l | Select-String 'vkAllocateMemory failed' -Quiet) +
       " hang=" + [bool]($l | Select-String 'hang: no frame' -Quiet))
    if ($l) { $l | Select-String 'nvn: present #' | Select-Object -Last 12 | ForEach-Object { P ("  " + $_.Line) } }
    $nf = (Get-ChildItem (Join-Path $dir 'private\frames\*.ppm') -ErrorAction SilentlyContinue).Count
    P "frames: $nf"
    if ($nf -ge 20) { $ok = $true }
}
