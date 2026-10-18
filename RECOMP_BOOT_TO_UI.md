# Recompiled port — boot progress through UI resource loading

This is the state of the recompiled PC port (`~/sp2port`, runtime under
`runtime/src/`) as of 2026-10-19. It is a living log: each row of the ladder was
a real fatal, diagnosed from the guest's own stack and fixed in the runtime.

The port now enters `nnMain`, initialises NVN/sead graphics, HID, settings, the
SDK's own module init and audio, completes `RootTask::prepare_`'s early work and
reaches **UI layout loading** (`Lp::UI::Impl`). It stops when
`sead::SZSDecompressor::decomp` is handed a null destination because the UI
`Lp::UI::Impl::DualHeap` cannot allocate.

## Running

```bash
cd ~/sp2port
VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/lvp_icd.json NX_HEADLESS=1 ./sp2
# NX_TRACE=1      verbose (svc / HLE / IPC / NVN)
# NX_TRACE_FS=1   every file the game opens
```

The game's romfs must be reachable: `private/extract/romfs` is a symlink to the
`romfs/` directory produced by hactool.

Single-object rebuild + relink (the pattern used for every fix below):

```bash
cd ~/sp2port
g++ -std=c++20 -c -O1 -w -I runtime/include -I runtime/src -I ~/vkheaders/include \
    runtime/src/<file>.cpp -o obj-all/_runtime/<file>.o
GEN=$(find obj-all -name '*.o' | grep -v _runtime | tr '\n' ' ')
RTO=$(find obj-all/_runtime -name '*.o' | tr '\n' ' ')
g++ -o sp2.new $GEN $RTO -lm -lc -lgcc -lpthread -ldl && mv sp2.new sp2
```

## Boot ladder

Every entry is a fatal that was hit and fixed during this session, in order.

| # | Symptom | Cause | Fix |
|---|---------|-------|-----|
| 1 | SIGSEGV inside HLE `GetStorageSize` → `format_info()` (`module_base + 0xd34198 + fmt*0x30`) | port used the previous title's SDK format-table slot | `nvn/nvn_texture_layout.cpp`: this title's driver table — slot `subsdk0+0x17ebd0`, stride `0x34`, fields `+8`/`+9`/`+16` |
| 2 | `FATAL: call to 0` inside `nvnTextureInitialize` | port called `nvnTextureBuilderGetPackagedTextureLayout`, absent from this driver | `nvn/nvn.h`: `driver_or()` + `driver()` fatals naming the proc; `nvn/nvn_objects.cpp`: fall back to `nvnTextureBuilderGetPackagedTextureData` |
| 3 | `FATAL: nvn: this title's driver has no nvnWindowBuilderGetNumTextures` | this SDK's window-builder API differs | `nvn/nvn_queue.cpp`: read builder fields directly (`+8` count, `+0x10` texture array, `+0x20` interval−1) |
| 4 | SIGSEGV at 0 in `nn::hid::detail::SharedMemoryAccessor::Activate` | the `hid` IPC service was a bare stub: `CreateAppletResource` returned no object, so `[accessor+0x38]` stayed null | `hle_hid.cpp`: implement `hid` cmd 0 (CreateAppletResource → applet-resource session) and `IAppletResource` cmd 0 (GetSharedMemoryHandle → kernel shared memory) |
| 5 | `svcBreak` abort in `nn::settings::LanguageCode::Make` | the `set` service was a stub, so `detail::MakeLanguageCode` could not fill `codes[15]` (`set cmd 1`) | `svc_settings.cpp` (**new**): `set` cmd 0/1/2/3/4 — language list in enum order, system language `en-US`, region Americas |
| 6 | SIGSEGV at `0x8` in `Lp::Sys::ResMgr::load_` | `private/extract/romfs` was empty | symlink the hactool `romfs/`; `System/GameConfigSetting.xml` then loads |
| 7 | SIGSEGV at 0 in `nn::aoc::ListAddOnContent` | the SDK's own `nninitInitializeSdkModule` (main+0x1c8) never ran, so `nn::aoc`'s object holder stayed null | `main.cpp` `nn_main()`: call `nninitInitializeSdkModule` after the module constructors and before `nnMain` (runs `nn::oe`, `nn::aoc`, `nn::fs` flags, `nn::pctl`, abort observer) |
| 8 | `FATAL: CreateAudioRendererManagerByDfc not found` | this SDK has **no** in-process audio renderer (no DFC manager, no `AudioRenderSystem`); the Wonder-era in-process path cannot work | `hle_audio.cpp`: `CreateAudioRendererManagerByHipc` fails cleanly; `OpenAudioRenderer` stubs a handle and attaches the game's frame event to the port's 5 ms event |
| 9 | guest `svcBreak` in `nn::os::SignalSystemEvent` | the event handed out by `OpenAudioRenderer` had type 0 — the SDK's real one initialises it with `AttachSystemEvent` | `hle_audio.cpp`: use `AttachSystemEvent` instead of writing raw handles |
| 10 | apparent hang in `sead::GameFramework::waitStartDisplayLoop_` | `atk::HardwareManager::AttachMemoryPool` polls `nn::audio::GetMemoryPoolState() == Attached` forever (no server applies the attach request) | `hle_audio.cpp`: `GetMemoryPoolState`/`IsMemoryPoolAttached` report attached |
| 11 | `FATAL: call to main+0x2920ff0` from `nn::audio::ListAudioDeviceName` | S2-era device API (`ListAudioDeviceName`/`GetActiveAudioDeviceName`) not HLE'd; it went through the null audren manager | `hle_audio.cpp`: HLE both (synthetic `"AudioTvOutput"`) |
| 12 | SIGSEGV in `AcquireAudioDeviceSwitchNotification` | same manager path | `hle_audio.cpp`: HLE it (event never signalled), `GetActiveChannelCount`, renderer time-limit get/set |
| 13 | SIGSEGV in `sead::SZSDecompressor::decomp` with `dst = 0` | `Lp::UI::Impl::DualHeap` allocation fails | **open** — see below |

