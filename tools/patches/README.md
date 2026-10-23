# Guest-code and runtime patches

The `gen/` tree is generated from the game's own `main`/`sdk` modules. Changes there are kept
as **idempotent scripts** so they can be re-applied after regenerating and removed for a
control run:

```bash
python3 tools/patches/<patch>.py            # apply
python3 tools/patches/<patch>.py --restore  # remove
```

Each script takes `SP2PORT` (default `~/sp2port`) and edits the file in place. Diagnostics
follow the same convention and are removed before any published run.

| Patch | File | What it fixes |
|---|---|---|
| `patch-tailcall-20bd74.py` | `gen/main/code_044.cpp` | `Cui::Page::findPartsControl` lost its tail call into `Control::List::searchAs<PartsCtrl>`; it returned a list pointer as a control, which was the `call to 50c12201b8` boot fatal in `Cui::CustomizePartsSet::onInitialize`. |
| `patch-alpha-atlas.py` | `runtime/src/nvn/nvn_upload.cpp` | The CPU-written R8 glyph atlas is packed rows even though the builder reports `stride 0`; untiling it produced noise. Packed rows plus the R→RGBA widening make all UI text legible. |
| `patch-force-plaza-on-shot-exit.py` (diagnostic) | `gen/main/code_132.cpp` | Redirects the tutorial manager's unreachable `5 → 6` request to warp state 7. It deliberately does **not** touch the UI/page manager's `4 → 5`, which is the real title → Off the Hook news handoff. |
| `patch-page4-scene5-force.py` (diagnostic) | `gen/main/code_204.cpp` | Page 4's update `main_00979BC8` runs every frame, but its network/start handoff never completes in the port. After 120 calls, invokes `main_00620ED0(page, 5)` — the real transition into the Off the Hook news scene, not the old `4 → 7` redirect. |
| `patch-fs-commit.py` | `runtime/src/hle_fs.cpp` | `CommitSaveData` was a no-op, so the save stayed in the C library buffer and a killed process lost it (PlayerMake on every boot). Commit now `fflush`es the open files. |
| `patch-remove-debug-hooks.py` | `gen/main/code_*.cpp` | Strips the ad-hoc `(temporary)` guest diagnostics (UIDBG, TITLEDBG, CTRLDBG, LPCTRLDBG, …) and their includes before a production build. Idempotent. |
| `patch-fss-null-face.py` | `gen/sdk/code_033.cpp` | `FSS_set_scale` validates `[font+0x10]` (the face) once, then reloads it after `get_scale_inputs` and reads `[face+0x20]` without a second check. On the intro→title transition the face is zero at the reload and the game dies at data address `0x20`. The patch honours FSS's own null-face error (`0x131`) instead and logs the first occurrences (`FSSNULL ...`). |
| `patch-language-code.py` | `runtime/src/svc_settings.cpp` | `nn::settings::LanguageCode` is a `char[8]`, but the port wrote each tag as a number with its first character in the high byte, so memory said `"SU-ne"` instead of `"en-US"`. The game matched no language and fell back to Japanese (`CommonMsg_JPja.szs`); now it loads `CommonMsg_USen.szs` and the whole UI is English. |
| `patch-font-metrics-log.py` (diagnostic) | `gen/main/code_417.cpp` | Logs what `nn::ui2d::TextureCache` returns from `CalculateCharWidth`/`CalculateKerning` (size, character, face, slot, result) for the first calls and for every size ≥ 90, to compare the working size-40 text with the garbled size-100 banner. |
| `patch-fss-mapfont-null.py` | `gen/sdk/code_033.cpp` | `map_font` (`FSS_set_cmap`) caches the face table from `[font+0x10]` at entry and re-reads it after the face loader runs. When that loader leaves the pointer cleared, the next `ldrh w9, [x9, #0x20]` dies at data address `0x20` (the crash that ended the 12:18 run). Returns FSS's own null-face error (`0x131`) and logs `FSSMAPFONT` with the entry-time pointer. Same subsystem as the garbled eui banner text. |
| `patch-atlas-dump.py` (diagnostic) | `runtime/src/nvn/nvn_upload.cpp` | `NX_DUMP_ATLAS=<n>` logs every R8 upload ≥ 64 px wide (size, stride, swizzle, dirty range, `alpha_from_r`) and writes the 1st/10th/40th as packed-row and untiled gray PPMs under `frames/`, to see whether the small-text/banner atlases are scrambled in memory or sampled with wrong UVs. |

