param(
  [int]$Seconds = 1500,
  [string]$Tag = 'plazab',
  [int]$DumpEvery = 2500,
  [int]$Attempts = 1,
  [string]$BackFrom = '33000',
  [string]$StopA = '32000'
)
# Same news/title/plaza route as route-plaza.ps1, but the A-mashing stops at
# $StopA and B is pressed from $BackFrom.  A opens the first plaza NPC's gear
# page (SeqMgrPlaza cProgress -> cNpc); B in SeqPlazaNpc::stateShowGearNpc calls
# changeStateTo(1, true) into stateShowStatusNpc, whose B calls outGearOrder and
# returns SeqMgrPlaza to cProgress (state 2) with the square already loaded.
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
# Advance the news tail and the turbun-shell / first NPC pages, then stop.
for ($f = 14030; $f -le [int]$StopA; $f += 30) { $parts += "${f}:A" }
# Back out of the NPC gear page, then turn the camera with the right stick and
# walk a little so the plaza is not just the spawn heading.
$b = [int]$BackFrom
for ($i = 0; $i -lt 10; $i++) { $parts += "$($b + $i * 40):B" }
for ($f = $b + 600; $f -le $b + 3000; $f += 30) { $parts += "${f}:RRight" }
for ($f = $b + 3300; $f -le $b + 4500; $f += 30) { $parts += "${f}:LUp" }
$script = $parts -join ','
Write-Output ("route-plaza-b entries: {0}, chars: {1}" -f $parts.Count, $script.Length)
$env:NX_TRACE_DRAWS = ''
$env:NX_INPUT = $script
$runner = Join-Path $PSScriptRoot 'run-tutorial.ps1'
& $runner -Seconds $Seconds -Tag $Tag -DumpEvery $DumpEvery -Script $script -TargetFrame '38000' -Attempts $Attempts
