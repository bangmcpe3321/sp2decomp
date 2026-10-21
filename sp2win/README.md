# sp2win — running the recompiled port on Windows

This folder holds the Windows-side runner scripts that are used to build, start and
inspect the recompiled Splatoon 2 port. The executable itself and the extracted game
data are **not** committed here (the binary is ~138 MB and the data root is the
user's own dump).

## What is in here

| File | Purpose |
|---|---|
| `run-input.ps1` | main runner: start `sp2.exe`, optionally script button presses, collect the log and frame dumps |
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
