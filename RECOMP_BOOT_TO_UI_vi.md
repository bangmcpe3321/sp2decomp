# Cổng được biên dịch — khởi động màu xanh lá cây: hiển thị vòng lặp và khung thật

This is the state of the recompiled PC port (`~/sp2port`, runtime under
`runtime/src/`) as of 2026-10-20. It is a living log: each row of the ladder was
Một người thực sự chết, được chẩn đoán từ một chồng riêng của khách và sửa chữa trong thời gian chạy.

The port now enters `nnMain`, initialises NVN/sead graphics, HID, settings, the
SDK's own module init and audio, completes `RootTask::prepare_`, returns from
`sead::GameFramework::waitStartDisplayLoop_` and runs the display loop with
**real, non-black frames**: a 150 s run presents to `#1024` with the boot tip
ô tô và màn hình tiêu đề trên màn hình, không gây tử vong, không lỗi hợp lệ và không có
cuộc gọi không rõ điều khiển. Hai chặn cuối cùng là một kết cấu BC3 bị ràng buộc như một bản vẽ
Mục tiêu (máy SIGFPE) và danh sách lệnh thả xuống bởi thám hiểm trọn đời của cổng.
(mà làm cho mọi khung đen); cả hai được mô tả bên dưới.
Cửa sổ bản xứ xây dựng cùng nguồn, do đó cổng cũng chạy trên máy GPU
(TX 3060, 60 fps) thay vì dung nham ống.

## 2026-10-20: văn bản có thể đọc được, và khởi động chết người giải thích

Ba lần sửa chữa di chuyển cổng từ "boots nhưng mỗi nhãn là một đốm trắng, sau đó gây tử vong trong
Người chơi make" cho một dòng chữ hoàn thành, cắt giới thiệu, và hậu nội thất
Màn hình hướng dẫn bằng tiếng Anh.

### Trò chơi nói tiếng Nhật bởi vì các mã ngôn ngữ đã được hte-swapped

`nn::settings::LanguageCode` is a `char[8]`; the game compares the tag it gets back against
Danh sách ngôn ngữ bàn điều khiển riêng. Cổng được cất giữ dưới mỗi thẻ dạng số * có độ cao byte
the tag's first character (`0x656E2D5553` for `en-US`), and little-endian guest memory
therefore read `"SU-ne"`. No tag matched, so the game fell back to Japanese and opened
`/Message/CommonMsg_JPja.szs` — while `nn::oe::GetDesiredLanguage` (a `memcpy` of `"en-US"`
in `svc_am.cpp`) already answered correctly. With the codes derived from their literals at
compile time the game opens `/Message/CommonMsg_USen.szs` and every label is English
(`tools/patches/patch-language-code.py`).

![PlayerMake eye colour step, English](docs/images/boot-playermake-en.png)

*`Pick an eye color!` — the same screen after the language fix.*

### Khởi động gây tử vong là một cuộc gọi thả đuôi, không phải một con bọ dễ nổi bật

Triệu chứng:

```
FATAL: call to 50c12201b8 (50c12201b8), lr main+1d95d4
       (_ZN3Cui17CustomizePartsSet12onInitializeEPKv+a4)
```

`onInitialize` (`0x1D9530`) calls `Cui::Page::findPartsControl` (`0x20BD74`) for each of
`/L_ItemBtn_00..17`, then calls `(*ctrl)[0](ctrl, &expected_type)`. Runtime probes showed
the returned object was `page + 0x3f0 → +0x38` — the control **list**, not a control —
Từ đầu tiên của họ là một con trỏ, do đó, "vible" nhảy vào đống.

`findPartsControl` is three guest instructions:

```asm
ldr x8, [x0, #0x3f0]
add x0, x8, #0x38
b   0x20cf60        ; Control::List::searchAs<PartsCtrl>
```

The recompiler emitted the first two and **dropped the `b`**, so the function returned
the list pointer as if it were a found control. `searchAs` never ran, so its own type
Kiểm tra không bao giờ từ chối đối tượng. Bố trí Heap quyết định chế độ bị lỗi: khi danh sách bị lỗi.
Từ đầu tiên xảy ra trông giống như một địa chỉ được gọi là cổng chết; trong khác xây dựng
Kiểm tra trả lời sai và mọi bộ phận kiểm soát bị mất âm thầm từ UI.

Một bản quét của tất cả các chức năng tạo ra trong mỗi mô- đun (chỉ dẫn khách cuối cùng là một
unconditional `b` to another function, but the generated body has no call to it) finds
**Đây là trường hợp duy nhất trong toàn bộ trò chơi**:

```bash
python3 tools/rework/find-dropped-tailcalls.py
# main: functions ending in b 20074, dropped 1
#    20BD74 .. b at 20BD7C -> 20CF60
```

The fix re-adds the call (`tools/patches/patch-tailcall-20bd74.py`); it is a tail call,
so not touching `x30` is correct — the emulated callee returns to the same guest caller.

### Mục lục được viết bằng CPU: đóng gói các hàng của nó

The font atlas is a 2048×2048 R8 texture with `stride 0` (builder: tiled), swizzle
`02010101` = (R,1,1,1) and `alpha_from_r`. Widening R8 → RGBA8 made text *appear* but
garbled; the `NX_DUMP_ALPHA` dump of the uploaded atlas (alpha shown as grey) was
Âm thanh theo chiều ngang — sự giải thích cho bộ nhớ mà trò chơi viết như
Hàng đơn giản.

The CPU writes the atlas (nothing uploads it: no draw, copy or `nvnTextureWriteTexels`
targets the pool), so `stride 0` means "packed rows of `width` bytes" here, not tiling.
`row_stride = stride ? stride : width` plus the (255,255,255,R) widening makes every
label legible (`tools/patches/patch-alpha-atlas.py`).

![PlayerMake hair step with legible text](docs/images/boot-text-legible.png)

*After both fixes: `ヘアスタイルは どれにする？` ("Which hairstyle?") is readable, and the
Dòng chảy đi qua cầu thủ sáu bước.

![Confirmation page](docs/images/boot-confirm-text.png)

*`この設定でオッケー？` — the confirmation page. The small bottom-left hint still comes from a
thứ hai, những bản chất nhỏ hơn không được bao phủ bởi sự sửa chữa này.

Còn lại, theo thứ tự: các mô hình inkling vẫn còn vắng mặt với các màu đi qua; đầu tiên
màn hình sau khi nội dung đặt ra một hộp văn bản kích cỡ phông chữ 100 và sụp đổ
`nn::font::TextureCache::CalculateCharWidth` → `FSS_set_scale` → `get_scale_inputs`
(data address `0x20`, the FSS face handed to the scaler is invalid), so the port does not
reach the title yet. (The earlier `TutorialGuideMsgPage` → `FSS_set_cmap` crash is the same
họ: một gương mặt phông chữ mà bộ nhớ tạm ám chỉ không phải là một khuôn mặt FSS dễ dùng.)

## Đang chạy

```bash
cd ~/sp2port
VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/lvp_icd.json NX_HEADLESS=1 ./sp2
# NX_TRACE=1      verbose (svc / HLE / IPC / NVN)
# NX_TRACE_FS=1   every file the game opens
# NX_DUMP_FRAMES=100  write private/frames/00100.ppm, 00200.ppm, ... from the presented texture
# NX_NO_KEEP_LISTS=1  restore the old command-list drop rule (frames go black, see below)
# NX_CV_HIST=1    record the last 4096 condition-variable events; a hang report prints the stuck keys' histories
```

A healthy run ends in exit 124 (the timeout), prints `nvn: present #N` throughout
and leaves no `fault report`, no `SIGSEGV`/`SIGFPE` and no `VUID` line.

For a quick look at the picture: `./shot.sh [seconds] [every]` (default 90 s,
Mỗi 100 khung) khởi động các cổng, in các món quà/fps/ handps tóm tắt và
converts the fresh dumps to PNGs — `ppm2png.py` does the conversion alone, and
`shot.sh` also copies the PNGs to `C:\Users\Hexa\Documents\nintendo\frames\`.
Màn hình mẹo xuất hiện từ khung 300 trên; trước đó ( khung ~100-250)
Màn hình tiêu đề bao phủ khung.

The game's romfs must be reachable: `private/extract/romfs` is a symlink to the
`romfs/` directory produced by hactool.

On the **host GPU** (no lavapipe): build `sp2.exe` with `./build-win.sh` in WSL
and run it on Windows — `tools/wsl/run-win.ps1` does the staging, the romfs
Giao lộ và chạy thời gian (phần 10):

```powershell
powershell -File tools\wsl\run-win.ps1 -Seconds 120        # -DumpEvery 0 for speed
```

Xây dựng lại một chiều + liên kết lại (kiểu được dùng cho mỗi sửa chữa bên dưới):

```bash
cd ~/sp2port
g++ -std=c++20 -c -O1 -w -I runtime/include -I runtime/src -I ~/vkheaders/include \
    runtime/src/<file>.cpp -o obj-all/_runtime/<file>.o
