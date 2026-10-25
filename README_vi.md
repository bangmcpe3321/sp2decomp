# sp2decomp

[English](README.md) · **Tiếng Việt**

Ghi chú nghiên cứu dịch ngược và công cụ cho tệp thực thi `main` trên Nintendo
Switch của **Splatoon 2** (bản USA), có ExeFS nằm trong bản dump
`Splatoon 2 USA.xci`, cùng với bản port PC được biên dịch lại từ tệp thực thi
đó.

Đây là nhật ký nghiên cứu, không phải bản decompile hoàn chỉnh. Kho này ghi lại
những gì đã xác lập được về cấu trúc, kiến trúc và các subsystem của module, các
script dùng để xác lập chúng, cũng như tiến độ hiện tại của bản port.

## Tình trạng hiện tại

Bản port được biên dịch lại chạy code của chính trò chơi trên Vulkan trên
Windows. Màn hình tiêu đề render ở 1920×1080. Tạo nhân vật PlayerMake hoàn tất
với chữ đọc được, cutscene mở đầu phát được, và tutorial tay cầm trong lần chạy
đầu tiên hoạt động: trang tay cầm render đầy đủ (hình Pro Controller, ảnh
Joy-Con, các hình banner và lời nhắc nút), các câu hướng dẫn hiển thị đúng, đồng
thời các bước ngắm và ZR đều vượt qua. Tutorial sau đó đến trang Move: sơ đồ
tay cầm, banner “Move with L!” và lời nhắc bàn tay render được, căn phòng 3D
phía sau cũng đã render — viewport trung tâm 960×540, khoảng 98% số pixel không
đen và luma đo được là 85. Log `SCENECHG` tạm thời trong `main_00620ED0` làm
hiện rõ chuỗi trạng thái tutorial và UI/trang. Ngắm bằng chuyển động đọc trạng
thái sáu trục được quét (`NX_SIXAXIS_WOBBLE=1`), còn một chuỗi input được lập
trình sẽ tiến qua các bước.

Trình quản lý tutorial 9 trạng thái yêu cầu `5 → 6` sau warp đầu tiên; một patch
idempotent chuyển yêu cầu đó sang warp state 7. Yêu cầu `4 → 5` của trình quản
lý UI/trang 21 trạng thái không phải ngõ cụt null-state. Entry state 5 vẫn null
trong bảng cũ, nhưng handler đổi scene ảo của trang tạo một page manager mới và
load scene tin tức Off the Hook của màn hình tiêu đề. Một lần capture trực tiếp
của chuyển tiếp `4 → 5` thực tế được ghi lại bên dưới: viewport TV trung tâm
960×540 hiển thị studio tin tức và hai host Pearl, Marina. Chuyển hướng `4 → 7`
trước đây là một đường vòng chẩn đoán bỏ qua tin tức: nó đến màn hình chọn gear
PlayerMake (`7 → 1 → 2 → 9`), nơi entry state 9 là null và bị dừng. Plaza là
scene kế tiếp sau tin tức; hiện đang kiểm tra input chuyển tiếp/bỏ qua tin tức
(lần chạy đầu, chỉ nhấn A không chuyển tiếp). Khoảng một phần ba số lần boot bị
dừng trong UI job manager ở chuyển tiếp nhân vật → tutorial (xem mục Việc còn
mở).

![Màn hình tiêu đề ở 1920×1080](docs/images/title-1920x1080.png)

*Màn hình tiêu đề được render ở toàn bộ kích thước đầu ra 1920×1080. Tiêu đề xuất
hiện khoảng frame 6750 trong bản build này; đường chạy tiếp tục giữ tổ hợp
`ZL+ZR` sau thời điểm đó.*

![Scene tin tức Off the Hook qua chuyển tiếp thực tế 4 → 5](docs/images/news-4to5.png)

*Chuyển tiếp UI/trang thực tế `4 → 5` load scene tin tức Off the Hook của màn
hình tiêu đề. Viewport trung tâm 960×540 hiển thị studio tin tức với Pearl và
Marina; bảng 21 trạng thái cũ vẫn báo entry state 5 là null vì chuyển tiếp tạo
page manager mới. UI xung quanh vẫn bị sai tỉ lệ (vấn đề bố cục UI riêng), nhưng
scene tin tức tự render được. Đường vòng `4 → 7` bỏ qua scene này và đến màn hình
chọn gear.*

![Bước ngắm của tutorial, đã vượt qua](docs/images/tutorial-aim-legible.png)

*Bước ngắm. Các dải hướng dẫn hiển thị “Aim at the [balloon] balloon!” và
“Target the [balloon] balloon with the [reticle] reticle!”; `Just like that!` là
câu trả lời của game khi trạng thái sáu trục được quét đưa reticle vào balloon.
Các dải này được `TutorialGuideMsgPage` vẽ bằng glyph atlas BlitzBold kích thước
100 do CPU ghi; bản port hiện upload lại atlas khi các byte của nó thay đổi.*

![Tutorial tay cầm lần đầu, “Shoot with ZR”](docs/images/tutorial-zr-step.png)

