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

`tools/rework/find-dropped-tailcalls.py` is the scan that proved the tail-call case is unique
(final instruction `b <other function>` with no call emitted). Run it against any regenerated
tree before trusting indirect-call crashes.