GEN=$(find obj-all -name '*.o' | grep -v _runtime | tr '\n' ' ')
RTO=$(find obj-all/_runtime -name '*.o' | tr '\n' ' ')
g++ -o sp2.new $GEN $RTO -lm -lc -lgcc -lpthread -ldl && mv sp2.new sp2
```

## Thang khởi động

Mọi lối vào đều là một cái chết đã được đánh và sửa chữa trong suốt quá trình này, theo thứ tự.

| # |Triệu chứng|Nguyên nhân|Sửa|
|---|---------|-------|-----|
| 1 | SIGSEGV inside HLE `GetStorageSize` → `format_info()` (`module_base + 0xd34198 + fmt*0x30`) |Cổng được dùng khe định dạng SDK trước đó| `nvn/nvn_texture_layout.cpp`: this title's driver table — slot `subsdk0+0x17ebd0`, stride `0x34`, fields `+8`/`+9`/`+16` |
| 2 | `FATAL: call to 0` inside `nvnTextureInitialize` | port called `nvnTextureBuilderGetPackagedTextureLayout`, absent from this driver | `nvn/nvn.h`: `driver_or()` + `driver()` fatals naming the proc; `nvn/nvn_objects.cpp`: fall back to `nvnTextureBuilderGetPackagedTextureData` |
| 3 | `FATAL: nvn: this title's driver has no nvnWindowBuilderGetNumTextures` |Trình xây dựng cửa sổ của SDI này khác nhau| `nvn/nvn_queue.cpp`: read builder fields directly (`+8` count, `+0x10` texture array, `+0x20` interval−1) |
| 4 | SIGSEGV at 0 in `nn::hid::detail::SharedMemoryAccessor::Activate` | the `hid` IPC service was a bare stub: `CreateAppletResource` returned no object, so `[accessor+0x38]` stayed null | `hle_hid.cpp`: implement `hid` cmd 0 (CreateAppletResource → applet-resource session) and `IAppletResource` cmd 0 (GetSharedMemoryHandle → kernel shared memory) |
| 5 | `svcBreak` abort in `nn::settings::LanguageCode::Make` | the `set` service was a stub, so `detail::MakeLanguageCode` could not fill `codes[15]` (`set cmd 1`) | `svc_settings.cpp` (**new**): `set` cmd 0/1/2/3/4 — language list in enum order, system language `en-US`, region Americas |
| 6 | SIGSEGV at `0x8` in `Lp::Sys::ResMgr::load_` | `private/extract/romfs` was empty | symlink the hactool `romfs/`; `System/GameConfigSetting.xml` then loads |
| 7 | SIGSEGV at 0 in `nn::aoc::ListAddOnContent` | the SDK's own `nninitInitializeSdkModule` (main+0x1c8) never ran, so `nn::aoc`'s object holder stayed null | `main.cpp` `nn_main()`: call `nninitInitializeSdkModule` after the module constructors and before `nnMain` (runs `nn::oe`, `nn::aoc`, `nn::fs` flags, `nn::pctl`, abort observer) |
| 8 | `FATAL: CreateAudioRendererManagerByDfc not found` | this SDK has **no** in-process audio renderer (no DFC manager, no `AudioRenderSystem`); the Wonder-era in-process path cannot work | `hle_audio.cpp`: `CreateAudioRendererManagerByHipc` fails cleanly; `OpenAudioRenderer` stubs a handle and attaches the game's frame event to the port's 5 ms event |
| 9 | guest `svcBreak` in `nn::os::SignalSystemEvent` | the event handed out by `OpenAudioRenderer` had type 0 — the SDK's real one initialises it with `AttachSystemEvent` | `hle_audio.cpp`: use `AttachSystemEvent` instead of writing raw handles |
| 10 | apparent hang in `sead::GameFramework::waitStartDisplayLoop_` | `atk::HardwareManager::AttachMemoryPool` polls `nn::audio::GetMemoryPoolState() == Attached` forever (no server applies the attach request) | `hle_audio.cpp`: `GetMemoryPoolState`/`IsMemoryPoolAttached` report attached |
| 11 | `FATAL: call to main+0x2920ff0` from `nn::audio::ListAudioDeviceName` | S2-era device API (`ListAudioDeviceName`/`GetActiveAudioDeviceName`) not HLE'd; it went through the null audren manager | `hle_audio.cpp`: HLE both (synthetic `"AudioTvOutput"`) |
| 12 | SIGSEGV in `AcquireAudioDeviceSwitchNotification` |Cùng một đường dẫn quản lý| `hle_audio.cpp`: HLE it (event never signalled), `GetActiveChannelCount`, renderer time-limit get/set |
| 13 | SIGSEGV in `sead::SZSDecompressor::decomp` with `dst = 0` | `Lp::UI::Impl::DualHeap` allocation fails |**fixed** - xem "UI page-set bộ nhớ" bên dưới|
| 14 |host SIGFPE (division by zero in llVM InstComine) bên trong llvmath trong một bản vẽ| a **packaged BC3 cubemap** was bound as a colour render target: rendering into a block-compressed image is invalid (`08912`) and llvmpipe's generated store became 0 bits | `nvn/nvn_image.cpp` + `nvn/nvn_draw.cpp`: `compressed_image()` guard — a compressed colour/depth slot is handled image-less (dummy attachment) |
| 15 |Mỗi khung màu đen mặc dù 115k vẽ trên 62 s chạy và hoàn thành| the command-memory usage estimate saturates (`used()` clamps at `size-64`), after which every recording looks like it starts at the same byte and the overlap rule drops the previous list; Splatoon 2 records per-frame lists once and submits those handles all session, so those submits replayed nothing | `nvn/nvn_cmd.cpp`: a dropped list is kept and later submits/calls are served from the recorded copy (`NX_NO_KEEP_LISTS=1` restores the old rule) |

## Bộ chặn mở: bộ định vị UI Dual Heap

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
  **10,432.888 byte**(0x9f3178).
* Trang giấy đó là *Plaza page sub-heap* được tạo ra bởi
  `Lp::UI::UIMgr::prepare` → `Cstm::UIMgrCstm::onPrepare` →
  `Cui::SystemPageMgr::initialize` → `createHandler<SysPlazaPageHandler>` →
  `Cui::PageHandler::load` → `Lp::UI::PageHolder::beginCreateSub(name)` →
  `sead::ExpHeap::create(size = 0, …, parent = the UI heap)`.
  `size = 0` means "take all remaining space of the parent".