| `patch-sixaxis.py` | `runtime/src/hle_hid.cpp` | `GetSixAxisSensorHandles` was a no-op and `GetSixAxisSensorStates` returned 0 without writing its output, so sead's six-axis addon had no orientation. Fills handles and a level sensor state (identity direction, gravity on -Z, 1/60 s delta); `NX_SIXAXIS=0` keeps the old behaviour. Needed for motion aiming and any motion-gated step. |
| `patch-r11-native.py` | `runtime/src/nvn/nvn_caps.cpp` | NVN's R11G11B10F (0x3f) was always stored as RGBA16F off Android, doubling every HDR load/store/sample (636 MB of 1020 MB live images at the title, on a 6 GB GPU). Uses B10G11R11_UFLOAT_PACK32 when the device can render, blend, filter and copy it; `NX_R11G11B10_EMULATE=1` opts out. |
| `patch-imgstats.py` (diagnostic) | `runtime/src/nvn/nvn_image.cpp`, `nvn_frames.cpp`, `nvn_pipeline_cache.cpp`, `nvn_vk.h` | Live VkDeviceMemory per NVN format, logged with the 60-frame report, to attribute the multi-GB live image set. |
| `patch-trace-frame.py` | `runtime/src/nvn/nvn_draw_trace.cpp` | `NX_TRACE_FROM_FRAME=<frame>` starts the existing 80-draw trace at a presented frame; with `NX_TRACE_GLYPHS` it also writes the guest side of each bound R8 texture as `frames/tex_draw_*.pgm`. |
| `patch-tutdbg2.py` (diagnostic) | `gen/main/code_258.cpp` | Logs which `UICheck::PhaseTutorialTest` state runs and the guide-message page's event bits, index and message. (This turned out to be a debug menu, not the first-launch tutorial.) |
| `patch-fss-call.py` (diagnostic) | `gen/sdk/code_059.cpp` | Names the SDK import `FSS_set_scale` calls between reading the face and finding it zero. |
| `patch-guide-text.py` (diagnostic) | `gen/main/code_223.cpp` | Logs the two `sead::SafeString`s in the `ParamArg` handed to `TutorialGuideMsgPage::setParam`, i.e. the label/text of the tutorial step on screen. |
| `patch-cui-input.py` (diagnostic) | `gen/main/code_038.cpp` | Logs non-zero pad words read by the CUI parts code, with the caller, replacing the old UIDBG block that only logged pre-input zeroes. |
| `patch-clears-scissor-default.py` | `runtime/src/nvn/nvn_clears.cpp` | NVN clears are clipped to the bound scissor; the port cleared whole attachments unless `NX_CLEARS_SCISSOR=1`. A clear meant for one UI panel then erased the rest of the UI image (the tutorial's Pro Controller diagram was missing). Scissoring is now the default; `NX_CLEARS_SCISSOR=0` opts out. |
| `patch-skip-deferred-clears.py` (bisect) | `runtime/src/nvn/nvn_clears.cpp` | `NX_SKIP_DEFERRED_CLEARS=1` drops whole-target clears that would become a pass loadOp, to show what a clear erases. With it, UI parts that whole-target clears had wiped (the controller diagram) reappeared. |
| `patch-pass-frame.py` (diagnostic) | `runtime/src/nvn/nvn_draw_trace.cpp` | `NX_TRACE_PASSES_FROM_FRAME=<frame>` selects the pass trace by presented frame (the tutorial's draw index is ~1.4M and drifts between runs). Each pass logs its frame, draw index, cleared flag, and the colour/depth image pointer, size and format. |
| `patch-snap-pass.py` (diagnostic) | `runtime/src/nvn/nvn_draw.cpp` | `NX_SNAP_PASS_FRAME=<frame>` snapshots the colour target before every pass of that frame as `frames/<draw-hex>.ppm`; this showed the tutorial's wireframe scene being drawn and then cleared mid-frame before the UI. |
| `patch-sixaxis-wobble.py` | `runtime/src/hle_hid.cpp` | `NX_SIXAXIS_WOBBLE=1` sweeps pitch and yaw over the reported six-axis direction, so the tutorial's "tilt" and "aim" steps see controller motion. |
| `patch-atlas-refresh.py` | `runtime/src/nvn/nvn_pipeline.cpp` | The size-100 BlitzBold glyph atlas is written by the CPU through mapped memory without a flush the port sees, so its image kept the letters of an earlier face/size (clean glyphs, wrong text). `NX_ATLAS_REFRESH=1` hashes one sampled byte in 61 of each sampled R8-read-as-alpha image once a frame and re-uploads the whole image when it changes; the tutorial banners now read correctly. |

`tools/rework/find-dropped-tailcalls.py` is the scan that proved the tail-call case is unique
(final instruction `b <other function>` with no call emitted). Run it against any regenerated
tree before trusting indirect-call crashes.
