# sp2win — running the recompiled port on Windows

This folder holds the Windows-side runner scripts that are used to build, start and
inspect the recompiled Splatoon 2 port. The executable itself and the extracted game
data are **not** committed here (the binary is ~138 MB and the data root is the
user's own dump).

## What is in here

| File | Purpose |
|---|---|
| `run-input.ps1` | main runner: start `sp2.exe`, optionally script button presses, collect the log and frame dumps |
| `run-headless.ps1` | headless runner used for the current captures: frame-indexed input, `NX_ATLAS_REFRESH=1`, 250-frame dumps, 30 s settle, alias retry |
| `route-plaza13.ps1` | older late-A route: title/tutorial sweep plus A presses after frame 22000 for the UI state-8 news page (the `4 → 7` detour, superseded) |
| `route-plaza.ps1` | news route to the plaza: title/news input, then `A` every 30 frames to frame 40000 (`plazaext` run, reaches `cProgress` and the first NPC page) |
| `route-plaza-b.ps1` | same, but `A` stops at 32000 and `B` backs out of the NPC page, then the camera turns (`plazab` run, `cProgress` at rest) |
| `route-news-pose.ps1` | short news-ending route for the BGM handover (`-Seconds/-Tag/-DumpEvery/-Attempts`) |
| `route-news-sweep.ps1`, `route-news-plaza.ps1`, `route-move-trace.ps1` | news input sweeps and the tutorial Move-step trace used while mapping those steps |
| `run-tutorial.ps1` | tutorial runner: target-frame stop, `NX_HANG_EXIT_MS`, and the temporary `SCENECHG`/`MOVEDBG`/`TUTSKIP` lines in the summary |
| `tutorial-move7.ps1` | current tutorial schedule: aim/ZR skips, the timed Move page, right-stick camera legs, jump/swim probes |
| `run-snap.ps1` | same, plus `NX_SNAP_FS` target snapshots (see a frame mid-build, e.g. a mask pass) |
| `run-tdump.ps1` | same, plus `NX_DUMP_TEXTURES` readback of chosen NVN textures as PPM |
| `run-trace.ps1` | draw tracing (`NX_TRACE_*`) for shaders, targets, uniforms and glyphs |

## Layout expected by the scripts

```
sp2win/
  sp2.exe                 # built by the port repo's build-win.sh (not committed)
  private/                # NX_DATA_ROOT
    extract/romfs/        # junction (mklink /J) to the extracted game romfs
    fonts/shared_0.ttf    # substitute for the system shared font
    frames/               # frame dumps and texture readbacks land here
  <tag>.log               # one log per run
```

## Running

```powershell
cd C:\Users\Hexa\Documents\nintendo\sp2win
.\sp2.exe 2> run.log
```

Play interactively with the keyboard or an XInput pad:

| Key | Button |
|---|---|
| WASD / arrows | left stick |
| Space | A |
| Shift | B |
| J / K | X / Y |
| Q / E | L / R |
| Z / C | ZL / ZR |
| Enter / Esc | + / − |
| F11 or Alt+Enter | fullscreen |

## Scripted runs

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\run-input.ps1 `
  -Seconds 45 -Tag mytest `
  -Script "600:A,800:A,1000:A,1200:A,1400:A,1600:A"
```

`-Script` is a frame-indexed button list (`A`, `B`, `X`, `Y`, `Plus`, `Minus`, `L`, `R`,
`ZL`, `ZR`, `StickL`, `StickR`, `Up`, `Down`, `Left`, `Right`; the directions also push the left
stick, and `RUp`/`RDown`/`RLeft`/`RRight` push the right stick). The runner sets `NX_HEADLESS=1`,
`NX_DATA_ROOT=private`, `NX_DUMP_FRAMES`, `NX_ATLAS_REFRESH=1` (re-upload a CPU-written glyph
atlas when it changes), `NX_SIXAXIS_WOBBLE=1` (a controller being tilted), and
`NX_FENCE_TIMEOUT_MS=120000`; it kills stray `sp2.exe` processes, waits for the address space to
be released, writes `private/frames/NNNNN.ppm`, and restarts the run if the alias reservation
fails or the log stops growing for 90 s.

The first-launch tutorial sweep used for the current screenshots:

```powershell
$s = '600:A,800:A,1000:A,1200:A,1400:A,2400:A,2500:Right,2600:A,2700:Right,2800:A,3100:A'
for ($f = 4300; $f -le 12000; $f += 120) { $s += ",${f}:ZR" }
for ($f = 4400; $f -le 12000; $f += 240) { $s += ",${f}:Y" }
for ($f = 4600; $f -le 12000; $f += 240) { $s += ",${f}:A" }
powershell -NoProfile -ExecutionPolicy Bypass -File .\run-input.ps1 -Seconds 700 -Tag aim `
  -DumpEvery 100 -Script $s
```

The current schedule is `tutorial-move7.ps1`, which runs through aim, ZR and the Move page:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tutorial-move7.ps1
```

The latest plaza handoff route is `route-plaza.ps1` (it calls `run-tutorial.ps1`). It holds the
title `ZL+ZR` chord through the handoff, advances the news with `A`, and then keeps pressing `A`
every 30 frames:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\route-plaza.ps1
```

That run (`plazaext`) goes `5 → 7 → 1 → 2`: the Turbun Shell reward, then Inkopolis Square. Its
log line order is a trap when reading the timeline: `SCENECHG` and the BGM lines are emitted
from different threads, so the *file position* of a transfer does not match the frame it
happened at (in `plazaext`, `5 → 7` sits at file line 6545 but frame ~6546, while `1 → 2` sits
at line 6670 — about frame 7500 — and `2 → 9` at line 13478 is frame 25702). Frame dumps are
the reliable ordering.

Pressing `A` in the square opens the first NPC's gear page (`SeqMgrPlaza` state 9, `cNpc`) and
stays there, which is why `route-plaza-b.ps1` presses `B` from frame 33000 instead:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\route-plaza-b.ps1
```

Both runs dump `private/frames/NNNNN.ppm`; `plazaext` reaches the square's rendered backdrop
(frame 35000), `plazab` captures the square at rest (frames 37500/42500 are byte-identical).

The patch that matters for the news → plaza handoff is
[`patch-newsend-bgm-handover.py`](../tools/patches/patch-newsend-bgm-handover.py): it arms a
delay from `SceneBgmPlaza::requestNewsEnding`, runs the game's own
`exitState_`/`onEnterProgress_` from `Cmn::BgmConductor::xlinkCalc` once it elapses, and answers
`isNewsEndingFinished` while it is pending. The tutorial manager's `5 -> 6` is still redirected
to `5 -> 7` by
[`patch-force-plaza-on-shot-exit.py`](../tools/patches/patch-force-plaza-on-shot-exit.py). That
patch no longer redirects the UI manager's `4 -> 5`: that transition is the real news handoff.
The temporary state-4 probe that forces the stalled page-4 update into it is
[`patch-page4-scene5-force.py`](../tools/patches/patch-page4-scene5-force.py); it is a
diagnostic, not part of the production path.

The Move page is a timed step: `main_00A00BDC` advances the manager from page 6 to page 8 when
the global counter `[+0x44c]` reaches `0x12c0` (about 3,100 frames after the page starts). The
schedule deliberately sends no left stick on that page: the actor's `+0x604` check at
`L_A00350` calls `main_00620ED0(this, 7)`, which is the quit-to-title path, not the next page.

If the log starts with `cannot reserve alias ... error 487`, a previous process has not
exited yet: kill `sp2.exe`, wait ~20 s and run again (the script now retries this itself).

## Useful environment variables

| Variable | Effect |
|---|---|
| `NX_INPUT` | same script syntax as `-Script` |
| `NX_DUMP_FRAMES` | dump every N-th presented frame to `private/frames/` |
| `NX_DUMP_TEXTURES` | comma-separated hex `NVNtexture*` to read back as PPM |
| `NX_SNAP_FS` | `<fs-hash>[,<hash>][@<first draw>]`: snapshot the draw target |
| `NX_TRACE_DRAWS` / `NX_TRACE_COUNT` | trace draws from an index |
| `NX_TRACE_TARGET` / `NX_TRACE_FS_HASH` | restrict tracing to a target or fragment shader |
| `NX_TRACE_GLYPHS` | glyph records, samplers and font-atlas probes |
| `NX_MEM_LIMIT_GB` | raise the default 8 GB guest-memory guard |
| `NX_ATLAS_REFRESH` | re-upload a sampled R8-read-as-alpha glyph atlas when its bytes change (on by default; `0` disables) |
| `NX_SIXAXIS_WOBBLE` | report a controller being tilted (the runner sets it for the tutorial) |
| `NX_TEXDBG`, `NX_TEXTDBG`, `NX_TRACE_UPLOADS` | port-side diagnostics used while debugging text rendering |

## Converting dumps

```bash
python3 ppm2png.py private/frames/01500.ppm 01500.png
python3 ppmstats.py private/frames/01500.ppm      # size, non-zero pixels, max, mean
```
