# Tutorial input schedule that walks the first-launch pages: title/PlayerMake A presses, aim and
# ZR skips, the Move page (timed by main_00A00BDC; no left stick, because the actor's +0x604
# check at L_A00350 is the quit-to-title path), right-stick camera legs, then B/ZL/ZR probes for
# the jump and swim pages.  Run from this folder after copying sp2.exe here.
$parts = @(
  '600:A','1000:A','1400:A',
  '2400:A','2500:Right','2600:A','2700:Right','2800:A','3100:A',
  '3400:A','3600:A','3800:A','4000:A','4200:A','4400:A',
  '4600:A','4800:A','5000:A','5200:A','5400:A','5600:A','5800:A',
  '6000:A','6300:A','6600:A','6900:A','7200:A','7500:A','7800:A','8100:A','8400:A',
  '9000:A','9600:A','10200:A','10800:A','11400:A','12000:A','12600:A','13200:A','13800:A','14400:A','15000:A','15600:A'
)
# Right-stick camera pages: yaw both ways, then pitch both ways, twice.  The Move page's timeline
# advances to state 8 at about frame 8600, so the second half of these legs is the camera page.
$legs = @(
  @(5400,6200,'RLeft'), @(6200,7000,'RRight'),
  @(7000,7800,'RUp'),   @(7800,8600,'RDown'),
  @(8600,9400,'RLeft'), @(9400,10200,'RRight'),
  @(10200,11000,'RUp'), @(11000,11800,'RDown')
)
foreach ($leg in $legs) {
  for ($f = $leg[0]; $f -lt $leg[1]; $f += 8) { $parts += "${f}:$($leg[2])" }
}
# Jump probes.
for ($f = 8000; $f -lt 20000; $f += 150) { $parts += "${f}:B" }
# Swim probes (two windows).
for ($f = 11800; $f -lt 13000; $f += 8) { $parts += "${f}:ZL" }
for ($f = 14000; $f -lt 15200; $f += 8) { $parts += "${f}:ZL" }
# Shot probes in case a later page asks for ZR again.
for ($f = 12000; $f -lt 12200; $f += 24) { $parts += "${f}:ZR" }
for ($f = 16000; $f -lt 16200; $f += 24) { $parts += "${f}:ZR" }
# Camera resets.
$parts += '12000:Y','14000:Y','16000:Y'
$script = $parts -join ','
Write-Output ("tutorial input entries: {0}, chars: {1}" -f $parts.Count, $script.Length)
& "$PSScriptRoot\run-tutorial.ps1" -Seconds 1500 -Tag tutorial -DumpEvery 500 -Script $script -TargetFrame '20000' -Attempts 2 -SixAxis off
