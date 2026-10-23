# Diagnostic button sweep for the Off the Hook news scene.
#
# The actual 4 -> 5 transition reaches the news scene, but the broadcast's
# advance/skip input is not A (a 1200-frame A pass left the scene unchanged).
# This route presses every face, shoulder, trigger, stick and Plus/Minus
# button on its own frame from 8000 to 20000, with the same title/tutorial
# prefix.  The frame dump at 8250/8500 shows which action moved the news.
#
# Requires the page-4 -> scene-5 force build
# (tools/patches/patch-page4-scene5-force.py).
$parts = @(
  '600:A','1000:A','1400:A',
  '2400:A','2500:Right','2600:A','2700:Right','2800:A','3100:A',
  '3400:A','3600:A','3800:A','4000:A','4200:A','4400:A',
  '4600:A','4800:A','5000:A','5200:A','5400:A','5600:A','5800:A',
  '6000:A','6300:A','6600:A','6900:A','7200:A','7500:A','7800:A'
)
for ($f = 6900; $f -le 7500; $f += 100) { $parts += "${f}:X" }
$btns = @('A','B','X','Y','Plus','Minus','L','R','ZL','ZR','Left','Right','Up','Down')
for ($f = 8000; $f -le 20000; $f += 100) {
  for ($i = 0; $i -lt $btns.Count; $i++) { $parts += ("{0}:{1}" -f ($f + $i), $btns[$i]) }
}
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
Write-Output ("route-news-sweep entries: {0}, chars: {1}" -f $parts.Count, $script.Length)
$env:NX_TRACE_DRAWS = ''
$env:NX_TRACE_COPIES = ''
$env:NX_TRACE_FROM_FRAME = ''
$env:NX_TRACE_COUNT = ''
$env:NX_TRACE_FS_HASH = ''
$env:NX_TRACE_SKIN = ''
$env:NX_ZERO_DRAWS = ''
$env:NX_DUMP_TEXTURES = '6a00fff368'
$env:NX_DUMP_ON_TARGET = ''
& (Join-Path $PSScriptRoot 'run-tutorial.ps1') -Seconds 450 -Tag news-sweep -DumpEvery 250 -Script $script -TargetFrame '15000' -Attempts 1 -SixAxis off
