param(
  [int]$Seconds = 1200,
  [string]$Tag = 'plazatrace',
  [ValidateSet('passes', 'draws', 'snap')][string]$Mode = 'passes',
  [ValidateSet('b', 'ext')][string]$Route = 'b',
  [int]$FromFrame = 36500,
  [int]$Count = 450,
  [int]$Every = 1
)
# Trace one plaza frame: its passes, its draws, or a snapshot after every pass.
#
#   -Mode passes  NX_TRACE_PASSES_FROM_FRAME=$FromFrame: every pass begun/ended from that frame on,
#                 with its colour/depth targets (8000 events, ~68 frames).
#   -Mode draws   NX_TRACE_FROM_FRAME=$FromFrame + NX_TRACE_COUNT: full per-draw state (shaders,
#                 targets, sampled textures, viewport, counts) for one frame.
#   -Mode snap    NX_SNAP_PASSES=$FromFrame:$Every: in that frame, right after every -Every-th pass,
#                 frames/snap_<frame>_<k>_<draw>_col.ppm (the colour target, state reset so alpha-0
#                 blend results survive) and _dep.pgm (depth as stored); the log names each pass'
#                 colour/depth image.
#
#   -Route b      route-plaza-b.ps1: A stops at 32000, B from 33000.  At rest in cProgress.
#   -Route ext    route-plaza.ps1: A-mash; the first NPC's gear page has been open since ~25702.
#
# run-tutorial.ps1 does not reset the trace variables, so setting them before the call survives.
$env:NX_TRACE_PASSES_FROM_FRAME = ''
$env:NX_TRACE_FROM_FRAME = ''
$env:NX_TRACE_COUNT = ''
$env:NX_TRACE_SAMPLERS = ''
if ($Mode -eq 'draws') {
  $env:NX_TRACE_FROM_FRAME = "$FromFrame"
  $env:NX_TRACE_COUNT = "$Count"
  $env:NX_TRACE_SAMPLERS = '1'
} elseif ($Mode -eq 'passes') {
  $env:NX_TRACE_PASSES_FROM_FRAME = "$FromFrame"
  $env:NX_TRACE_NULLVIEW = '1'
}
$env:NX_SNAP_PASSES = "$(if ($Mode -eq 'snap') { "$FromFrame`:$Every" } else { '' })"
$env:NX_DUMP_FRAMES = '2500'
$runner = Join-Path $PSScriptRoot ($(if ($Route -eq 'ext') { 'route-plaza.ps1' } else { 'route-plaza-b.ps1' }))
& $runner -Seconds $Seconds -Tag $Tag -DumpEvery 2500