* The UI heap (`0x50c011afe8`) is **32,395,288 bytes** and at that moment is
  Toàn bộ được chia cho ba trang trực tiếp: 1.634.712 (trang 1)
  20,325.536 (trang 2) và trang 10,432.888.
  `0x50bbb1ae78`, a `sead::ExpHeap` of **105,795,976 bytes** (of which the UI
  Chất đống giữ lại tất cả các không gian còn lại, vì vậy mỗi cấp độ của chuỗi là một
  "Tất cả không gian còn lại" sub-heap.
* Bên trong khối Plaza tại thất bại: ** free = 61,160 byte trong một
  block** (at `0x50c1ff1060`), used = 10,371,728.
* The failing request is `new[](0xe320, heap, align 0x2000)` (58,144 bytes).
  Giới hạn khối miễn phí 0x2000 chất thải 3.968 byte và đầu khối
  thêm ~0x30, vì vậy ~2.200 byte là cần thiết: **Sự phân phối là ~1 KB short.**
* Con trỏ nguồn nén không phải là khởi động tập tin; mà là SZS
  decompressed is an entry of the Layout archive (`GearIcon_00`), decompressed
  size `0xe305`. (The 3.3 MB `GearIcon_00.Nin_NX_NVN.szs` file on disk is
  bản thân một chiếc Yaz0 bọc SARC mở rộng đến 6.279.304 byte.)

Giải thích: ngân sách bộ nhớ UI của trò chơi là cực kỳ chặt chẽ ở đây -
Cổng nằm trong ~1 KB của những gì các chồng trang có thể giữ. Delta còn lại là một
Sự khác biệt định vị trong trang UI (một vàikg trên 10 MB), không phải là a
sai chỗ hoặc sai cỡ.

Hồ sơ định vị được đo của khối Plaza trang (gdb breakpoint trên
`sead::ExpHeap::tryAlloc` for `this == 0x50c160ce88`):

* **42.566 mã định vị, 9.429.558 byte tổng cộng** — tất cả vẫn còn sống trong thất bại
  (không có gì được giải phóng).
* Những khối lớn nhất: 366,832 / 338.288 / 240.704 / 229.504 / 209.952 / 196,736 / 209
  168,416 bytes; all from `Lp::UI::Impl::DualHeap::Context::tryAlloc`
  (mai + 0x12d23d8), tức là bố trí của trò chơi giảm áp lực đệm.
* Phần còn lại là bố trí nhỏ/UI nodes; còn lại ~0.9 MB của 10,37 MB sử dụng
  là Exp Heap headers và tròn (0.4% của đống).

Hai thí nghiệm đã thử và phục hồi:

* forwarding `GetStorageSize` to the driver's own `subsdk0+0x8c8d0` — it looks
  device-free in the first half of `subsdk0_0008C934`, but that function also
  calls the driver's storage-class query (`subsdk0_000862AC`), which dereferences
  device state the port never initialises; it crashed at `subsdk0+0x8639c`.
* returning the driver's default storage alignment (`0x200`) instead of the
  port's `512 * block_height` — the Plaza page heap's free space did not change
  bởi một byte, do đó, kết cấu không được đặt trong đống này (họ sử dụng hồ sơ NVN).

Bước tiếp theo:

1. Khớp dòng định vị của bàn điều khiển một cách chính xác: sự khác biệt là ~0.4 % của các dòng
   trang 9.4 MB, tức là một vài tá KB, do đó, một bàn giao tiếp/mulator tham chiếu của các
   same page's heap (or of `GetStorageSize` values) would pinpoint it.
2. Fabricate/initialise the driver's device struct (fields at `+0x78`, `+0x1948`,
   `+0x194c`, `+0x8c0`…) so the driver's real storage-size proc becomes usable;
   Nó loại bỏ bất kỳ kết cấu có cấu trúc cao bằng cách xây dựng.