*Bước kế tiếp: “Shoot with [ZR]!” với “Tilt the controller to aim!” bên dưới;
ZR của Joy-Con sáng màu cam và badge lời nhắc hiển thị ZR.*

![Bước Move của tutorial](docs/images/tutorial-move-step.png)

*Trang Move. Sơ đồ Pro Controller làm nổi bật cần analog trái, banner “Move with
L!” và lời nhắc bàn tay được vẽ; căn phòng phía sau nay render trong viewport
trung tâm 960×540 (~98% không đen, luma 85) thay vì màu đen. Đây là bước theo
thời gian: `main_00A00BDC` chuyển trình quản lý tutorial từ trang 6 sang trang 8
khi bộ đếm toàn cục `[+0x44c]` đạt `0x12c0`, khoảng 3.100 frame sau khi trang
bắt đầu. Một lần bỏ qua cưỡng bức trước đây đi qua nhánh actor-flag
`main_00A00300` tại `L_A00350`, gọi `main_00620ED0(this, 7)` — đường thoát về
tiêu đề; log `SCENECHG` cho thấy `6 -> 7` và tiêu đề xuất hiện lại. Việc bỏ qua
hiện đã bị tắt ([tools/patches/patch-move-skip-disable.py](tools/patches/patch-move-skip-disable.py)),
để chuyển tiếp theo timeline chạy.*

![Màn hình chọn gear PlayerMake qua chuyển hướng UI](docs/images/ui-gear-state9.png)

*Frame bằng chứng state 9 từ lần chạy đầy đủ đầu tiên: màn hình chọn gear
PlayerMake (bốn thẻ gear trên máy Switch), đạt được qua `4 -> 7 -> 1 -> 2 -> 9`.
Đây không phải plaza. Entry state 9 là null nên UI dừng tại đây; hình ảnh xác
nhận chuyển hướng state bắn bị thiếu sang state 7 chỉ là đường vòng vào UI
PlayerMake, không phải bàn giao sang plaza.*

![Tạo nhân vật PlayerMake, bước chọn màu mắt](docs/images/boot-playermake-en.png)

*PlayerMake, bước chọn màu mắt (“Pick an eye color!”). Chữ đọc được vì bản port
lưu glyph atlas R8 do CPU ghi thành các hàng packed thay vì untiling. Hai model
Inkling vẫn chưa xuất hiện trong pass màu.*

![Xác nhận nhân vật](docs/images/boot-confirm-text.png)

*Trang xác nhận, chụp trước khi sửa ngôn ngữ (`この設定でオッケー？`); gợi ý nhỏ
ở góc dưới bên trái vẫn bị lỗi — đó là một atlas thứ hai, nhỏ hơn.*

Sáu bản sửa đã đưa bản port từ lỗi fatal khi boot đến trạng thái này:

- **Bỏ sót tail call.** `Cui::Page::findPartsControl` (`0x20BD74`) kết thúc bằng
  `b 0x20CF60`, một tail call vào `Control::List::searchAs<PartsCtrl>`. Recompiler
  phát ra hai lệnh trước đó nhưng không phát ra call, khiến hàm trả về
  `page->controls + 0x38` — một con trỏ list — cho các caller cần `PartsCtrl*`;
  `Cui::CustomizePartsSet::onInitialize` sau đó gọi `(*ctrl)[0]` qua con trỏ này
  và chết với `call to 50c12201b8` (heap) khi boot. Quét mọi hàm được sinh trong
  mọi module để tìm `b` cuối cùng đến một hàm khác mà không có call cho thấy đây
  là trường hợp duy nhất trong toàn bộ game. Patch:
  [tools/patches/patch-tailcall-20bd74.py](tools/patches/patch-tailcall-20bd74.py).
- **Glyph atlas được CPU ghi.** Atlas R8 2048×2048 được tạo với `stride 0`
  (builder xem nó là tiled), swizzle (R,1,1,1) và `alpha_from_r`, nhưng game
  điền dữ liệu bằng CPU, nên guest memory của nó là các hàng packed có độ rộng
  `width`. Untile nó tạo ra nhiễu dạng vệt; xử lý `stride 0` như
  `row_stride = width` và mở rộng R8 → RGBA8 `(255,255,255,R)` làm nhãn đọc
  được. Patch:
  [tools/patches/patch-alpha-atlas.py](tools/patches/patch-alpha-atlas.py).
- **Glyph atlas chỉ được upload một lần.** Atlas BlitzBold size-100 cũng được
  CPU ghi qua mapped memory, nhưng font engine không báo vùng đó cho
  `nvnMemoryPoolFlushMappedRange` (các lần flush 32 KB+ mà bản port thấy thuộc
  pool khác), nên hình ảnh giữ lại ký tự của face hoặc size đầu tiên chiếm các
  ô đó — glyph sạch nhưng sai chữ. Bản port hash một byte mẫu trong 61 ảnh
  R8-đọc-như-alpha được lấy mẫu mỗi frame và upload lại toàn bộ ảnh khi hash
  thay đổi; câu hướng dẫn của tutorial hiện đọc đúng, còn chi phí upload chỉ
  phát sinh ở các frame font engine rasterise glyph
  (`NX_ATLAS_REFRESH=0` để tắt). Patch:
  [tools/patches/patch-atlas-refresh.py](tools/patches/patch-atlas-refresh.py).
