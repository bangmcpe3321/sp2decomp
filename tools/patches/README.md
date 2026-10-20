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

`tools/rework/find-dropped-tailcalls.py` is the scan that proved the tail-call case is unique
(final instruction `b <other function>` with no call emitted). Run it against any regenerated
tree before trusting indirect-call crashes.
