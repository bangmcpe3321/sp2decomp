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
  `[heap+0x108]` = its adapter `0x50c160cfb8` (`Lp::UI::Impl::DualHeapAdapter`),
  `[heap+0x128]` = its current chunk `0x50c1ff1040`.
* The adapter's parent heap is `0x50c160ce88`, a `sead::ExpHeap` of
  **10,432,888 bytes** (0x9f3178).
* That page heap is the *Plaza page's sub-heap*, created by
  `Lp::UI::UIMgr::prepare` → `Cstm::UIMgrCstm::onPrepare` →
  `Cui::SystemPageMgr::initialize` → `createHandler<SysPlazaPageHandler>` →
  `Cui::PageHandler::load` → `Lp::UI::PageHolder::beginCreateSub(name)` →
  `sead::ExpHeap::create(size = 0, …, parent = the UI heap)`.
  `size = 0` means "take all remaining space of the parent".
* The UI heap (`0x50c011afe8`) is **32,395,288 bytes** and at that moment is
  fully divided among three live page heaps: 1,634,712 (page 1),
  20,325,536 (page 2) and the Plaza page 10,432,888. Its own parent is
  `0x50bbb1ae78`, a `sead::ExpHeap` of **105,795,976 bytes** (of which the UI
  heap holds all remaining space), so every level of the chain is an
  "all remaining space" sub-heap.
* Inside the Plaza page heap at the failure: **free = 61,160 bytes in one
  block** (at `0x50c1ff1060`), used = 10,371,728.
* The failing request is `new[](0xe320, heap, align 0x2000)` (58,144 bytes).
  Aligning the free block to 0x2000 wastes 3,968 bytes and the block header
  adds ~0x30, so ~62,200 bytes are needed: **the allocation is ~1 KB short.**
* The compressing source pointer is not the file start; the SZS being
  decompressed is an entry of the Layout archive (`GearIcon_00`), decompressed
  size `0xe305`. (The 3.3 MB `GearIcon_00.Nin_NX_NVN.szs` file on disk is
  itself a Yaz0-wrapped SARC that expands to 6,279,304 bytes.)

Interpretation: the game's own UI memory budget is extremely tight here — the
port is within ~1 KB of what the page heap can hold. The remaining delta is an
allocation-layout difference in the UI page (a few kilobytes over 10 MB), not a
wrong heap or a wrong size.

Measured allocation profile of the Plaza page heap (gdb breakpoint on
`sead::ExpHeap::tryAlloc` for `this == 0x50c160ce88`):

* **42,566 allocations, 9,429,558 bytes total** — all still live at the failure
  (nothing was freed).
* Largest blocks: 376,832 / 348,288 / 240,704 / 229,504 / 209,952 / 196,736 /
  168,416 bytes; all from `Lp::UI::Impl::DualHeap::Context::tryAlloc`
  (main+0x12d23d8), i.e. the game's layout decompression buffers.
* The rest are small layout/UI nodes; the remaining ~0.9 MB of the 10.37 MB used
  is ExpHeap block headers and rounding (0.4 % of the heap).

Two experiments tried and reverted:

* forwarding `GetStorageSize` to the driver's own `subsdk0+0x8c8d0` — it looks
  device-free in the first half of `subsdk0_0008C934`, but that function also
  calls the driver's storage-class query (`subsdk0_000862AC`), which dereferences
  device state the port never initialises; it crashed at `subsdk0+0x8639c`.
* returning the driver's default storage alignment (`0x200`) instead of the
  port's `512 * block_height` — the Plaza page heap's free space did not change
  by a byte, so textures are not placed in this heap (they use NVN memory pools).

Next steps:

1. Match the console's allocation stream exactly: the difference is ~0.4 % of the
   page's 9.4 MB, i.e. a few dozen KB, so a console/emulator reference of the
   same page's heap (or of `GetStorageSize` values) would pinpoint it.
2. Fabricate/initialise the driver's device struct (fields at `+0x78`, `+0x1948`,
   `+0x194c`, `+0x8c0`…) so the driver's real storage-size proc becomes usable;
   that removes any texture-size overestimate by construction.
3. Check the 56 DualHeap creations that are never matched by a `destroy` (821 vs
   765): if the port skips some destruction path, those chunks stay in the page
   heap.

## Driver storage-size/alignment code (Ghidra verified)

Ghidra 12.1.4 + GhidraMCP + the raw-AArch64 ELF (`re-work/subsdk0.elf`, base
`0x7180000000`, 3,175 functions) decompiled the driver chain:

| Address | Function | Role |
|---|---|---|
| `0x718008c8d0` | `nvnTextureBuilderGetStorageSize` | builds the layout via `0x8c934`; returns 0 unless the format-table entry's bit 0 is set |
| `0x718008c934` | layout builder | reads the format table at `DAT_718017ebd0` (`0x34` stride: `+8` block W, `+9` block H, `+0xe/+0xf` special-storage flags, `+0x10` bytes/block, `+0x2c` storage-class bits); calls `0x79e18` + `0x7a348`; **rounds the final size up to `[device+0x78]` only when `0x862ac` returns neither 0 nor 0xFE** |
| `0x718008be98` | `nvnTextureBuilderGetStorageAlignment` | `0x80` / `0x20` for flag bits 6/4; format class 10 → bytes/block; flags `& 0x50` → `0x200`; otherwise the storage-class query, then `[device+0x78]`, else **`0x200`** |
| `0x7180079e18` | layout fill | writes width/height/depth/levels/format/block fields into the layout struct |
| `0x718007a348` | size call | applies sample/MSAA scaling, then calls `0x71800b45c4` |
| `0x71800b45c4` | block-linear size math | device-free; per-level block-linear sizes with width/height/depth alignment and block-height choice |
| `0x71800862ac` | storage-class query | calls the external GPU-driver thunk `EXT_FUN_b4d14` with `[device+8]` — unavailable in the port, which is why forwarding `GetStorageSize` to the driver crashed |

Consequence: for ordinary formats the driver does **not** round the size to the
block; the port's `compute()` rounds every texture to `512 * block_height` and
also returns that as alignment. Transcribing `0x71800b45c4` + the layout rules of
`0x8c934`/`0x79e18` into `nvn_texture_layout.cpp` gives exact sizes without any
driver call, and alignment should be `0x200` for ordinary formats.

## Analysis tooling (GhidraMCP)

* Ghidra 12.1.4: `ghidra_12.1.4_PUBLIC_20260921/ghidra_12.1.4_PUBLIC`.
* Extension `GhidraMCP-7.0.0` installed in `%APPDATA%\ghidra\ghidra_12.1.4_PUBLIC\Extensions\GhidraMCP` and enabled in `FrontEndTool.xml`; HTTP server on `127.0.0.1:8089` (`/check_connection`, `/mcp/schema` = 205 tools).
* Bridge: `ghidra-mcp\venv\Scripts\bridge-mcp-ghidra.exe` (wheel 7.0.0, `mcp==1.30.0`, `pydantic 2.14.1`); registered in OpenCode as `ghidra-mcp` with `GHIDRA_MCP_URL=http://127.0.0.1:8089`.
* `re-work/subsdk0.elf` is a one-segment ELF64/AArch64 wrapper around
  `private/analysis/subsdk0.bin` with a `.symtab` built from
  `gen/subsdk0/table.cpp` (the tool is `mkelf.py`); Ghidra imported it and
  auto-analysed it.


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

## Green boot: display loop reached (2026-10-19)

`RootTask::prepare_` now completes, `Lp::UI` builds its whole page set and the
display loop runs: **60.0 fps, 1 submit/frame, `nvn: present #N` for N = 2048+
over a 90 s run** (a 240 s run also completed without a fatal). What that took,
in order:

### 1. UI page-set memory (the `Layout/Ticket_00` / `0x33420` failure)

`Cui::SystemPageMgr::initialize` (called from `Cstm::UIMgrCstm::onPrepare`, via
`Lp::UI::UIMgr::prepare` in `IRootTaskCstm::createVariousParts`) creates four
page handlers — `BootPageHandler`, `CustomizePageHandler`, `SysPlazaPageHandler`,
`SysWorldPageHandler` — and each creates a page heap with
`sead::ExpHeap::create(size = 0)` from the UI heap (all remaining), trimmed to
live usage after the page is built:

| heap | who | size |
|---|---|---|
| arena (105.8 MB, all remaining) | `Lp::Sys::HeapGroup::createHeap` | `0x64E5188` |
| `Cstm::ResMgr` | `Cstm::ResMgr::ResMgr` (`0x19CE8C`) | 50 MB (`0x3200000`) |
| `Lp::Sys::EffectMgr` | `EffectMgr` ctor (config query, default 4 MB) | 20 MB (`0x1400000`) |
| Cstm UI heap | `Cstm::UIMgrCstm::onPrepare` | remainder = 32.4 MB |
| UI_Boot | `BootPageHandler` | 1,634,712 |
| UI_Customize | `CustomizePageHandler` | 20,325,536 |
| UI_SysPlaza | `SysPlazaPageHandler` | 12,079,704 |
| UI_World | `SysWorldPageHandler` | 11,868,336 + second page (3.2 MB+) |

The plaza page builds panes from the same heap (`LayoutAllocator::setHeap` →
`LayoutAllocator::allocFunc`, `sead::ExpHeap::tryAlloc`): the failing request was
a **209,952-byte DualHeap chunk** for `Layout/Ticket_00`, with only 61,160 bytes
free. Texture storage was ruled out (changing `GetStorageSize` rounding moved
neither the plaza free space nor its size).