- **Ngôn ngữ bị đảo byte.** `nn::settings::LanguageCode` là `char[8]`, nhưng bản
  port ghi từng tag như một số nguyên với ký tự đầu ở byte cao, khiến `"en-US"`
  nằm trong memory thành `"SU-ne"`. Game không khớp ngôn ngữ nào và fallback
  sang tiếng Nhật (`/Message/CommonMsg_JPja.szs`), dù
  `nn::oe::GetDesiredLanguage` đã trả về `en-US` (nhánh đó dùng `memcpy` tag).
  Code hiện được suy ra từ string literal lúc compile và game load
  `/Message/CommonMsg_USen.szs`. Patch:
  [tools/patches/patch-language-code.py](tools/patches/patch-language-code.py).
- **Font face null khi chuyển intro → tiêu đề.** `nn::font::FSS_set_scale` kiểm
  tra face pointer, gọi `get_scale_inputs` (có thể release và dựng lại face),
  sau đó nạp lại pointer và đọc `[face+0x20]` mà không kiểm tra lần nữa. Khi face
  null ở thời điểm đó, game chết tại địa chỉ dữ liệu `0x20`. Patch tôn trọng
  lỗi face-null của FSS (`0x131`), để caller fallback về glyph chưa scale thay vì
  crash. Patch:
  [tools/patches/patch-fss-null-face.py](tools/patches/patch-fss-null-face.py).
- **Clear toàn target xoá các panel UI.** NVN giới hạn clear theo scissor đang
  bind. Bản port bỏ qua scissor (sau `NX_CLEARS_SCISSOR=1`) và clear toàn bộ
  attachment, nên clear dành cho một panel UI xoá cả phần còn lại. Trong tutorial
  lần đầu, việc này xoá sơ đồ Pro Controller và các phần layout khác, chỉ còn
  ảnh, banner và mũi tên. Tôn trọng scissor mặc định khôi phục toàn bộ trang.
  `NX_CLEARS_SCISSOR=0` khôi phục hành vi cũ để bisect (bản port từng gặp lỗi
  course break với scissored clear, `docs/nvn/DEBUG.md #52`). Patch:
  [tools/patches/patch-clears-scissor-default.py](tools/patches/patch-clears-scissor-default.py).

### Memory, input và tutorial

- **HLE cảm biến sáu trục.** `GetSixAxisSensorHandles` trước đây để nguyên output
  và trả về 0 trong khi API trả về số handle đã ghi. `sead::NinJoyNpadDevice::calc`
  lưu giá trị đó làm số cảm biến, nên game kết luận tay cầm không có cảm biến và
  không bao giờ gọi `StartSixAxisSensor` hay `GetSixAxisSensorStates`. Khi trả
  đúng số lượng, game khởi động sensor 0 và đọc 16 state mỗi frame; HLE báo mức
  held của tay cầm (hướng identity, trọng lực trên -Z, delta 1/60 giây).
  `NX_SIXAXIS_WOBBLE=1`
  ([patch-sixaxis-wobble.py](tools/patches/patch-sixaxis-wobble.py)) thêm quét
  pitch/yaw chậm cho bước “Tilt the controller to aim!” của tutorial. Patch:
  [tools/patches/patch-sixaxis.py](tools/patches/patch-sixaxis.py).
- **R11G11B10F được lưu native.** Format NVN `0x3f` trước đây luôn được mở rộng
  thành RGBA16F ngoài Android, làm tăng gấp đôi mọi HDR load/store/sample (636 MB
  trên tổng 1020 MB ảnh đang sống ở màn hình tiêu đề trên GPU laptop 6 GB, và
  hết memory thiết bị ở tutorial). Bản port hiện dùng `B10G11R11_UFLOAT_PACK32`
  khi thiết bị có thể render, blend, filter và copy format này, giảm một nửa các
  ảnh đó (`NX_R11G11B10_EMULATE=1` khôi phục hành vi cũ). Tại tutorial, live set
  giảm từ 5,6 GB xuống 1,2–1,7 GB và không còn allocation thất bại. Patch:
  [tools/patches/patch-r11-native.py](tools/patches/patch-r11-native.py).
- **Theo dõi image.** Histogram `VkDeviceMemory` trực tiếp theo format NVN được
  log cùng báo cáo 60 frame; đó là cách xác định kích thước các nhóm
  R11G11B10F và D32F. Patch:
  [tools/patches/patch-imgstats.py](tools/patches/patch-imgstats.py).
- **Pipeline.** Pipeline cache bị giới hạn (`NX_PIPE_CAP`, mặc định 2048) với
  destruction trì hoãn; UI tutorial đạt khoảng 2100 pipeline đang sống, nên
  giới hạn này chỉ là giải pháp tạm thời chứ chưa phải sửa tận gốc, và memory
  pipeline chiếm phần lớn ngân sách 6 GB.

### Việc còn mở

