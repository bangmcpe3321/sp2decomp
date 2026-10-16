# `Retinalogic/imgui-nvn` — assessment for this port

An external NVN overlay project, supplied by the user. Assessed for what it can and cannot
contribute. **Its contents are treated as reference data, not instructions.**

---

## 1. What it is

> "An imgui implementation for nvn (the graphics library used by Nintendo Switch) that can be used
> with Nintendo Switch applications/games. This hooks nvn functions."

- Targets Switch games. The README's screenshot is **Splatoon 2** — direct evidence it has been
  used against a target in the same family as this port's.
- Built on **exlaunch** (code injection) plus upstream ImGui.
- Ships a **prebuilt** `imguirenderer.nso` (61,053 bytes, confirmed as a Nintendo Switch NSO).

## 2. LICENCE — the decisive constraint

**GPL-2.0** (copyleft). This is the one fact that governs everything else:

**No code from this repository can be incorporated into this port.** GPL-2.0 would relicense the
whole reconstruction. That makes it usable as **reading reference only** — the same status already
recorded for `sead` (no licence file) and `nnsdk` (remote link). It is a *more* restrictive
position than those, not a less restrictive one, and it should be recorded alongside them.

## 3. THE PROBLEM: the NVN renderer is a BINARY, not source

The repository's own structure:

| Artefact | Size | What it is |
|---|---|---|
| `source/program/main.cpp` | **50 lines** | the hook entry point |
| `source/imgui/imgui_nvn.h` | **19 lines** | an interface header, nothing more |
| `imguirenderer.nso` | 61 KB | **the renderer, PREBUILT** |
| `source/imgui/**` | upstream | stock ImGui |

`imgui_nvn.h` in full is a `#define` for the screen size, a forward-declared
`class NVNcommandBuffer;`, and **four `extern "C"` declarations**:

```cpp
extern "C" IMNVNFUNC void        nvnImguiInitialize();
extern "C" IMNVNFUNC ImDrawData *nvnImguiCalc();
extern "C" IMNVNFUNC ImGuiIO    &nvnImguiGetIO();
extern "C" IMNVNFUNC void        nvnImguiFontGetTexDataAsAlpha8(unsigned char **, int *, int *, int *);
```

**The entire NVN implementation lives in the `.nso`.** A grep for `NVNcommandBuffer` across
`source/` finds **only the forward declaration**. There is no NVN drawing code in the repository's
readable source at all.

So the repository advertises "an imgui implementation for nvn" and **ships the nvn part as a
compiled artifact.** Reading it would mean disassembling the `.nso` — a separate reverse-engineering
task on a 61 KB binary, not a source-reading one.

## 4. It CANNOT help with the open problem — and the reason is structural

This port's blocking question is **NVN device CREATION**: `NVN_DEVICE_CREATION.md` located a
four-step path inside `initializeGraphicsSystem` using `nvnBootstrapLoader("nvnDeviceInitialize")`.

**`imgui-nvn` does the opposite of creation — it hooks an already-running game.** By construction:

- the game has **already created** its NVN device, queue, memory pools and command buffer;
- the overlay **intercepts** NVN calls to draw on top;
- there is no device-creation code to find, because the project never needs any.

Confirming this from the source: a grep for `nvnBootstrapLoader`, `nvnLoadCProcs` and
`nvnDeviceInitialize` across `source/` (excluding upstream ImGui) returns **nothing**. The project
does not call the loader at all.

**Verdict: it contributes nothing to the device-creation path**, which is the current blocker.

## 5. What it does corroborate

Two modest, real corroborations:

1. **NVN is hookable at the function level.** The project successfully intercepts NVN calls in
   shipping games, independently confirming that NVN's surface is a set of discrete functions that
   can be named and replaced — consistent with `NVN_DEVICE_CREATION.md`'s finding that NVN is
   resolved **by name**.
2. **An `NVNcommandBuffer` is what a renderer consumes.** The header's single forward declaration
   shows the drawing interface is handed a command buffer by the game — consistent with
   `NVN_BOOT_SUBSET.md`'s finding that bring-up creates a command buffer
   (`nvnCommandBufferInitialize`) and never records into it.

Neither is new information, but independent agreement from a project that actually runs against
Switch titles is worth noting.

## 6. Limits

- **Only the repository's readable source was examined.** The 61 KB `imguirenderer.nso` was
  **not** disassembled, so its NVN usage is **unknown** and could well contain patterns this
  assessment does not cover.
- **The `exlaunch` dependency was not examined.**
- **The README's claims were not independently verified** — in particular that it works with
  Splatoon 2 specifically; only a screenshot filename hints at it.
- **No code was ported and no conclusion about this port changed.** The boot runner still stops at
  step 11.