## Open blocker: UI DualHeap allocation

`Lp::UI::Impl::RootArchiveLayoutResourceAccessor::loadImpl` (main+0x1304184) calls

```
Lp::Utl::loadResDecompHeap(name, heap = *(accessor + 0x98), 0x1000, 0, flag)
```

and `Lp::Utl::decompCompRes` then does `new[](0xe320, heap, 0x2000)`.

At the failure (gdb: `break SZSDecompressor::decomp if x0 == 0`):

* `heap` = `0x50c1ff0c70`, vtable `0x7102f65770` (`Lp::UI::Impl::DualHeap`),
  `[heap+0x108] = 0`.
* `DualHeap::tryAlloc` → `Context::tryAlloc` returns 0: the heap has no
  context/adapter (`[ctx+0x20]`, i.e. `[heap+0x128]`, is the null "current chunk").
* `DualHeap::create(...)` is called many times, but always with an adapter chosen
  per layout; the accessor's heap is never re-created after the point where its
  `+0x108`/`+0x128` are zero.
* `DualHeap::destroy()` does **not** clear `+0x108`, so the object was either
  created without the `create()` path or `create` bailed before setting it.
* File being decompressed: `content:/Layout/GearIcon_00.Nin_NX_NVN.szs`
  (3,349,568 bytes compressed, `0xe305` decompressed).

Next steps:

1. Break on `LayoutResourceMgr::beginCreate` (main+0x125abac) and
   `DualHeapAdapter::create` (main+0x12d30c8) to see whether the accessor's heap
   is ever created and with which sizes.
2. Inspect the accessor (`x19` in `loadImpl`) at `loadResDecompHeap`:
   `[accessor+0x98]` and its nested adapter (`[accessor+0x48]` region).
3. If the accessor's heap is meant to be created lazily, check whether the
   preceding `LayoutResourceMgr` call was skipped (e.g. an archive file missing
   from the romfs, so the fallback path built a plain `DualHeap`).

## Runtime services implemented for this title

| Service | Where | Notes |
|---|---|---|
| `hid` | `hle_hid.cpp` | `CreateAppletResource` + `IAppletResource::GetSharedMemoryHandle`, 0x1000-byte shared block |
| `set` | `svc_settings.cpp` (**new**) | language list (15 entries, enum order), system language, region |
| `audren` (client-level) | `hle_audio.cpp` | no server: stub renderer + frame event, attached memory pools, S2 device APIs |
| `aoc`/`oe`/`pctl` init | `main.cpp` | via `nninitInitializeSdkModule` |

## Files changed (WSL `~/sp2port`)

* `runtime/src/nvn/nvn_texture_layout.cpp` — this title's driver format table.
* `runtime/src/nvn/nvn.h` — `driver_or()`, `driver()` names a missing proc.
* `runtime/src/nvn/nvn_objects.cpp` — packaged-texture flag.
* `runtime/src/nvn/nvn_queue.cpp` — window-builder fields.
* `runtime/src/hle_hid.cpp` — `hid` service.
* `runtime/src/svc_settings.cpp` — **new**: `set` service.
* `runtime/src/main.cpp` — `nninitInitializeSdkModule` before `nnMain`.
* `runtime/src/hle_audio.cpp` — Splatoon 2 audio path.
* `runtime/src/ipc.cpp` — stub command log includes the caller's `lr`.
