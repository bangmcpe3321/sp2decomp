# Diagnostic route: reach the tutorial Move page and trace the skinned model draws.
# Not a production route.  The environment stays on for the whole run.
$parts = @(
  '600:A','1000:A','1400:A',
  '2400:A','2500:Right','2600:A','2700:Right','2800:A','3100:A',
  '3400:A','3600:A','3800:A','4000:A','4200:A','4400:A',
  '4600:A','4800:A','5000:A','5200:A','5400:A','5600:A','5800:A',
  '6000:A','6300:A','6600:A','6900:A','7200:A','7500:A','7800:A','8100:A','8400:A'
)
$legs = @(
  @(5400,6200,'RLeft'), @(6200,7000,'RRight'),
  @(7000,7800,'RUp'),   @(7800,8600,'RDown'),
  @(8600,9400,'RLeft'), @(9400,10200,'RRight')
)
foreach ($leg in $legs) {
  for ($f = $leg[0]; $f -lt $leg[1]; $f += 8) { $parts += "${f}:$($leg[2])" }
}
$script = $parts -join ','
Write-Output ("route-move-trace input entries: {0}, chars: {1}" -f $parts.Count, $script.Length)

$env:NX_TRACE_DRAWS = '0'
$env:NX_TRACE_FROM_FRAME = '8500'
$env:NX_TRACE_FS_HASH = '5e7226500d49caea,51058ca0a1d9a961'
$env:NX_TRACE_COUNT = '30'
$env:NX_TRACE_SKIN = '1'
$env:NX_ZERO_DRAWS = '1'
& (Join-Path $PSScriptRoot 'run-tutorial.ps1') -Seconds 600 -Tag move_trace -DumpEvery 250 -Script $script -TargetFrame '12000' -Attempts 1 -SixAxis off
