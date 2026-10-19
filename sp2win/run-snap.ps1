param([string]$Tag = "snap1", [int]$Seconds = 60, [string]$Script = "800:R,1000:A,1200:R,1400:A,1600:R,1800:A,2000:R,2200:A", [string]$SnapFs = "cc0af353291e5c0e,51058ca0a1d9a961@2000")
$ErrorActionPreference = 'Continue'
Get-Process sp2 -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 10
$env:NX_SNAP_FS = $SnapFs
& powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Users\Hexa\AppData\Local\Temp\opencode\run-input.ps1" -Seconds $Seconds -Tag $Tag -Script $Script
