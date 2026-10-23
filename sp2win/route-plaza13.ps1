# Current late-A plaza route (plaza13).
#
# Starts the headless runner with the confirmed title/tutorial input sweep and
# schedules A presses after frame 22000.  The UI/page manager reaches state 7
# around frame ~22500 after the 4->7 redirect; state 7 advances to state 8 (the
# A-confirmation/news page), whose A prompt calls state 1 (lens/plaza).
#
# Requires the matching build with the PATCH-FORCE-PLAZA redirects applied.
$parts = @(
  '600:A','1000:A','1400:A',
  '2400:A','2500:Right','2600:A','2700:Right','2800:A','3100:A',
  '3400:A','3600:A','3800:A','4000:A','4200:A','4400:A',
  '4600:A','4800:A','5000:A',
  '2500:ZL','2500:ZR','2508:ZL','2508:ZR',
  '3000:ZL','3000:ZR','3008:ZL','3008:ZR',
  '3500:ZL','3500:ZR','3508:ZL','3508:ZR',
  '4000:ZL','4000:ZR','4008:ZL','4008:ZR',
  '4500:ZL','4500:ZR','4508:ZL','4508:ZR',
  '5000:ZL','5000:ZR','5008:ZL','5008:ZR',
  '5500:ZL','5500:ZR','5508:ZL','5508:ZR',
  '6000:ZL','6000:ZR','6008:ZL','6008:ZR',
  '6500:ZL','6500:ZR','6508:ZL','6508:ZR',
  '6750:ZL','6750:ZR','6800:ZL','6800:ZR','6900:ZL','6900:ZR',
  '7000:ZL','7000:ZR','7100:ZL','7100:ZR','7200:ZL','7200:ZR',
  '7300:ZL','7300:ZR','7400:ZL','7400:ZR','7500:ZL','7500:ZR',
  '7600:ZL','7600:ZR','7800:ZL','7800:ZR','8000:ZL','8000:ZR',
  '7200:Right','7250:A','7300:Right','7350:A',
  '6400:A','6800:A','7200:A','7600:A','8000:A','8400:A',
  '8800:A','9200:A','9600:A','10000:A','10400:A','10800:A','11200:A','11600:A',
  '12000:A','12400:A','12800:A','13200:A','13600:A','14000:A',
  '12000:LRight','12008:LRight','12016:LRight','12024:LRight','12032:LRight',
  '12040:LRight','12048:LRight','12056:LRight','12064:LRight','12072:LRight',
  '13500:LRight','13508:LRight','13516:LRight','13524:LRight','13532:LRight',
  '13540:LRight','13548:LRight','13556:LRight','13564:LRight','13572:LRight',
  '15000:LRight','15008:LRight','15016:LRight','15024:LRight','15032:LRight',
  '15040:LRight','15048:LRight','15056:LRight','15064:LRight','15072:LRight',
  '16500:LRight','16508:LRight','16516:LRight','16524:LRight','16532:LRight',
  '16540:LRight','16548:LRight','16556:LRight','16564:LRight','16572:LRight',
  '23000:A','25000:A','27000:A','29000:A','31000:A','33000:A','35000:A',
  '37000:A','39000:A','41000:A','43000:A','45000:A','47000:A','49000:A',
  '51000:A','53000:A','55000:A','57000:A','59000:A'
)
$script = $parts -join ','
Write-Output ("route-plaza13 input entries: {0}, chars: {1}" -f $parts.Count, $script.Length)
& (Join-Path $PSScriptRoot 'run-headless.ps1') -Seconds 1200 -Tag plaza13 -DumpEvery 250 -Script $script -TargetFrame '60000' -Attempts 1 -SixAxis off