3. Check the 56 DualHeap creations that are never matched by a `destroy` (821 vs
   765: nếu cổng vượt qua một số con đường phá hủy, những mảng đó sẽ ở lại trong trang
   Vớ vẩn.

## Mã quản lý kho lưu trữ cỡ/ghidra được kiểm tra

Ghidra 12.1.4 + GhidraMCP + the raw-AArch64 ELF (`re-work/subsdk0.elf`, base
`0x7180000000`, 3,175 functions) decompiled the driver chain:

|Địa chỉ|Hàm|Nhiệm vụ|
|---|---|---|
| `0x718008c8d0` | `nvnTextureBuilderGetStorageSize` | builds the layout via `0x8c934`; returns 0 unless the format-table entry's bit 0 is set |
| `0x718008c934` |bố trí| reads the format table at `DAT_718017ebd0` (`0x34` stride: `+8` block W, `+9` block H, `+0xe/+0xf` special-storage flags, `+0x10` bytes/block, `+0x2c` storage-class bits); calls `0x79e18` + `0x7a348`; **rounds the final size up to `[device+0x78]` only when `0x862ac` returns neither 0 nor 0xFE** |
| `0x718008be98` | `nvnTextureBuilderGetStorageAlignment` | `0x80` / `0x20` for flag bits 6/4; format class 10 → bytes/block; flags `& 0x50` → `0x200`; otherwise the storage-class query, then `[device+0x78]`, else **`0x200`** |
| `0x7180079e18` |đổ dốc màu bố trí|viết độ rộng/hight/depth/ levels/format/ blocks vào bố trí struct|
| `0x718007a348` |cuộc gọi kích cỡ| applies sample/MSAA scaling, then calls `0x71800b45c4` |
| `0x71800b45c4` |Toán học kích cỡ khối|Không có thiết bị; kích cỡ khối theo cấp độ với chiều rộng/ cân nặng/ chiều rộng và sự chọn khối|
| `0x71800862ac` |truy vấn cấp lưu trữ| calls the external GPU-driver thunk `EXT_FUN_b4d14` with `[device+8]` — unavailable in the port, which is why forwarding `GetStorageSize` to the driver crashed |

Sự kết hợp: cho định dạng thông thường trình điều khiển không nhờ** vòng kích cỡ
block; the port's `compute()` rounds every texture to `512 * block_height` and
also returns that as alignment. Transcribing `0x71800b45c4` + the layout rules of
`0x8c934`/`0x79e18` into `nvn_texture_layout.cpp` gives exact sizes without any
driver call, and alignment should be `0x200` for ordinary formats.

## Phân tích tương ứng (GhidraMCP)

* Ghidra 12.1.4: `ghidra_12.1.4_PUBLIC_20260921/ghidra_12.1.4_PUBLIC`.
* Extension `GhidraMCP-7.0.0` installed in `%APPDATA%\ghidra\ghidra_12.1.4_PUBLIC\Extensions\GhidraMCP` and enabled in `FrontEndTool.xml`; HTTP server on `127.0.0.1:8089` (`/check_connection`, `/mcp/schema` = 205 tools).
* Bridge: `ghidra-mcp\venv\Scripts\bridge-mcp-ghidra.exe` (wheel 7.0.0, `mcp==1.30.0`, `pydantic 2.14.1`); registered in OpenCode as `ghidra-mcp` with `GHIDRA_MCP_URL=http://127.0.0.1:8089`.
* `re-work/subsdk0.elf` is a one-segment ELF64/AArch64 wrapper around
  `private/analysis/subsdk0.bin` with a `.symtab` built from
  `gen/subsdk0/table.cpp` (the tool is `mkelf.py`); Ghidra imported it and
  Phân tích tự động.


## Dịch vụ chạy thời gian thực hiện cho tiêu đề này

|Dịch vụ|Ở đâu|Ghi chú|
|---|---|---|
| `hid` | `hle_hid.cpp` | `CreateAppletResource` + `IAppletResource::GetSharedMemoryHandle`, 0x1000-byte shared block |
| `set` | `svc_settings.cpp` (**new**) |danh sách ngôn ngữ (4 mục nhập, thứ tự danh sách), ngôn ngữ hệ thống, vùng|
| `audren` (client-level) | `hle_audio.cpp` |không có máy phục vụ: stbparer + khung sự kiện, gắn kết hồ sơ bộ nhớ, thiết bị S2|
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

## Khởi động xanh lá cây: vòng lặp hiển thị đạt (2026-10-19)

`RootTask::prepare_` now completes, `Lp::UI` builds its whole page set and the
display loop runs: **60.0 fps, 1 submit/frame, `nvn: present #N` for N = 2048+
Hơn 90 s chạy** (một chiếc 240 s chạy cũng hoàn thành mà không gây tử vong).
Thứ tự:

### 1. UI page-set memory (the `Layout/Ticket_00` / `0x33420` failure)

`Cui::SystemPageMgr::initialize` (called from `Cstm::UIMgrCstm::onPrepare`, via
`Lp::UI::UIMgr::prepare` in `IRootTaskCstm::createVariousParts`) creates four
page handlers — `BootPageHandler`, `CustomizePageHandler`, `SysPlazaPageHandler`,
`SysWorldPageHandler` — and each creates a page heap with
`sead::ExpHeap::create(size = 0)` from the UI heap (all remaining), trimmed to
sử dụng trực tiếp sau khi xây dựng trang:

|đống|Ai|Cỡ|
|---|---|---|
|Đấu trường (105.8 MB, tất cả còn lại)| `Lp::Sys::HeapGroup::createHeap` | `0x64E5188` |
| `Cstm::ResMgr` | `Cstm::ResMgr::ResMgr` (`0x19CE8C`) | 50 MB (`0x3200000`) |
| `Lp::Sys::EffectMgr` | `EffectMgr` ctor (config query, default 4 MB) | 20 MB (`0x1400000`) |
|Đống UI Cstm| `Cstm::UIMgrCstm::onPrepare` |Phần còn lại = 32.4 MB|
|UI_ Boot| `BootPageHandler` | 1,634,712 |
|UI_Customize| `CustomizePageHandler` | 20,325,536 |
|UI_SysPlaza| `SysPlazaPageHandler` | 12,079,704 |
|_Thế giới| `SysWorldPageHandler` |11,868,336 và trang thứ hai (4.2 MB+)|

The plaza page builds panes from the same heap (`LayoutAllocator::setHeap` →
`LayoutAllocator::allocFunc`, `sead::ExpHeap::tryAlloc`): the failing request was
a **209,952-byte DualHeap chunk** for `Layout/Ticket_00`, with only 61,160 bytes
free. Texture storage was ruled out (changing `GetStorageSize` rounding moved
Không phải là không gian tự do hay kích thước của quảng trường.

Các dữ liệu bố trí trong này rmfs (người được cập nhật) cần _49 MB trang chồng,
Trong khi các tập tin thực thi cơ sở cố định ngân sách còn lại 32.4 MB cho họ, vì vậy cuối cùng
page always starved. `Cstm::ResMgr` is not a safe donor: it is empty at boot
(52,428,496 of 52,428,800 free) but `Cmn::StaticResLoader::loadStatic` later
tạo ra **20 MB** từ nó tĩnh-resource, vì vậy thu hẹp nó đến 20 MB
makes `ModelArc` receive a null resource and crash.

**Fix:** `QueryMemoryInfo` now reports a **3.1 GB** sead arena instead of 3.0 GB
(`mi[2]-mi[3] = 0xC7000000`; the process heap reserved by `svcSetHeapSize` is
`0xC9200000`, so 32 MB + arena still fits). That is hardware-plausible for the
4 GB chuyển và cung cấp cho đấu trường cuối cùng "tất cả còn lại" chất lượng ~112 MB
Với dữ liệu cập nhật trang cần. với nó, ResMgr giữ cho nó thực sự 50 MB và tĩnh
Bộ tải hoạt động tốt.

### 2. Save-data abort (`svcBreak` in `nn::diag`)

`Cstm::SaveDataMgr::save` → `sead::NinSaveFileDevice::tryCommit` → the GOT slot
at `0x2F9B3F0` is relocated to **`nn::fs::CommitSaveData`**, which had no HLE, so
it fell through to the SDK implementation and the stubbed `fsp-srv` → abort.
HLE'd `CommitSaveData` (no-op: saves are host files already),
`SetResultHandledByApplication` and `SetLocalApplicationAccessLog`.
Sau đó, các khung được nâng lên từ #8 đến #16.

### 3. Bạn bè gặp tai nạn

`Lp::Net::FriendPresenceMgr::declareOnlinePlaySessionImpl` →
`nn::friends::DeclareCloseOnlinePlaySession` → the SDK caches a null
`IFriendService` (stubbed `friends:u`) and dereferences it. New
`runtime/src/hle_friends.cpp` makes the whole presence API a successful no-op
(Chính thức, SetAllocator, Người dùng khởi tạo/ Thiết lập Value/Clemit,
Thông báo Mở/Cose OnlinePlaySession, Thông báoQue sở khởi/Finize/Pop).
Những cái khung được nâng cấp từ #16 đến #64.

### 4. GPU không đầu đã không bao giờ được khởi động

`nvn_vk::init()` required `make_surface()`. Lavapipe's
`vkCreateHeadlessSurfaceEXT` returns `-7`, so init failed, `g_failed` stayed set,
and every later `gpu_present` returned before `present_headless`. The "presents"
đếm trước đó là chỉ **gers; không có gì đã được thực hiện**. Trong chế độ không có đầu
init vẫn tiếp tục mà không có bề mặt và chấp nhận một hàng đợi đồ hoạ duy nhất
(`present_headless` never uses a swapchain). The GPU now runs for real:
`nvn/vk: per frame over 60: 60.0 fps, 1.0 submits, replay 0.17 ms`.

### 5. Máy chặn hiện thời: các bóng râm không được cấu hình

Với cách dịch thật:
`nvn draws: 554522 total, 0 done, 554522 no program` — every draw is skipped
because `private/spirv/<hash>.spv` does not exist (the port uses offline
`Ryujinx.Graphics.Shader` translations, see `nvn_shaders.cpp`). The frame dump
(`NX_DUMP_FRAMES`) therefore stays blank: the presented texture is never
transitioned out of `UNDEFINED` because no draw touches it.

Hàng tồn kho Shader bị giữ để dịch:
`NX_DUMP_SHADER_MISSES=1` wrote **6302** `code_<hash>.bin` / `ctrl_<hash>.bin`
pairs (82 MB) to `private/shader_misses/`. Next step: run the offline translator
to produce `private/spirv/<hash>.spv` + `results.tsv`.

### 6. Vụ va chạm tiếp theo phía sau bóng râm

When frames actually run, `agl::utl::DynamicTextureAllocator::alloc_`
(`0xF05694`; the calls are at `0xF05A70..0xF05A94`) calls `dump_(0..3)` →
`TextureMemoryAllocator::dumpDetail()` (`0xF2C2F0`), and
`gsys::Layer::postDrawImpl` calls `DynamicTextureAllocator::dump()` whenever the
Tất cả các nhà khoa học đã thay đổi kích cỡ.
**Không có khóa** trong khi các công việc khác cung cấp các khối cấp/không có, vì vậy đi bộ có thể
observe a transiently null `next` and the port faults at `0x8` (after present
#2048; 5 trong 8 lần hợp lệ hóa lần chạy đầu tiên.
`dumpDetail` now stops the walk at a null link instead of dereferencing it
(section 11, `tools/wsl/wsl-patch-dumpdetail-guard.py`); 4/4 120 s
Chạy chương trình sản xuất không có gì sau đó.
Sự mâu thuẫn vẫn chưa giải thích được — mô hình lưu trữ kích cỡ NVN bị cắt đứt
(`GetStorageSize`: block-rounded, and 0 when the format-table entry's bit 0 is
Rõ ràng) vẫn còn là nghi phạm — nhưng nó không còn giết chết quá trình này qua việc gỡ lỗi
Rác rưởi.

### 7. Compressed images are never attachments (host SIGFPE, `08912`)

Triệu chứng: chỉ vài giây sau khi chạy quá trình máy đã chết với SIGFPE — một
Phân chia số nguyên bởi zero in LVM's InstCombin trong khi llvmath biên dịch a
fragment shader's colour store — after validation had logged `08912` (a
Định dạng đính kèm chặn)

Cause: this driver's own format table (`subsdk0+0x181d70`, stride `0x34`) maps
NVN format `0x44` to **BC3**, and the game bound a *packaged BC3 cubemap* (the
probe) as a colour target — pass `k0:508d6f2128/137 … depth 0 fs
b5794a5c9c2e7e4b`. `508d6f2128` is pool base `508d5e9000 + 0x21128`, a
Mô tả các bản sao trò chơi ở đó; các cổng riêng của
`write_texture_descriptor` magic (`4E5654584C414544`) plus the texture address at
`+0x08` let `texture_descriptor_ref()`/`image_of()` follow it to the named
texture. The view the game asks for (`0x2f` = R32G32B32A32_UINT) is incompatible
và bỏ qua chính xác - định dạng hình ảnh * của hình ảnh là những gì đạt được.
Vẽ vào nó là không hợp lệ ở Vulkan, và trên llvmath các tạo ra DXT5
Các cửa hàng màu bị biến dạng (0 bit), mà InstComine gấp lại thành một bộ phân chia bởi
Không.

Fix: `compressed_image()` (new, in `nvn_image.cpp`) is consulted at the four
sites that build attachments — `begin_rendering` (colour and depth) and the
Định dạng màu và định dạng độ sâu của ống dẫn vẽ.
gets a dummy attachment (`attachment_dummy()` + `unused_slot_format()`) instead
của hình ảnh, chính xác giống như các khe không có ảnh.

`NX_FORCE_BC_DECODE=1` (host-decode BC into RGBA) also avoided the crash but is
không còn cần thiết nữa: người ta giữ lại hình ảnh thật của BC, vừa trung thành vừa 4×
nhỏ hơn.

### 8. Mỗi khung đen: danh sách lệnh được thả bởi các quy tắc chồng chéo nhau

Symptom: the display loop ran and `nvn draws: 115496 total, 115496 done, 0 no
program …` over 62 s, but every 1920×1080 dump (`NX_DUMP_FRAMES`) was uniformly
0 — Một điểm ảnh giá trị bị lệch 10 điểm — và ảnh ở giữa khung giữa
(`NX_SNAP_FOLLOW`) were black too, so the draws really stored nothing.

A/B: two 62 s runs with nothing different but `NX_KEEP_LISTS=1`.

|chạy|đổ khung|Các cuộc gọi điều khiển không rõ|
|---|---|---|
|không giữ| `00250`…`01250.ppm`: 1 non-zero pixel, max 10 | 31 |
| `NX_KEEP_LISTS=1` | `00250`: 79,442; `00500`: 111,004; `00750`: 111,655 (mid-frame snapshots 110k–235k) | 0 |

Nguyên nhân: Mô hình cổng bộ nhớ điều khiển với ước tính theo thứ tự theo thứ tự.
(`kCommandBytes`) and `used()` **clamps** at `size-64` instead of wrapping. Past
Bão hoà mỗi bản thu được cùng một khu vực bắt đầu, vì vậy các "một danh sách mới hơn
Ghi lại trên byte thả những cái cũ" chính xác là một cũ hơn
Danh sách mỗi lần ghi (24001 lần thả với 2.576 danh sách kết thúc trong 62 s).
Động cơ ghi lại danh sách trên khung của nó **once**và gửi các xử lý cho
Cả phiên họp, vì vậy mỗi giọt đó biến một tay cầm trực tiếp thành "không ai biết:
thả xuống: các bộ phận đệ trình không có gì và nội dung của khung bị mất.
counters show it — `handles: 4666 live, 12257 queued, 15814 dropped by overlap`
while the frame is black, and `calls served from kept (dropped) lists` once the
Danh sách được phục vụ một lần nữa.

Fix (`nvn/nvn_cmd.cpp`): a dropped list is kept in `g_kept_lists` and later
Các cuộc gọi và đệ trình được thực hiện từ bản sao ghi âm.
Bởi vì tay cầm của cổng là mã nhận dạng mờ của chính nó và một danh sách ghi âm là một
chụp lại chính xác các lệnh, vì vậy quay lại nó là những gì động cơ yêu cầu.
Bản đồ được bao bọc (400k mục nhập) và mạng an toàn điều khiển người điều khiển vẫn còn danh sách tuổi
out by use, so memory stays bounded. `NX_NO_KEEP_LISTS=1` restores the old rule.

Một sửa chữa hẹp hơn — bỏ qua thả chỉ khi khu vực mới bắt đầu lặp lại chính nó
( Hộp bão hoà) — gỡ bỏ 87 % các giọt nhưng để lại các khung đen và
faulted the guest (`gsys::SystemTask::postCalc_`, exit 70), so the conservative
Con đường phía trên là những gì những chiếc tàu cập bến.

### 9. Green boot verification (150 s, `run_green2.log`)

* exit 124 (timeout), `nvn: present #1024`, no `fault report`, no `SIGSEGV`/`SIGFPE`
* 0 `VUID` lines, 0 unknown-handle calls, 139 transient stalls (all recover)
* a 60 s repeat with `NX_VK_VALIDATION=1` (the layer is opt-in) is equally clean:
  exit 124, `present #512`, 0 validation errors, 0 faults, non-black dumps
* `per frame over 60: 11.2 fps, 1.0 submits, replay 6.08 ms, fence wait 79.74 ms, upload 6.54 MB`
  (Tiếng kèn xe; tiếng xe màu đen chạy nhanh hơn chỉ vì không có gì lưu trữ)
* dumps every 100 frames (`NX_DUMP_FRAMES=100`): `00100`/`00200` are fully covered
  (2,073,600 non-zero pixels, max 186/190), `00300` has 69,816, and `00400`…`01900`
  Giữ một ổn định 110.977–111.677 không bằng 0.

Các khung là UI riêng của Splatoon 2: dải mực xanh lục chéo với
Những bóng sứa (mành chắn) và trang đầu khởi động — mực vôi chảy với
the Inkling, a blue ink blob, six page dots with the first active, and the `R`
Nhắc nút. Các bản sao PPM (hơn PNG của ba khung) nằm trong
`~/sp2port/private/frames/`.

### 10. Máy GPU: máy Windows bản địa (2026-10-19)

Tất cả mọi thứ ở trên chạy thông qua dung nham đường ống bởi vì các vi phân tách WSL không có thực-GPU
Vulkan ICD: `/dev/dxg` is only the D3D12/paravirt device, this Ubuntu's
`mesa-vulkan-drivers` ships no `dzn` (Vulkan-on-D3D12) files, and NVIDIA's WSL
Vulkan ICD cũng chưa được cài đặt. Thời gian chạy đã mang một hậu phương Windows
(`runtime/src/platform_win.cpp`, `memguard_win.cpp`), so the port builds for the
chủ nhà và chạy với tài xế thật:

```bash
# one-time, in WSL, no sudo: the LLVM-MinGW Linux tarball targets Windows
curl -L -o llvm-mingw.tar.xz https://github.com/mstorsjo/llvm-mingw/releases/download/20261006/llvm-mingw-20261006-ucrt-ubuntu-22.04-x86_64.tar.xz
tar -xf llvm-mingw.tar.xz && mv llvm-mingw-20261006-ucrt-ubuntu-22.04-x86_64 ~/llvm-mingw
cd ~/sp2port && ./build-win.sh 8          # 603 units -> sp2.exe (138 MB, symbols kept)
```

then on Windows (staged by `tools/wsl/run-win.ps1`, which also makes the romfs
Kết nối và dừng tiến trình sau thời gian đã yêu cầu:

```
C:\Users\Hexa\Documents\nintendo\sp2win\   sp2.exe + private\{analysis,frames,fonts,spirv,user,extract\romfs->hactool romfs}
NX_HEADLESS=1 NX_DATA_ROOT=private NX_FENCE_TIMEOUT_MS=600000 NX_DUMP_FRAMES=100
```

Tính năng chuyển tiếp cần thiết (tất cả nhỏ):

* `tools/wsl/build-win.sh` — **new**: compiles the same `gen/**` + `runtime/src/**`
  units with `x86_64-w64-mingw32-clang++`, passing `-DVK_USE_PLATFORM_WIN32_KHR`
  (`vk_gen.cpp` gates the win32 surface path on it) and `-D_WIN32_WINNT=0x0A00`
  (`SetProcessDpiAwarenessContext`). The unit list comes from `obj-all/*` so it
  cannot drift from the Linux build; `platform_linux.cpp` is replaced by
  `platform_win.cpp`, `memguard_win.cpp` and the new `platform_win_crt.cpp`.
  Objects are cached in `obj-win/`, rebuilt when the source or the script is newer.
* `runtime/src/platform_win.cpp` — `commit()` now falls back to
  `MEM_RESERVE|MEM_COMMIT`, mirroring `platform_linux.cpp`'s `MAP_FIXED` behaviour:
  the loader commits module memory without a preceding reserve, and `MEM_COMMIT`
  alone then fails with `ERROR_INVALID_ADDRESS` (487). `reserve()`/`commit()` log
  the range and `GetLastError()` when they fail (they were silent).
* `runtime/src/platform_win_crt.cpp` — **new**: mingw's `<time.h>` defines
  `clock_gettime()` as an always-inline call to `clock_gettime64()`, which no CRT
  provides; the shim supplies `CLOCK_REALTIME`, `CLOCK_THREAD_CPUTIME_ID` and
  `CLOCK_MONOTONIC` on Win32 primitives.
* `runtime/src/frame_stats.cpp` — `thread_cpu_ns()` uses `GetThreadTimes()` on Windows.
* `runtime/src/hle_hid.cpp`, `runtime/src/nvn/nvn_shaders.cpp` — missing
  `<cstdlib>` (`std::getenv`/`std::strtoull` arrive transitively through glibc).
* `NX_DATA_ROOT=private` — Linux's `data_root()` defaults to `private`, Windows's
  to `kInfo.pc_data_root` (`private/sp2`); the variable makes both layouts the same.

Results (`sp2win/run.log`, 120 s, `NX_DUMP_FRAMES=100`; WSL-side readings for comparison):

* device: `GPU 0: AMD Radeon(TM) Graphics (integrated)`, `GPU 1: NVIDIA GeForce RTX
  3060 Laptop GPU (discrete, Vulkan 1.4, driver 9a100000)` — the port picks the
  NVIDIA automatically (`private/pipelines_10de_2520.bin` is its pipeline cache)
* 1600 frames (a present line every 16-32), **0 `VUID` lines, 0 faults, 0
  unknown-handle calls**; `per frame over 60: 34-60 fps, 1.0 submits, replay
  2.0-2.4 ms, fence wait 5.3 ms, present 0.2-14 ms, upload 6.54 MB` — i.e. the
  Trò chơi là 60 fps mũ thay vì dung nham ống kính 8-11 fps (79.74 ms hàng rào chờ đợi)
* frame dumps cost ~0.7-0.9 s each: with `NX_DUMP_FRAMES=100` there are stalls of
  760-935 ms at exactly frames 299/399/499/.../1599, with `NX_DUMP_FRAMES=0` the
  Cùng con chó canh rơi xuống 100-80m — con đọc ngược khối chỉ hiển thị
* Lòng trung thành: người lái xe thực sự rút ra **more** Hơn là dung nham ống dẫn. ở trang đầu
  Ống dung nham thắp sáng 110.977 px đen; NVIDIA thắp sáng tất cả 2.073.600 px (max 257) — các
  Chuyển đổi nền ánh sáng, bóng của sứa và bóng của chúng
  present (`frames/win_00400.png`, `win_01600.png`), i.e. the missing screen-filling
  nền là giới hạn ống dung nham, không phải lỗi khách
* chạy đầu tiên với bộ nhớ tạm **cold** bị trì hoãn sau khung 498 (của cổng riêng
  `hang: no frame for 5 s` watchdog) for longer than a 45 s window; later runs with
  Bộ nhớ tạm tại chỗ chỉ thấy các quầy chứa rác

Mở từ đây: với đổ ra, 1 5 s ở khung 1276 — sợi chỉ chính trong
`sead::WorkerMgr::sync()` on a light event while the actor-calc workers sit in
`sead::Worker::proc_`. Same family as the WSL transient stalls in section 9, but
Đủ lâu để đi thăm chó săn.

### 11. The `WorkerMgr::sync()` deadlock: the main thread never signals the job queue (2026-10-19)

Cái chuồng ở trên thực sự là một cái ổ khóa, không chỉ là một khung chậm, mà là một cái cột chính.
thread is in `sead::WorkerMgr::sync()+60` → `nn::os::TimedWaitLightEvent`, and
one actor-calc worker is in `sead::Worker::proc_()+0x190` → `sead::JobQueue::FINISH`
→ infinite `nn::os::WaitLightEvent`. `sync()` retries the *same* worker index
after every `mTimeout` (~10 ms), so it never recovers; the audio thread keeps
Nó được tái tạo trong khoảng 1 trong 4 lần chạy vòng 150 giây.

What the queue counts. The actor calculator pushes one `sead::FixedSizeJQ` to
Mỗi công nhân trong chiếc mặt nạ cốt lõi và sau đó tham gia bản thân:

```
ActorCalculator::calc
  clear(queue); enqueue jobs                  queue+0xc0 = total jobs
  pushJobQueue(mgr, name, queue, mask, 1, 0)  -> begin: queue+0x70 = 0, per-core flags
  WorkerMgr::run(mgr)                         runAll(queue) on the main thread
  WorkerMgr::sync(mgr)                        wait each worker's completion event
  rewind(queue)                               queue+0xc4 = 0 (read index)
```

`FixedSizeJQ::run(num, &count, worker)` claims
`min(granularity, [queue+0xc0] - [queue+0xc4])` jobs under the queue's spinlock,
advances `[queue+0xc4]`, runs them, and reports `done = (new read index >= c0)`.
`Worker::proc_` loops `run` until done, adds its count to `[queue+0x70]`
(LDXR/STXR), and **signals the queue event when `[queue+0x70] >= getNumJobs()`**
(the virtual call resolves to `ldr w0, [x0, #0xc0]`). It then calls `FINISH`,
whose early-out returns when `isDone_()` (`[queue+0x70] == getNumJobs()`) is
đã có sự thật, và nếu không thì đợi trong sự kiện hàng đợi (một cách dọn bằng tay)
`sead::Event`: state byte at `+0x29`, cleared `0xfe`, signalled `1`,
`SignalLightEvent` broadcasts).

The hole. `WorkerMgr::run()` is a participant too, but after
`q->runAll(&count)` it only does `[queue+0x70] += count` and then
`q->FINISH(core)` — it never performs the workers' `>= getNumJobs()` test, so
it never signals the queue event. When the main's `runAll` claims the **last**
jobs while a worker has already entered `FINISH` (the worker's own check failed
because the main's batch was still outstanding), the main's `FINISH` takes the
"đã làm xong" sớm và trở về mà không có tín hiệu.
sự kiện xếp hàng mãi mãi, không bao giờ ra dấu cho sự kiện hoàn thành nhân viên của mình, và
`sync()` then waits for that worker forever. The console can hit the same race,
but it needs the worker to reach `FINISH` in the narrow window before the main
finishes the final batch; the port's main thread runs `runAll` as a tight C++
Vòng với ba chủ thể cạnh tranh nhau, mở rộng cửa sổ đủ để
Bắn nó trong vòng vài phút.

Fix. A participant that finds the queue complete in `FINISH` must release the
Hàng rào là bồi bàn trước khi trở về.
`sead::JobQueue::FINISH` (`gen/main/code_317.cpp`, patch tool
`tools/wsl/wsl-patch-finish-signal.py`):

```c
if (((uint32_t(c.x[0]) >> 0) & 1) == 0) goto L_EA9A48; // tbz w0, #0
c.x[0] = uint64_t(c.x[19] + 0x28ull);
main_00E98E00(c); // sead::Event::setSignal
L_EA9A3C:;
```

Các sự kiện là thủ công thủ công, do đó, tín hiệu đánh thức tất cả các bồi bàn và là một không có tay khi
it is already signalled; the next batch's `Worker::proc_` clears it again with
`resetSignal`. The early-out is only taken when `isDone_()` is true, i.e. every
Công việc của mẻ đá đã được tính đến, nên không bồi bàn nào được thả sớm.

Sửa chữa đó là cần thiết nhưng không đủ: ba chạy lạnh với nó vẫn còn treo
Chiếc nhẫn CV đã đưa ra quyết định cuối cùng chính xác.
`508d115600`, values from `fix5_1.log`):

```
#356021 wait    t=50 ... mutex 508d11564c word 10000   main enters the CV wait holding the queue CS
#356022 sleep   t=50 ... word 0                        registered, CS released
#356023 sig     t=56 ... aux 1                         worker completes the batch, signals the event
#356024 queue   t=50 ... word 40010013                 main moved to the mutex queue
#356026 arbU    t=56 ... word 40010013 -> 0            signaler leaves; no waiter was handed the lock
#356035 woke    t=50 ... word 0                        main wakes with the CS word 0 -- no ownership
#356036 sig     t=55 ... aux 0                         the last signal: no registered waiter
#356038 wait    t=50 ... word 0                        main re-registers without the CS
#356039 sleep   t=50 ... word 1                        sleeps forever; the event state byte says 1
```

### Cái lỗ thứ hai: cái thẻ cánh tay là 0

`svcWaitProcessWideKeyAtomic` receives the waiter's mutex tag in `w2`, and the
Hạt nhân phải viết lại cái thẻ đó vào chữ im lặng để mở khóa.
SDK loads it at `GetCurrentThread()+0x1B8`. But the sdk module's GOT slot for
`GetCurrentThread` is a **relocation**, and `runtime/src/loader.cpp` binds every
chức năng di chuyển đến một HLE * trước khi * nó nhìn vào xuất khẩu module: cuộc gọi
Giải quyết ngữ cảnh đọc/ đọc tổng hợp của cổng
(`hle_os.cpp: get_current_thread`), whose +0x1B8 is 0 -- not the sdk's own
`GetCurrentThread` at `sdk+0x81870`, which returns `[TP+0x1F8]`. Meanwhile
`InternalCriticalSection::Enter` reads its tag from `[[TP+0x1F8]+0x1B8]` (the
guest `ThreadType`), which is the thread handle (0x10000, 0x10012, ...). So the
guest passed tag=0 and both handoff paths stored it: `unlock_mutex` writes
`next->wait_tag` into the mutex word, and the signal's direct `hand` branch
CASes in `wait_tag`.

Do đó bồi bàn tỉnh dậy trở lại, mà không cần đến phần quan trọng.
`WaitLightEvent` re-check then ran unserialized against `ClearLightEvent`: a
worker could `resetSignal` (state 0xfe) after the signal, the waiter would
Đọc lại 0xfe và đăng ký lại, và tín hiệu của một công nhân thứ hai có thể bắn vào khoảng trống
- bang 1, CV từ 1, 1 người ngủ, không có tín hiệu chờ.

Sửa: tiếng câm từ người gọi giữ đã chứa các thẻ phải được
restored, so derive it from there (`runtime/src/kernel.cpp`,
`svc_wait_process_wide_key`; patch tool `tools/wsl/wsl-patch-cv-tag.py`):

```c
const uint32_t owner_tag = load32(mutex) & ~kHandleWaitMask;
self->wait_tag = owner_tag ? owner_tag : tag;
```

Bây giờ bồi bàn tiếp tục giữ phần quan trọng, do đó, kiểm tra lại của nó là
Hàng loạt với tín hiệu/ thiết bị báo động và cửa sổ bị mất tín hiệu.

Instrumentation that localized it (kept in the port): `NX_CV_HIST=1` records a
Một trong những điều kiện tối ưu vòng có thể thay đổi (chờ đợi/ giấc ngủ/ ký hiệu/ hài lòng/tay/ Tỉnh thức/abitrate
sự kiện với mã nhận diện chỉ khách và cả hai từ) và báo cáo treo cổ in
Mới nhất* 32 sự kiện cho mỗi phím bị mắc kẹt, một danh sách câm/CV bồi bàn, và một danh sách toàn cầu
event tail. A `LightEvent` wait is mapped back to its `sead::FixedSizeJQ`
(`queue = key - 0x50`) with `state`, `event state`, `done / jobs`, `read` and
`cap`.

Validation (2026-10-19, cold cache, `NX_CV_HIST=1`, `NX_DUMP_FRAMES=100`,
150 s): eight runs with the tag fix — `fix8_1`, `fix9_1..3`, `fix10_1`,
`fix11_1`, `fix12_1` and `prod1_1` — produced **zero hangs**: no
`hang: no frame` report and no `WorkerMgr::sync` stuck stack. Three completed
the full 150 s (`fix8_1`: present #4096, 67 stalls; `fix9_2`: #4096 at frame
6000, 66 stalls; `fix10_1`: #4096, 63 stalls, then the 8.0 GB memory guard
Dừng lại tại 5652 khung. Tất cả chạy: 0 VUIDs, 0 lỗi báo cáo.
Không đen: khung 100 là khung đen khởi động; khung 400–2600 là 100% sáng,
có nghĩa là RGB 6–201, 26–92 màu xô.

Thất bại còn lại là một vụ tai nạn, không phải mất tỉnh táo.
(`fix9_1`, `fix9_3`, `fix11_1`, `fix12_1`, `prod1_1`) died at the same host
instruction, `sp2.exe+0x4200830` (guest `0xF2C2F0`,
`agl::utl::TextureMemoryAllocator::dumpDetail`), data address 8, after frames
2200–4900. The host registers at the fault (`rax=this`, `r11=0x68`,
`r8=-0x68`) show the list walk had loaded `next = 0` and then dereferenced
`next + 8`. The call chain is `LayerJob::invoke` → `calcLayerDL_` →
`gsys::Layer::postDrawImpl` → `DynamicTextureAllocator::dump()` →
`dump_(frameIndex)` → `dumpDetail()`. `postDrawImpl` only calls `dump()` when
`getUseSize()` changed, i.e. exactly while other render jobs can be
Di chuyển các khối từ cùng một danh sách; đi bộ không có khóa, và
port's slower timing opens the race. `dumpDetail()` is read-only (no stores, no
cuộc gọi), vì vậy một liên kết vô giá được xem như là kết thúc của danh sách thay vì được
dereferenced (`gen/main/code_328.cpp`, patch tool
`tools/wsl/wsl-patch-dumpdetail-guard.py`). This is a debug-dump hardening; the
Cuộc đua thân chủ của khách không bị ảnh hưởng.

Validation of the guard: four 120 s production-config runs (no `NX_CV_HIST`,
không có đổ khung, bộ nhớ tạm ấm) — **4/4 mà không có lỗi hay bị treo**, tất cả đều với tới
hiện tại # 4096; ba vẫn còn sống ở 120 s (GB 7.1 GB), một cái đã bị chặn lại bởi
Giới hạn 8.0 GB trước khi bảo vệ, 5 trên 8 điểm chạy ở hướng dẫn này.

### Mở mục

* Ước tính sử dụng vẫn còn bão hòa; phần 8 bù đắp sau sự kiện.
  faithful `AddCommandMemory`/`GetCommandMemoryUsed` model (or the driver's real
  Kích thước trên một lệnh sẽ làm cho các quy tắc chồng chéo tin cậy một lần nữa.
* `g_kept_lists` only evicts by cap; evict by use instead. Host commit grows
  3. 5 GB/min (7.1 GB ở 120 s), vì vậy 8.0 GB bảo vệ dừng hoạt động sau ~110 s
  (`fix10_1`: 5652 frames). This is now the next long-run blocker.
* Các 11 fps đến từ hàng rào dung nham chờ đợi (79.74 ms/ set), không phải là cổng:
  Quay lại là 6.08m.
* Những cái chuồng này khóa chặt cuộc tranh cãi, chứ không phải một sự mất trí.
  `NX_TRACE_ADDR=5005ecd508` saw 1556 waits and 1552 matched signals, and the
  chờ đợi thực hiện ~1 s thời hạn; các công viên mạch chính trong
  `sead::DisplayBufferNvn::presentTextureAndAcquireNext`.
* An intermittent host SIGSEGV (fault address `0xbf800000`, port code, guest LR
  `present_+0x50`) was seen once in a 200 s `NX_FORCE_BC_DECODE=1` run and has
  Không tái sinh kể từ đó.
* Ở nhà ga GPU (phần 10) cùng một chuồng đã đến chỗ con chó bị treo cổ:
  với đổ ra, một trong 5 s s ngăn chặn tại khung 1276 với sợi chính trong
  `sead::WorkerMgr::sync()` and the actor-calc workers parked in
  `sead::Worker::proc_`. Root-caused and fixed in section 11 (the main-thread
  Những người tham gia không bao giờ báo hiệu sự kiện hoàn thành của hàng đợi công việc.

### Changed files (WSL `~/sp2port`)

* `runtime/src/hle_os.cpp` — arena `0xC0000000` → `0xC7000000` in `QueryMemoryInfo`.
* `runtime/src/hle_fs.cpp` — `CommitSaveData`, `SetResultHandledByApplication`, `SetLocalApplicationAccessLog` HLEs.
* `runtime/src/hle_friends.cpp` — **new**: offline presence API.
* `runtime/src/nvn/nvn_vk.cpp` — headless init without a surface; graphics-only queue.
* `runtime/src/nvn/nvn_texture_layout.cpp` — total storage size rounded to 512 instead of a whole block
  (the driver aligns per level and does not round the total; the exact `0x71800b45c4` transcription is
  Một cuộc chạy 120 mét với cái này giữ cho vòng trình diễn sống sót qua hiện tại #2048 mà không gây tử vong.
* `runtime/src/nvn/nvn_image.cpp`, `nvn_draw.cpp`, `nvn_vk.h` — `compressed_image()`: a compressed colour or
  khe sâu được xử lý không có ảnh (phần 7).
* `runtime/src/nvn/nvn_cmd.cpp` — a dropped command list is kept and later submits/calls are served from it
  (section 8); `NX_NO_KEEP_LISTS=1` restores the old rule.

Máy (cửa sổ) xây dựng, phần 10:

* `tools/wsl/build-win.sh` — **new**: LLVM-MinGW cross build, unit list from `obj-all/*`, `obj-win/` cache.
* `tools/wsl/run-win.ps1` — **new**: stages `sp2win/`, makes the romfs junction, timed headless run.
* `runtime/src/platform_win_crt.cpp` — **new**: `clock_gettime64` on Win32 primitives.
* `runtime/src/platform_win.cpp` — `commit()` falls back to `MEM_RESERVE|MEM_COMMIT`; reserve/commit report
  `GetLastError()`; `WINVER`/`_WIN32_WINNT` come from the build flags.
* `runtime/src/frame_stats.cpp` — `GetThreadTimes()` for per-thread CPU time on Windows.
* `runtime/src/hle_hid.cpp`, `runtime/src/nvn/nvn_shaders.cpp` — explicit `<cstdlib>`.

Gióp bị khóa lề (phần 11):

* `gen/main/code_317.cpp` — `sead::JobQueue::FINISH` signals the queue's completion event on the
  already-done early-out. Applied by `tools/wsl/wsl-patch-finish-signal.py` (idempotent, `--check`).
* `tools/wsl/wsl-patch-finish-signal.py` — **new**: patch tool for the line above.
* `runtime/src/kernel.cpp` — CV wait derives the handoff tag from the caller-held
  mutex word (`owner_tag = load32(mutex) & ~kHandleWaitMask`), `wake()` reason
  diagnostics, `NX_CV_HIST=1` ring of 1M events plus `dump_cv_history`/`dump_cv_tail`/
  `dump_waiters`.
* `runtime/src/kernel_watch.cpp` — the hang report prints the stuck keys' CV histories (up to 8) and
  decodes a `LightEvent` wait back to its `sead::FixedSizeJQ` (`queue = key - 0x50`) to print
  `state`, `event state`, `done / jobs`, `read`, `cap`.
* `tools/wsl/wsl-patch-cv-tag.py` — **new**: patch tool for the handoff tag fix.

Đáy gỡ lỗi hoạ tiết (phần 6):

* `gen/main/code_328.cpp` — `TextureMemoryAllocator::dumpDetail()` stops a read-only
  list walk at a null link instead of dereferencing `null + 8` (the debug dump races
  with block allocation/free). Applied by `tools/wsl/wsl-patch-dumpdetail-guard.py`
  (idempotent, `--check`).
* `tools/wsl/wsl-patch-dumpdetail-guard.py` — **new**: patch tool for `dumpDetail`.

## Văn bản và ký tự trên màn hình (2026- 10- 20)

Các cổng bây giờ khởi động thông qua dòng chảy đầu tiên chạy: người chơi Make (cả sáu bước),
Màn hình tiêu đề và hướng dẫn, tất cả được vẽ bởi mã trò chơi đã biên dịch. 2 được vẽ
Các khuyết tật vẫn còn, và chúng là những con bọ gây hại, chứ không phải bọ nghịch ngợm.

### Văn bản UI đã được thiết lập nhưng chưa bao giờ vẽ

The screen is supposed to show text (`Message/LayoutMsg_JPja.szs` is loaded and its
`00.msbt` carries `どっちか 選ぶんだ！`, `つぎは …`, `さいごに …`, `この設定でオッケー？`,
`ガール`, `ボーイ`, `ちょっとまって`, `オッケー！`, `回転`). A hook on
`nn::ui2d::TextBox::SetString` (0x137b320) shows every one of those strings arriving
verbatim, and `nn::font::CharWriter::PrintGlyph` is called per glyph. All draws execute
(`0 no program, 0 no pipeline`).

Thứ còn thiếu là sự hoang mang của bức chạm khắc:

* `nn::font::TextureCache` creates a 2048×2048 R8 colour target (NVNtexture
  `0x5007300f50`); `RegisterGlyph`, `FindGlyphNode`, `SetFontFace` and
  `CompleteTextureCache` run, `SetFontFaceNoPlot` runs ~91,800 times (measurement), but
* **Không bao giờ vẽ các mục tiêu mà hoạ tiết**, và đọc ngược tại khung 200/300/400/600
  100% 0 của 4.194.304 byte không bằng 0.
* Trong khi cổng đầu tiên của *upload* của cùng một kết cấu lấy mẫu của 5.527 của 65,536 byte
  Khác zero — cùng 5.527 byte vẫn còn ở mỗi khung, i. bên CPU
  Bộ nhớ tạm chạm khắc cũng không bao giờ nhận được điểm ảnh nào.

Nguyên nhân là sợi dây **rasteriser**:

```
eui::ScalableFontMgr::update              called continuously (~1,200+ times)
eui::ScalableFontMgr::UpdateTextureCacheThread::calc_   called exactly 3 times, then never again
  -> nn::font::TextureCache::UpdateTextureCache          (the only caller of it)
```

`eui::ScalableFontMgr` keeps a dedicated `UpdateTextureCacheThread` that wakes up and
Rasterise mới đăng ký chạm khắc vào atlas. Tại cảng, nó đánh dấu ba lần tại
Khởi động (trước khi bất kỳ bức chạm khắc thực sự được đăng ký) và sau đó vẫn ngủ mãi mãi, vì vậy
atlas giữ trống không và mỗi mẫu bốn chạm khắc 0s. Đây là một đường dẫn thức tỉnh/ bánh mì
issue, not a font-data issue: the fonts themselves decode correctly (`OTTO` and
TrueType data arrive at `FSS_load_font`, `FSS_set_cmap` gets non-null faces). Its
message queue (`thread+0x38`) sees zero pushes and zero pops for the whole run, and
`ScalableFontMgr::update` never requests an update.

Hai thí nghiệm trên con đường để sửa chữa, cả hai trở lại:

* clearing the manager's "request pending" flag (`thread+0x108`) so its per-frame
  `CompleteTextureCache` call runs — no effect on the atlas;
* calling `TextureCache::UpdateTextureCache` from `ScalableFontMgr::update` with the
  thread's own cache pointer (`[[this+0x40]+0x100]`, exactly what `calc_` uses) — runs
  (6+ cuộc gọi) mà không sập, nhưng vẫn không viết gì vào bản atlas.

So the failing step is inside `UpdateTextureCache` itself: it sets up `nn::gfx`
Tài nguyên và sau đó các hình chạm trổ không bao giờ đạt được các kết cấu (không vẽ
Mục tiêu là nó, và bộ nhớ tạm không thay đổi.

Một thử nghiệm quyết định: với atlas buộc phải mờ nhạt trắng khi tải lên
(`NX_FONT_WHITE=1`), the text quads become visible — proving the draw pipeline and the
Bản mẫu là trực tiếp và chỉ có nội dung atlas bị mất (các tiến bộ là tốt:
15–32 px trên mỗi nhân vật.)

**Fixed — the atlas upload.** The glyph atlas is an R8 texture carrying the `02010101`
brazzle ("alpha từ đỏ"), mà cổng mở rộng tới RGBA8. Mà mở rộng chỉ chạy cho
*pitch-linear* textures; the atlas is **tiled** (`stride 0`), so the untiled 1-byte
Texels đã được sao chép thẳng vào một hình ảnh 4- byte và dữ liệu chạm khắc không bao giờ đổ bộ vào
GPU. `runtime/src/nvn/nvn_upload.cpp` now widens tiled alpha-from-red data as well (the
`ALPHA_R_TILED` block scales the level offsets with it). Result: the atlas is delivered
và ** văn bản trình bày trên màn hình** — trắng, và vẫn còn mặc quần áo bởi vì nội dung atlas là
Thật cũ kỹ.

**Remaining — the glyph rasteriser never runs.** `FSS_map_char` (character→glyph) and
`FSS_get_advance` run continuously, but `FSS_get_outline` is **never called**, so no
glyph outline is ever requested and `TextureCache` never fills the atlas.
`UpdateTextureCache` runs and its work list is non-empty (the walk hits the 64-node cap),
but it only maps the font memory pool and sets up `nn::gfx` resources. No draw and no
Sao chép các mục tiêu atlas.

Measured after the fix: `nn::fontll::ScalableFontEngine::AcquireGlyphmap` **is** called
(~every 300 glyph operations), but its only caller is `TextureCache::CalculateCharWidth`
(through the wrapper at `main+0x1414f18`), i.e. it is used for **measurement**, not for
dữ liệu chạm khắc của nó không bao giờ được viết ở bất cứ đâu.
pool base (`off=0`, `mem == pool->memory`, 4 MB) and its content never changes (constant
5.527/65,536 khác zero byte.
văn bản vẽ mẫu.

Vụ tai nạn đã được biết trong cùng khu vực (được chuyển tiếp theo:

```
Game::TutorialGuideMsgPage::stateIn
  Cui::TextSetter::updateText
    eui::TextBoxEx::adjustText_
      nn::font::TextWriterBase::CalculateStringWidth
        nn::font::TextureCache::CalculateCharWidth
          nn::font::TextureCache::GetInnerFontFace
            nn::font::TextureCache::SetFontFaceNoPlot
              FSS_set_cmap            <- null face, data address 0x20
```

Vì vậy, một khuôn mặt phông thứ hai (một kích cỡ hay tập con không tải được) đến máy co dãn với một
Mặt vô tích sự.

### Mô hình mực được gửi đi nhưng vô hình

Người đàn ông lột da được cung cấp mỗi khung vào mục tiêu nhìn thấy
(`vs 56749b4df6df0e85 fs cc0af353291e5c0e`, 6,384 indices, 45 bones, real model
textures), and `NX_SNAP_FS` snapshots taken right after those draws show the **mask
thông qua** kích hoạt giày tại hai vị trí đang đứng. Màu sắc nhìn thấy được vượt qua
không để lại điểm ảnh, trong khi cái bóng đốm dự kiến vẫn hạ cánh ở vị trí của các mô hình.
Mở: giấy thông hành có thể nhìn thấy hoặc camera hoặc trạng thái vật chất của nó.

### Diagnostics used (all temporary, idempotent `--restore`)

|Probe|Mục tiêu|
|---|---|
| `TXTDBG3` | `nn::ui2d::TextBox::SetString` strings |
| `TXTCALC` / `GLYPHDBG` | `TextBox::Calculate` and `CharWriter::PrintGlyph` |
| `FCACHE` | `TextureCache::UpdateTextureCache` / `RegisterGlyph(s)` / `SetFontFace*` |
| `FONTDBG` | `ScalableFont::Initialize`, `FSS_load_font` (data magic), `FSS_set_cmap` |
| `TEXDBG` |kết cấu tạo, 1–2 đòi hỏi đích theo thứ tự ưu tiên|
| `TEXTDBG` |vẽ với bộ đệm lưu trữ đồ họa|

