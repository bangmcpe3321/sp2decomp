# Route to the title's Off the Hook news scene and (after A) toward the plaza.
#
# Requires the build with the diagnostic page-4 -> scene-5 force
# (tools/patches/patch-page4-scene5-force.py).  The title page 4 update runs
# every frame, but its normal network/start path does not finish in the port;
# the force performs the real 4 -> 5 transition, which loads the news scene.
# This is not the old 4 -> 7 redirect.
#
# Inputs: the normal title/tutorial sweep, X for the title's "PRESS X" intro,
# then A every 80 frames.  The first A pass did not advance the news scene;
# route-news-sweep.ps1 tests every button on its own frame instead.
$parts = @(
  '600:A','1000:A','1400:A',
  '2400:A','2500:Right','2600:A','2700:Right','2800:A','3100:A',
  '3400:A','3600:A','3800:A','4000:A','4200:A','4400:A',
  '4600:A','4800:A','5000:A','5200:A','5400:A','5600:A','5800:A',
  '6000:A','6300:A','6600:A','6900:A','7200:A','7500:A','7800:A'
)
for ($f = 6900; $f -le 7500; $f += 100) { $parts += "${f}:X" }
for ($f = 8000; $f -le 59000; $f += 80) { $parts += "${f}:A" }
$legs = @(
  @(5400,6200,'RLeft'), @(6200,7000,'RRight'),
  @(7000,7800,'RUp'),   @(7800,8600,'RDown'),
  @(8600,9400,'RLeft'), @(9400,10200,'RRight')
)
foreach ($leg in $legs) {
  for ($f = $leg[0]; $f -lt $leg[1]; $f += 8) { $parts += "${f}:$($leg[2])" }
}
for ($f = 6500; $f -le 8000; $f += 8) {
  $parts += "${f}:ZL"
  $parts += "${f}:ZR"
}
$script = $parts -join ','
Write-Output ("route-news-plaza entries: {0}, chars: {1}" -f $parts.Count, $script.Length)
$env:NX_TRACE_DRAWS = ''
$env:NX_TRACE_COPIES = ''
$env:NX_TRACE_FROM_FRAME = ''
$env:NX_TRACE_COUNT = ''
$env:NX_TRACE_FS_HASH = ''
$env:NX_TRACE_SKIN = ''
$env:NX_ZERO_DRAWS = ''
$env:NX_DUMP_TEXTURES = '6a00fff368'
$env:NX_DUMP_ON_TARGET = ''
& (Join-Path $PSScriptRoot 'run-tutorial.ps1') -Seconds 1200 -Tag newsplaza -DumpEvery 500 -Script $script -TargetFrame '60000' -Attempts 1 -SixAxis off