- **UI job bị dừng ở chuyển tiếp nhân vật → tutorial.** Khoảng một phần ba số
  lần boot, game dừng tiến ở frame ~2933–2942 và không có hoạt động render
  thread: main thread chờ light event trong `Lp::UI::Impl::JobMgr::endRun`, còn
  UI job worker vẫn ở trong `nn::font::TextureCache::CalculateKerning` →
  `FSS_set_scale`, khiến job không hoàn tất. Chạy lại cùng script thường sẽ qua.
  Stack nằm trong đường code font có atlas được xử lý bởi bản sửa atlas-refresh
  ở trên, nên xử lý face/glyph-cache là nghi phạm đầu tiên.
- **Vòng lặp layout font.** Một layout `FSS_set_scale` có thể giữ UI job worker
  trong glyph loop nhiều phút. Giới hạn tạm thời 512 glyph
  ([tools/patches/patch-fss-loop-cap.py](tools/patches/patch-fss-loop-cap.py))
  trả về `0x131` sau khi đạt giới hạn, giữ job manager hoạt động; việc loại bỏ
  face và xử lý atlas mới là sửa tận gốc và vẫn còn mở.
- **Nhân vật.** Được submit mỗi frame dưới dạng draw đã skin đầy đủ với texture
  model thật, và mask pass rasterise được chúng (đã xác minh bằng target
  snapshot), nhưng pass màu nhìn thấy không tạo pixel nào.
- **Memory thiết bị.** Trên GPU laptop 6 GB, tải vẫn có thể tạm thời vượt phần
  tiết kiệm từ R11G11B10F: một số lần chạy log `vkAllocateMemory failed (-2)`
  quanh lúc load tuỳ biến nhân vật (live images 2,6 GB ở frame 233) rồi tự hồi
  phục hoặc dừng. Live set giảm còn 1,2–1,7 GB khi tutorial chạy, nên vấn đề là
  đỉnh tải chứ không phải trạng thái ổn định.
- **Load chậm.** Màn hình “now loading” với spinner mực chạy ở 0,8–6 fps vì
  công việc đăng ký texture và giải nén của chính game chạy dưới dạng guest code
  được biên dịch lại; khi load xong, màn hình tiêu đề chạy ở 33–58 fps.

## Bắt đầu từ đây

| Bạn muốn biết | Xem tại |
|---|---|
| Điều gì đã biết, điều gì chưa biết và nên đọc theo thứ tự nào | [STATUS.md](STATUS.md) |
| Bản port hiện render được đến đâu | [RECOMP_BOOT_TO_UI.md](RECOMP_BOOT_TO_UI.md) |
| Chuỗi khởi động đã giải mã | [BOOT_CALLGRAPH.md](BOOT_CALLGRAPH.md) |
| Toàn bộ module `main` trong một tài liệu | [ENGINE_REFERENCE.md](ENGINE_REFERENCE.md) |

### Port

- Phạm vi và mục tiêu: [PORTING.md](PORTING.md), [BOOT_MILESTONE.md](BOOT_MILESTONE.md), [BOOT_ENGINE_ORDER.md](BOOT_ENGINE_ORDER.md)
- Worklist và hợp đồng nền tảng: [PORT_WORKLIST.md](PORT_WORKLIST.md), [PLATFORM_IMPLEMENTATION_SPEC.md](PLATFORM_IMPLEMENTATION_SPEC.md), [PLATFORM_REFERENCE.md](PLATFORM_REFERENCE.md)
- Vị trí của platform layer: [PLATFORM_LAYER_LOCATION.md](PLATFORM_LAYER_LOCATION.md)
- Đường đi đồ họa: [GRAPHICS_NVN.md](GRAPHICS_NVN.md), [GRAPHICS_SCOPE.md](GRAPHICS_SCOPE.md)

### Bối cảnh và phạm vi bao phủ

- Engine và middleware: [ENGINE_RECONSTRUCTION.md](ENGINE_RECONSTRUCTION.md), [SEAD_COVERAGE.md](SEAD_COVERAGE.md), [NNWARE_COVERAGE.md](NNWARE_COVERAGE.md), [AGL_COVERAGE.md](AGL_COVERAGE.md)
- Module `sdk`: [SDK_ANALYSIS.md](SDK_ANALYSIS.md), [SDK_REFERENCE.md](SDK_REFERENCE.md)
- Kiểm chứng layout: [VERIFICATION.md](VERIFICATION.md), [VTABLE_VERIFICATION.md](VTABLE_VERIFICATION.md)
- Tooling và hướng decompile: [DECOMPILATION_UNBLOCKED.md](DECOMPILATION_UNBLOCKED.md), [DECOMPILED_BODIES.md](DECOMPILED_BODIES.md)
- Khảo sát hệ sinh thái rộng hơn: [ECOSYSTEM.md](ECOSYSTEM.md), [subsystem-map.txt](subsystem-map.txt)

## Trong tài liệu này

