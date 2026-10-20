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

`tools/rework/find-dropped-tailcalls.py` is the scan that proved the tail-call case is unique
(final instruction `b <other function>` with no call emitted). Run it against any regenerated
tree before trusting indirect-call crashes.
