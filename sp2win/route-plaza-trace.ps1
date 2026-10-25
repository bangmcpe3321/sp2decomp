param(
  [int]$Seconds = 1200,
  [string]$Tag = 'plazatrace',
  [ValidateSet('passes', 'draws')][string]$Mode = 'passes',
  [ValidateSet('b', 'ext')][string]$Route = 'b',
  [int]$FromFrame = 36500,
  [int]$Count = 450
)
# Trace one plaza frame, either its passes or its draws.
#
#   -Mode passes  NX_TRACE_PASSES_FROM_FRAME=$FromFrame: every pass begun/ended from that frame on,
#                 with its colour/depth targets (8000 events, ~68 frames).
#   -Mode draws   NX_TRACE_FROM_FRAME=$FromFrame + NX_TRACE_COUNT: full per-draw state (shaders,
#                 targets, sampled textures, viewport, counts) for one frame.
#
#   -Route b      route-plaza-b.ps1: A stops at 32000, B from 33000.  At rest in cProgress.
#   -Route ext    route-plaza.ps1: A-mash; the first NPC's gear page has been open since ~25702.
#
# run-tutorial.ps1 does not reset the trace variables, so setting them before the call survives.
if ($Mode -eq 'draws') {
  $env:NX_TRACE_FROM_FRAME = "$FromFrame"
  $env:NX_TRACE_COUNT = "$Count"
  $env:NX_TRACE_SAMPLERS = '1'
  $env:NX_TRACE_PASSES_FROM_FRAME = ''
} else {
  $env:NX_TRACE_PASSES_FROM_FRAME = "$FromFrame"
  $env:NX_TRACE_NULLVIEW = '1'
  $env:NX_TRACE_FROM_FRAME = ''
  $env:NX_TRACE_COUNT = ''
  $env:NX_TRACE_SAMPLERS = ''
}
$env:NX_DUMP_FRAMES = '2500'
$runner = Join-Path $PSScriptRoot ($(if ($Route -eq 'ext') { 'route-plaza.ps1' } else { 'route-plaza-b.ps1' }))
& $runner -Seconds $Seconds -Tag $Tag -DumpEvery 2500