The layout data in this romfs (the updated one) needs ≈49 MB of page heaps,
while the base executable's fixed budgets leave 32.4 MB for them, so the last
page always starved. `Cstm::ResMgr` is not a safe donor: it is empty at boot
(52,428,496 of 52,428,800 free) but `Cmn::StaticResLoader::loadStatic` later
creates its **20 MB** static-resource heap from it, so shrinking it to 20 MB
makes `ModelArc` receive a null resource and crash.

**Fix:** `QueryMemoryInfo` now reports a **3.1 GB** sead arena instead of 3.0 GB
(`mi[2]-mi[3] = 0xC7000000`; the process heap reserved by `svcSetHeapSize` is
`0xC9200000`, so 32 MB + arena still fits). That is hardware-plausible for the
4 GB Switch and gives the arena's last "all remaining" heap the ~112 MB the
updated page data needs. With it, ResMgr keeps its real 50 MB and the static
loader works.

### 2. Save-data abort (`svcBreak` in `nn::diag`)

`Cstm::SaveDataMgr::save` → `sead::NinSaveFileDevice::tryCommit` → the GOT slot
at `0x2F9B3F0` is relocated to **`nn::fs::CommitSaveData`**, which had no HLE, so
it fell through to the SDK implementation and the stubbed `fsp-srv` → abort.
HLE'd `CommitSaveData` (no-op: saves are host files already),
`SetResultHandledByApplication` and `SetLocalApplicationAccessLog`.
Frames then advanced from #8 to #16.

### 3. Friends presence crash

`Lp::Net::FriendPresenceMgr::declareOnlinePlaySessionImpl` →
`nn::friends::DeclareCloseOnlinePlaySession` → the SDK caches a null
`IFriendService` (stubbed `friends:u`) and dereferences it. New
`runtime/src/hle_friends.cpp` makes the whole presence API a successful no-op
(Initialize, SetAllocator, UserPresence Initialize/SetAppValue/Commit,
DeclareOpen/CloseOnlinePlaySession, NotificationQueue Initialize/Finalize/Pop).
Frames advanced from #16 to #64.

### 4. Headless GPU was never initialised

`nvn_vk::init()` required `make_surface()`. Lavapipe's
`vkCreateHeadlessSurfaceEXT` returns `-7`, so init failed, `g_failed` stayed set,
and every later `gpu_present` returned before `present_headless`. The "presents"
counted earlier were **counters only; nothing was rendered**. In headless mode
init now continues without a surface and accepts a graphics-only queue
(`present_headless` never uses a swapchain). The GPU now runs for real:
`nvn/vk: per frame over 60: 60.0 fps, 1.0 submits, replay 0.17 ms`.

### 5. Current blocker: untranslated shaders

With real rendering:
`nvn draws: 554522 total, 0 done, 554522 no program` — every draw is skipped
because `private/spirv/<hash>.spv` does not exist (the port uses offline
`Ryujinx.Graphics.Shader` translations, see `nvn_shaders.cpp`). The frame dump
(`NX_DUMP_FRAMES`) therefore stays blank: the presented texture is never
transitioned out of `UNDEFINED` because no draw touches it.

Shader inventory captured for translation:
`NX_DUMP_SHADER_MISSES=1` wrote **6302** `code_<hash>.bin` / `ctrl_<hash>.bin`
pairs (82 MB) to `private/shader_misses/`. Next step: run the offline translator
to produce `private/spirv/<hash>.spv` + `results.tsv`.

### 6. Next crash behind the shaders

When frames actually run, `agl::utl::DynamicTextureAllocator::alloc_`
(`0xF05A00`) calls `dump_(0..3)` → `TextureMemoryAllocator::dumpDetail()`
(`0xF2C2F0`) and faults at `0x8` around present #2048. That path carves dynamic
textures using NVN storage size/alignment, so the port's `GetStorageSize`
(today: block-rounded, and 0 when the format-table entry's bit 0 is clear) is
the first suspect; revisit after the shader translation.

### Changed files (WSL `~/sp2port`)

* `runtime/src/hle_os.cpp` — arena `0xC0000000` → `0xC7000000` in `QueryMemoryInfo`.
* `runtime/src/hle_fs.cpp` — `CommitSaveData`, `SetResultHandledByApplication`, `SetLocalApplicationAccessLog` HLEs.
* `runtime/src/hle_friends.cpp` — **new**: offline presence API.
* `runtime/src/nvn/nvn_vk.cpp` — headless init without a surface; graphics-only queue.
* `runtime/src/nvn/nvn_texture_layout.cpp` — kept the validated block rounding (the exact driver transcription is still open).
