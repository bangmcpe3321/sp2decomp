param(
  [int]$Seconds = 1500,
  [string]$Tag = 'plazaext',
  [int]$DumpEvery = 5000,
  [int]$Attempts = 1
)
$parts = @(
  '600:A','1000:A','1400:A',
  '2400:A','2500:Right','2600:A','2700:Right','2800:A','3100:A',
  '3400:A','3600:A','3800:A','4000:A','4200:A','4400:A',
  '4600:A','4800:A','5000:A','5200:A','5400:A','5600:A','5800:A',
  '6000:A','6300:A'
)
# Advance every news message/page. The title -> news handoff happens at ~6500.
for ($f = 6400; $f -le 14000; $f += 60) { $parts += "${f}:A" }
# Title start requires ZL+ZR held through the handoff (separate entries every 8 frames).
for ($f = 6500; $f -le 8000; $f += 8) {
  $parts += "${f}:ZL"
  $parts += "${f}:ZR"
}
# Keep advancing plaza dialogue after the news.  The earlier route stopped at
# 14000 and the first plaza dialogue was still on screen at frame 15000.
for ($f = 14030; $f -le 40000; $f += 30) { $parts += "${f}:A" }
$script = $parts -join ','
Write-Output ("route-plaza entries: {0}, chars: {1}" -f $parts.Count, $script.Length)
$env:NX_TRACE_DRAWS = ''
$env:NX_INPUT = $script
$runner = Join-Path $PSScriptRoot 'run-tutorial.ps1'
& $runner -Seconds $Seconds -Tag $Tag -DumpEvery $DumpEvery -Script $script -TargetFrame '25000' -Attempts $Attempts