[Tình trạng](#tình-trạng) · [Mục tiêu](#mục-tiêu) · [Bố cục container NSO](#bố-cục-container-nso) ·
[Quan sát về kiến trúc](#quan-sát-về-kiến-trúc) · [Bản đồ bộ nhớ](#bản-đồ-bộ-nhớ) ·
[Phân rã subsystem](#phân-rã-subsystem) · [Pipeline nội dung](#pipeline-nội-dung) ·
[Bộ công cụ](#bộ-công-cụ) · [Cách tái lập](#cách-tái-lập) · [Hạn chế](#hạn-chế) ·
[Pháp lý](#pháp-lý) · [Giấy phép](#giấy-phép)

---

## Tình trạng

| Hạng mục | Trạng thái |
|---|---|
| Nhận dạng mục tiêu | Xong |
| Xử lý container/định dạng | Xong |
| Bản đồ bộ nhớ | Xong |
| Kiểm kê hàm/symbol | Xong (113.150 hàm) |
| Phân rã subsystem | Xong (55 namespace) |
| Nhận dạng engine & middleware | Xong |
| **Decompile thân hàm** | **Chưa xong** — xem [Hạn chế](#hạn-chế) |
| **Bản port PC biên dịch lại** | Boot đến UI trong game: `RootTask::prepare_`, display loop, tạo nhân vật PlayerMake, màn hình tiêu đề 1920×1080 và tutorial lần đầu — [RECOMP_BOOT_TO_UI.md](RECOMP_BOOT_TO_UI.md). Tutorial vượt qua aim/ZR với chữ hướng dẫn đọc được, còn căn phòng 3D trung tâm 960×540 của trang Move cũng render được. Ranh giới tutorial → plaza đang được kiểm tra: patch idempotent chuyển `5 → 6` của tutorial sang warp state 7, còn handoff thực tế `4 → 5` của UI/page manager 21 trạng thái load scene tin tức Off the Hook (entry state 5 của bảng cũ là null vì chuyển tiếp tạo page manager mới). Đường vòng `4 → 7` trước đây đến màn hình chọn gear rồi dừng tại state 9 null; đó là đường chẩn đoán, không phải đường đến plaza. Plaza 3D vẫn chưa được xác nhận; scene tin tức và hai host render trong viewport trung tâm 960×540. Khoảng một phần ba số lần boot bị dừng ở chuyển tiếp UI job nhân vật → tutorial. |

Mọi nội dung bên dưới là phân tích tĩnh binary đã phát hành, trừ khi một mục ghi rõ
khác đi; các phát hiện runtime từ bản port được đánh dấu tương ứng. Chỉ khẳng
định hành vi khi đã quan sát hoặc decompile được.

## Mục tiêu

| Thuộc tính | Giá trị |
|---|---|
| Module | `exefs/main` (23.717.627 byte) |
| Container | **NSO0** (không phải ELF trên đĩa) |
| Kiến trúc | AArch64, 64-bit little-endian |
| Title ID | `01003bc0000a0000` |
| ACID | `Is Retail: 1` |
| Build ID | `F18FF3CFCBAD0884D72ABBEB6C540D6B00000000000000000000000000000000` |
| Stack của main thread | `0x100000` |
| Độ ưu tiên main thread | 44 (ACID cho phép khoảng 28–59) |
| Các file cùng ExeFS | `main.npdm`, `rtld`, `sdk`, `subsdk0`–`subsdk3` |
| Image base (khi nạp) | `0x7100000000` |

### Xác nhận đây là Splatoon 2

Tên tài nguyên lấy được từ `.rodata` là bằng chứng quyết định:

```
WeaponInfo_%s.byml      GearInfo_%s.byml        UdemaeGrade.byml
TankInfo.byml           SkillInfo.byml          BrandInfo.byml
BottomInfo.byml         HairInfo.byml           PaintResTex.byml
PlayerRank.byml         EnemyInfo.byml          DamageRateInfo.byml
MapInfo.byml            NpcInfo.byml            ActorDb.byml
WorldHotaruTalkInfo.byml                        WorldHotaruFreeTalkInfo.byml
```

Map được phát hành với tên **MakoMart** mang codename nội bộ **Blitz** —
`Map/Blitz.mutre.szs` — và được xác nhận độc lập bởi namespace symbol
`BlitzViewer` trong binary.

## Bố cục container NSO

`main` là container NSO0: các section được nén bằng LZ4 và xếp liền nhau trên
đĩa, nhưng offset *bộ nhớ* của mỗi section lại được căn theo page. Khoảng trống
đó là chi tiết quan trọng nhất khi dựng lại image.

| Section | Vùng bộ nhớ | Kích thước |
|---|---|---|
| `.text` | `0x0000000` – `0x1415068` | 21.045.608 |
| `.rodata` | `0x1416000` – `0x2d624b3` | 26.526.899 |
| `.rwdata` | `0x2d63000` – `0x2fdb1b0` | 2.589.104 |
| `.bss` | `0x2fdc000` – `0x3699e50` | 7.065.504 |

### MOD0

Header module `MOD0` nằm tại **`.text+0x8`**. Theo
[đặc tả MOD của SwitchBrew](https://switchbrew.org/wiki/MOD), nó thay thế cho
`PT_DYNAMIC` và **không chứa entry point**:

| Offset | Trường | Bản build này |
|---|---|---|
| 0x0 | Signature `"MOD0"` | `4d4f4430` |
| 0x4 | `DynamicOffset` | `0x2f9a468` |
| 0x8 | `BssStartOffset` | `0x2fdbff8` |
| 0xC | `BssEndOffset` | `0x3698f98` |
| 0x10 | `ExceptionInfoStartOffset` | `0x2921ec0` |
| 0x14 | `ExceptionInfoEndOffset` | `0x2a00eac` |
| 0x18 | `ModuleOffset` (sinh lúc runtime, ≈ base của `.bss`) | `0x2fdbff8` |

> **Đính chính.** Một bản trước của README này suy ra “entry VA” từ
> `entryTarget + entryOffset` bằng hai offset `0x10`/`0x14`. Hai trường đó là
> metadata xử lý ngoại lệ. MOD0 **không có entry point**; module được vào thông
> qua dynamic section. Xem [BOOT_MILESTONE.md](BOOT_MILESTONE.md) để biết chuỗi
> khởi động thật.

Dynamic section (VA `0x2f9a470`) chứa các con trỏ liên quan đến boot:

```
DT_INIT          = 0x24
DT_FINI          = 0x160
DT_INIT_ARRAY    = 0x2fd7f90      1604 static constructor
DT_INIT_ARRAYSZ  = 0x3220
```

### Lưu ý về một trường trong header NSO

Trường 32-bit tại offset `0x40` của header NSO là **reserved (dành riêng)**. Nó
**không phải** địa chỉ `.bss`, và không được đọc như địa chỉ — trong container này
nó giữ kích thước **đã nén** của section `.data`. Nếu đọc nó như địa chỉ, `.bss`
tạo ra sẽ chồng lấn lên `.rwdata`. `.bss` nằm ngay sau section đã khởi tạo cuối
cùng trong bộ nhớ.

## Quan sát về kiến trúc

`.text` chứa 5.264.410 lệnh. Thống kê lệnh:

| Mã hóa | Số lượng | Ý nghĩa |
|---|---:|---|
| `STP x29,x30,[sp,#-N]!` | 7.316 | prologue của hàm (cận dưới số hàm) |
| `STP x29,x30,[sp,#N]` | 60.453 | lưu frame |
| `B` (`0x14......`) | 114.236 | nhảy không điều kiện |
| `PACIBSP` / `AUTIBSP` | **0** | không có pointer authentication |
| `BTI c` | **0** | không có branch target identification |

Lệnh đầu tiên tại VA `0x100` là `stp x29,x30,[sp,#-0x10]!` — một prologue chuẩn,
xác nhận `.text` bắt đầu bằng code.

> **Suy luận.** Pointer authentication và BTI là các biện pháp giảm thiểu mà SDK
> đời sau của Nintendo sinh ra. Việc chúng **hoàn toàn vắng mặt** phù hợp với một
> bản build từ toolchain thời kỳ đầu 2017. Đây là suy luận từ **sự vắng mặt của
> lệnh**, không phải từ chuỗi trong build.

## Bản đồ bộ nhớ

Theo cách dựng lại từ một lần nạp module để phân tích (18 block):

```
.text          7100000000   21,045,608  r-x
.plt           7101412168       12,032  r-x
.rodata        7101416000           72  r--
.rela.dyn      7101416048    6,121,056  r--   dynamic relocations
.rela.plt      71019ec6a8       18,048  r--
.hash          71019f0d28    1,110,904  r--
.gnu.hash      7101b000a0    1,238,848  r--
.dynsym        7101c2e7e0    3,518,952  r--   148,138 symbols
.dynstr        7101f899c8    8,828,579  r--   8.8 MB of names
.rodata.1      71027f506b    5,690,440  r--
.data          7102d63000    2,323,568  rw-
.dynamic       7102f9a470          400  rw-
.data.1        7102f9a600           80  rw-
.got.plt       7102f9a650        6,040  rw-
.got           7102f9bde8      246,184  rw-
.init_array    7102fd7f90       12,832  rw-
.bss           7102fdc000    7,065,504  rw-
```

**Module này không bị strip.** Bảng symbol động của ELF vẫn còn nguyên: 3,5 MB
`.dynsym` và 8,8 MB `.dynstr`. Đây là đặc điểm giá trị nhất của mục tiêu này —
phân tích bắt đầu từ 113.150 tên hàm thật, thay vì `FUN_xxxxxxxx`.

## Phân rã subsystem

113.150 hàm trải trên 55 namespace cấp cao nhất.

| Namespace | Số hàm | Diễn giải |
|---|---:|---|
| `Game` | 28.439 | gameplay chính |
| `nn` | 15.953 | NintendoSDK |
| `Lp` | 10.672 | tầng framework của game |
| `Cmn` | 4.447 | code dùng chung |
| `sead` | 4.022 | thư viện C++ first-party |
| `agl` | 2.852 | đồ họa |
| `aal` | 2.264 | applet/UI của SDK |
| `gsys` | 2.099 | tầng hệ thống của game |
| `Cui` | 1.815 | component UI của SDK |
| `eui` | 803 | UI mở rộng của SDK |
| `Lobby` | 792 | lobby online |
| `enl` | 717 | — |
| `Cnet` | 590 | mạng |
| `Match` | 555 | ghép trận |
| `xlink2` | 548 | middleware âm thanh/hiệu ứng |
| `Shop` | 509 | cửa hàng trong game |
| `pead` | 490 | âm thanh |
| `UICheck` | 413 | kiểm tra UI |
| `MiniGame` | 184 | — |
| `PlayerMake` | 132 | tạo nhân vật |
| `Cstm` | 121 | tùy biến |
| `DbgSetting` | 120 | cài đặt debug |
| `PlayerViewer` | 86 | trình xem debug |

Cộng thêm 33.692 hàm mang tên `_Z` (toán tử, thunk, template) và 327 hàm C thuần.

### Công cụ nội bộ còn sót trong bản retail

Các harness debug và test vẫn tồn tại trong binary phát hành:

```
DbgSetting 120   PlayerViewer 86   UdgwTest 66      NisdTest 33
EnemyObjViewer 28   ScheduleViewer 27   YmgcTest 25   JintTest 21
GearUnsetupTest 20  BlitzViewer 9   GndColTest 7      MrmtTest 3
```

### Engine và middleware

| Thành phần | Bằng chứng |
|---|---|
| **sead** | `sead::CalculateTask` (đồ thị task calculate/draw), `ExpHeap`, `CriticalSection`, `SafeStringBase`, `Matrix34f`, `TreeNode`, `Path::getExt` |
| **agl** | 2.852 hàm, 6.024 lần xuất hiện trong `.rodata` |
| **Radiance** | `Etc/BRDFFitting/ggx_ltc.byml` (GGX LTC BRDF fitting) |
| **NintendoWare / Nw4f** | 35 lần xuất hiện trong `.rodata` |
| `nn::nex` | thư viện mạng của Nintendo |
| `nn::bcat` | DeliveryCache (phân phối nội dung nền) |
| `nn::aoc` | nội dung bổ sung |
| `nn::nfp` | Amiibo (`Cmn::Def::isSupportedAmiibo`) |
| libcurl | 24 hàm / 36 symbol — HTTP |
| **wslay** | 53 hàm — WebSocket |
| zlib | 49 hàm / 63 symbol |
| libc++ (`std::__1`) | 292 hàm |
| `__nnmusl` | libc dẫn xuất từ musl của Nintendo |

Sự kết hợp libcurl + wslay + `Cnet`/`Match`/`Lobby`/`Shop` phù hợp với kiến trúc
live-service.

## Pipeline nội dung

Các đường dẫn tài nguyên lấy được từ `.rodata`:

```
Model/%s.Nin_NX_NVN.szs      NX NVN (NVIDIA) model container
Map/%s.szs                   Map/Blitz.mutre.szs
Env/%s.szs                   Etc/LightCtrl/%s.byml
Nin_NX_NVN.release.szs       Etc/BRDFFitting/ggx_ltc.byml
HapTexture.bfres             PanelTexture.bfres        IconTexture.bfres
```

Một chuỗi để lộ toolchain build nội bộ:

```
File = %%AGL_ROOT%%/tools/bat/convertTempTexture.bat, NoWindow = True,
WindowStyle = Hidden, WaitEnd = True, Arg = %%AGL_ROOT%%/tools/temporary/temp_proj_light.bfres
```

`.mutre` là một định dạng biến thể map riêng, khác với `.szs`.

## Bộ công cụ

### Yêu cầu

- **Ghidra 12.1.2** (extension bên dưới khớp với phiên bản này)
- **JDK 21+** — `JAVA_HOME` phải trỏ tới thư mục gốc của JDK
- **[SwitchLoader](https://github.com/Adubbz/Ghidra-Switch-Loader)** — loader
  Ghidra cho các định dạng Nintendo Switch. Cung cấp cả việc nạp NSO và việc
  phục hồi `.dynsym` của ELF được dùng ở đây.
- **hactool** — để trích ExeFS từ XCI và giải nén các section NSO
- **Node.js 18+** cho các script trong `tools/`
- **Python 3** thông qua PyGhidra của Ghidra nếu bạn muốn export inventory bằng script

### Biến môi trường

```powershell
$env:GHIDRA_INSTALL_DIR = 'C:\path\to\ghidra_12.1.2_PUBLIC'
$env:JAVA_HOME          = 'C:\Program Files\Java\jdk-21.0.12'
```

Cài SwitchLoader qua *File → Install Extensions…* của Ghidra, rồi khởi động lại
Ghidra. **Không** đặt cùng một extension ở cả thư mục cài Ghidra lẫn thư mục
extension của người dùng — Ghidra sẽ dừng với lỗi
`Multiple modules collided with same name`.

### Trích xuất mục tiêu

```powershell
hactool -t xci --exefsdir=exefs "Splatoon 2 USA.xci"
hactool -t nso exefs/main --uncompressed=main.decompressed
```

Cần có key cho XCI nhưng key **không thuộc kho này** và tuyệt đối không được commit.

## Cách tái lập

### 1. Export inventory symbol

Phải khởi động PyGhidra một cách tường minh, nếu không script Python sẽ lỗi
*"Ghidra was not started with PyGhidra"*:

```powershell
& "$env:GHIDRA_INSTALL_DIR\support\pyghidraRun.bat" -H `
    "<project-dir>" Sp2 `
    -import "exefs\main" `
    -noanalysis `
    -scriptPath "<repo>\tools\ghidra" `
    -postScript ExportInventory.py "<repo>\inventory.txt" `
    -deleteProject
```

Kết quả mong đợi:

```
ExportInventory wrote inventory.txt (functions=113150 symbols=148138 strings=146621)
```

Việc chạy chỉ import (`-noanalysis`) là **có chủ ý**: bảng symbol của ELF cho tên
hàm mà không phải trả giá cho việc phân tích. **Kích thước** hàm từ lần chạy này
chỉ là placeholder và không được hiểu là kích thước code thật.

### 2. Phân tích inventory

```bash
node tools/static/analyze-inventory.mjs inventory.txt
node tools/static/namespace-report.mjs   inventory.txt
node tools/static/subsystem-map.mjs      inventory.txt subsystem-map.txt
node tools/static/symbol-census.mjs      main.decompressed
node tools/static/check-prologue.mjs     main.decompressed
```

### 3. Công cụ container

`tools/nso/nso2elf.mjs` dựng lại một ELF64 có thể nạp được từ NSO đã giải nén. Nó
tồn tại cho các engine phân tích không hỗ trợ NSO; Ghidra với SwitchLoader thì
không cần.

```bash
node tools/nso/nso2elf.mjs main.decompressed main.elf
node tools/nso/validate-elf.mjs main.elf      # tự kiểm tra cấu trúc
node tools/nso/mod0-exports.mjs main.decompressed
```

`validate-elf.mjs` kiểm tra header ELF, quy tắc segment
`p_vaddr ≡ p_offset (mod align)`, chồng lấn segment/section, và vị trí `.bss`. Nó
được viết ra sau khi **bốn lỗi bố cục thật** đã được tìm thấy bằng tay.

## Hạn chế

Đây là những khoảng trống có thật và chưa giải quyết. Đừng đọc các bảng bên trên
như một bản mô tả đầy đủ về binary.

1. **Không có thân hàm nào được decompile.** Inventory chỉ ở mức symbol. Do đó
   **không có tuyên bố nào về hành vi runtime ở bất kỳ đâu trong kho này.**
2. **Phân tích tự động toàn phần không hoàn tất.** Bộ phân tích headless của Ghidra
   bị treo một cách tái lặp. 22 hàm đệ quy qua các computed jump mà đích nằm
   ngoài image; log sau đó chỉ tiến được khoảng **99 byte mỗi 3 phút**:

   ```
   WARN Decompiling 710090ab30: Unable to read bytes at ram:23504cd0fec
   ```

   Đây là decompiler đi theo một computed jump, **không phải** lỗi của image đã
   dựng lại. Chạy phân tích trong **Ghidra GUI**, nơi có thể điều khiển từng bước,
   là cách được khuyến nghị để vượt qua.
3. **REA không thể điều khiển mục tiêu này trên Windows.** Adapter Ghidra của REA
   6.5.0 chỉ chấp nhận PE x86/x86-64 và raw 6502 được chọn tường minh:

   > "Windows Ghidra P0 accepts native x86 and x86-64 PE applications and DLLs,
   > and explicitly selected raw 6502 images"

   Cả ELF lẫn nỗ lực `--architecture arm64` không header đều bị từ chối với
   `target_format_unsupported`. Hopper chỉ có trên macOS và IDA chưa được đăng ký.
   Bản cài Ghidra **có** AArch64, nên đây là giới hạn của adapter, không phải
   thiếu module xử lý.
4. **Việc phân tích bảng export MOD0 chưa được giải quyết.** Hai cách hiểu bố cục
   trường khác nhau cho kết quả mâu thuẫn (một offset âm, một vượt quá EOF), nên
   **không có tên hàm nào** trong kho này được lấy từ bảng MOD0. Tên hàm đến từ
   `.dynsym` của ELF thông qua SwitchLoader.
5. **Việc gán namespace chỉ dựa trên tiền tố symbol.** Nhãn namespace mô tả
   symbol được khai báo ở đâu, **không** mô tả code làm gì.

## Pháp lý

Kho này **không chứa code game, không chứa dữ liệu game, và không chứa key mật mã**
— chỉ có ghi chú phân tích và công cụ do chính tôi viết. Splatoon 2 và Nintendo
Switch là thương hiệu của Nintendo. Không có tuyên bố liên kết hay được bảo trợ.
Mục đích là nghiên cứu khả năng tương tác và bảo tồn; hãy dùng bản sao game mà bạn
sở hữu hợp pháp.

## Giấy phép

Công cụ và ghi chú gốc trong kho này được phát hành theo MIT License.
Xem [LICENSE](LICENSE).
