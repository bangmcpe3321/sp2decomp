param(
    [int]$Seconds = 1500,
    [string]$Tag = "tutorial",
    [int]$DumpEvery = 500,
    [string]$Script = "",
    [string]$TargetFrame = "20000",
    [int]$Attempts = 2,
    [ValidateSet("off", "wobble", "grid", "seek")][string]$SixAxis = "off"
)
# Tutorial runner: start sp2.exe unattended, feed an NX_INPUT schedule, dump every Nth frame,
# and stop once the target frame dump exists.  Unlike the boot runner this sets
# NX_HANG_EXIT_MS so a silent period still exits cleanly, and it prints the temporary
# SCENECHG/MOVEDBG/TUTSKIP lines that the tutorial diagnostics emit.
#
# The executable must already be in this folder; the build/copy step lives in the port repo.
# The data root is private/ (romfs junction, fonts, frame dumps).
$ErrorActionPreference = 'Continue'
$dir = 'C:\Users\Hexa\Documents\nintendo\sp2win'
$prog = Join-Path $dir ("progress_$Tag.txt")
$log = Join-Path $dir ("$Tag.log")
$out = Join-Path $dir ("$Tag" + "_stdout.log")
function P([string]$m) { Add-Content -Path $prog -Value ("{0}  {1}" -f (Get-Date -Format 'HH:mm:ss'), $m) }
Set-Content -Path $prog -Value ("start tag=$Tag seconds=$Seconds target=$TargetFrame sixaxis=$SixAxis")

$env:NX_HEADLESS = '1'
$env:NX_FENCE_TIMEOUT_MS = '120000'
$env:NX_DATA_ROOT = 'private'
$env:NX_DUMP_FRAMES = "$DumpEvery"
$env:NX_ATLAS_REFRESH = '1'
$env:NX_MEM_LIMIT_GB = '13'
$env:NX_HANG_EXIT_MS = '180000'
$env:NX_PIPE_CAP = '512'
$env:NX_INPUT = $Script
Remove-Item Env:NX_THREAD_DUMP_AT -ErrorAction SilentlyContinue
Remove-Item Env:NX_SIXAXIS_WOBBLE -ErrorAction SilentlyContinue
Remove-Item Env:NX_SIXAXIS_GRID -ErrorAction SilentlyContinue
switch ($SixAxis) {
    'wobble' { $env:NX_SIXAXIS_WOBBLE = '1' }
    'grid'   { $env:NX_SIXAXIS_GRID = '1' }
    'seek'   { $env:NX_SIXAXIS_SEEK = '1' }
    'off'    { $env:NX_SIXAXIS = '0' }
}

$target = 'C:\Users\Hexa\Documents\nintendo\hactool-1.4.0-win\romfs'
$link = Join-Path $dir 'private\extract\romfs'
if (-not (Test-Path $link)) { cmd /c mklink /J "$link" "$target" | Out-Null }

$ok = $false
for ($attempt = 1; $attempt -le $Attempts -and -not $ok; $attempt++) {
    P "attempt $attempt"
    Get-Process sp2 -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 30
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
    while ($sw.Elapsed.TotalSeconds -lt $Seconds -and -not $p.HasExited) { Start-Sleep -Seconds 10 }
    $alive = -not $p.HasExited
    $reached = Test-Path (Join-Path $dir "private\frames\$TargetFrame.ppm")
    if ($alive) { Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue }
    try { $p.WaitForExit(10000) | Out-Null } catch {}
    P (("run end alive={0} elapsed={1:n0}s reached={2}" -f $alive, $sw.Elapsed.TotalSeconds, $reached))
    $l = Get-Content $log -ErrorAction SilentlyContinue
    P ("summary crash=" + [bool]($l | Select-String 'CRASH:' -Quiet) + " allocfail=" + [bool]($l | Select-String 'vkAllocateMemory failed' -Quiet) + " hang=" + [bool]($l | Select-String 'hang: no frame' -Quiet) + " memlimit=" + [bool]($l | Select-String 'over the 13.0 GB limit' -Quiet))
    $l | Select-String 'nvn: present #|SCENECHG|MOVEDBG|TUTSKIP|FSSCAP' | Select-Object -Last 12 | ForEach-Object { P ("  " + $_.Line) }
    $nf = (Get-ChildItem (Join-Path $dir 'private\frames\*.ppm') -ErrorAction SilentlyContinue).Count
    P "frames: $nf"
    if ($reached) { $ok = $true }
}
P "done ok=$ok"
