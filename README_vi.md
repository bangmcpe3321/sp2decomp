# sp2decomp

**ADME_vi.md]

Ghi chú nghiên cứu kỹ thuật ngược và dán cho tập tin thực hiện được chuyển đổi Nintendo
`main` of **Splatoon 2** (USA), whose ExeFS lives in the `Splatoon 2 USA.xci` dump,
cộng với cổng máy tính phục hồi của tập tin thực hiện được đó.

Đây là nhật ký nghiên cứu, chưa hoàn tất việc phân hủy.
đã được thiết lập về cấu trúc của mô-đun, kiến trúc và hệ thống con, các tập lệnh
đã từng thiết lập nó, và cảng đã đi được bao xa.

## Trạng thái hiện tại

Cổng được biên dịch chạy mã riêng của trò chơi trên Vulkan trên Windows. Màn hình tiêu đề trình diễn
1920×1080, người chơi tạo ra nhân vật hoàn tất với văn bản có thể đọc được, các vở kịch cắt ngang,
và chạy hướng dẫn điều khiển cánh tay đầu tiên: trang điều khiển dịch ra toàn bộ (the Pro
Biểu đồ điều khiển, ảnh Joy-Con, hình băng cờ, các dấu nhắc nút, hướng dẫn
Các câu được đọc chính xác, và các bước ZR được thông qua. Hướng dẫn sẽ tới trang di chuyển:
Biểu đồ điều khiển của nó, "Hãy di chuyển với L!" cờ hiệu và tay nhanh chóng trình bày, và phòng 3D phía sau chúng
Bây giờ là trung tâm 96×540, đo tại ~98% không đen và luma 85. A
temporary `SCENECHG` log in `main_00620ED0` makes the tutorial and UI/page state sequences
visible. Motion aiming reads a swept six-axis state (`NX_SIXAXIS_WOBBLE=1`), and a scripted input
Quét các bậc thang phía trước.

The 9-state tutorial manager requests `5 → 6` after the first warp; an idempotent patch
redirects that one request to warp state 7. The 21-state UI/page manager's `4 → 5` request is
không phải là một ngõ cụt bang. mục nhập số 5 của nó vẫn vô giá trị trong bảng cũ, nhưng trang ảo
Quản lý thay đổi cảnh xây dựng một trình quản lý trang mới và nạp tiêu đề Off the Hook news
scene. A live capture of the actual `4 → 5` transition is below: the central 960×540 TV
viewport shows the news studio and the two hosts, Pearl and Marina. The earlier `4 → 7` redirect
là một đường vòng chẩn đoán bỏ qua các tin tức: nó đạt đến màn hình chọn số của đấu thủ
(`7 → 1 → 2 → 9`), whose state-9 entry is null, and stalls there.

Tin tức bây giờ đã kết thúc, và các lô hàng phía sau nó.
con đường mật mã của trò chơi bởi [patch- giao cho-bgm-handover.py] (Công cụ/patherches/patch- newsend-bgm handover.py,
so the pose sequence completes and the scene goes `5 → 7 → 1 → 2`: the Turbun Shell reward, then
`SeqMgrPlaza::stateProgress`, i.e. Inkopolis Square. The last story transition is
`Cmn::BgmConductor::xlinkCalc`, the plaza's own track restarting. The 3D world behind the plaza UI
Vẫn không vẽ (xem quảng trường) (#the-plaza), vì vậy hình vuông chỉ nhìn thấy thông qua các
Máy ảnh đầu tiên của trang NPC. khoảng một khởi động trong ba gian hàng trong bộ quản lý công việc UI tại
Chuyển đổi ngữ cảnh ký tự (xem Mở).

![The title screen at 1920×1080](docs/images/title-1920x1080.png)

* Màn hình tiêu đề, được hiển thị với kích cỡ hoàn chỉnh 1920×1080 đầu ra.
6750 on this build; the route keeps the `ZL+ZR` chord held past that point.*

![The Off the Hook news scene reached through the actual 4 → 5 transition](docs/images/news-4to5.png)

*The actual `4 → 5` UI/page transition loads the title's Off the Hook news scene. The central
96×540 giới thiệu đài truyền hình với Pearl và Marina; bảng 21 bang cũ vẫn còn
thông báo tình trạng của nó là vô giá trị vì sự chuyển tiếp tạo ra một trình quản lý trang mới.
xung quanh UI vẫn còn sai quy mô (các vấn đề UI-layout riêng biệt), nhưng chính bản thân hiện trường tin tức
renders. The `4 → 7` detour skips this scene and reaches the gear-selection screen instead.*

![Inkopolis Square behind the first NPC's gear page](docs/images/plaza-gear-page.png)

*The plaza after the news: `5 → 7 → 1 → 2` reaches `SeqMgrPlaza::stateProgress` and the HUD
NPC đầu tiên con đường đi vào mở trang số
(`stateShowGearNpc`: weapon, headgear, clothes, shoes), and that page's camera renders the
bầu trời của hình vuông phía sau nó là những đám mây trên sương mù, ở phía dưới bên phải bên cạnh lá bài.
dưới hai phần ba khung là 100% không đen với 63–77 màu riêng biệt trên mỗi mẫu
region, which is a rendered sky, not a flat fill. The `B` prompt backs out of the page.*

![Inkopolis Square at rest in the plaza](docs/images/plaza-progress.png)

*The same plaza at rest, in `cProgress` with the NPC page closed and the camera turned: the
NPC/hành động và vẽ HUD, nhưng không có hình học sân khấu và không có bầu trời (98% điểm đen).
Đây là ngăn cản vẽ hiện tại, được miêu tả dưới đây là "The Square".

![The tutorial aim step, passed](docs/images/tutorial-aim-legible.png)

Những ban nhạc hướng dẫn đọc "Aim at theballoon" và "Target the [balloon]
balloon with the [reticle] reticle!"; `Just like that!` is the game's answer once the swept
Tình trạng sáu trục mang lại khối u lên quả bóng.
`TutorialGuideMsgPage` with the CPU-written size-100 BlitzBold glyph atlas, which the port now
Nạp lại khi byte thay đổi.

![The first-launch controller tutorial, "Shoot with ZR"](docs/images/tutorial-zr-step.png)

* Bước tiếp theo: "Shoot with [ZR]!" với "Tlt bộ điều khiển để mục tiêu" bên dưới, Joy-Con
ZR là màu cam sáng và phù hiệu nhanh đọc ZR.

![The tutorial Move step](docs/images/tutorial-move-step.png)

*The Move page. sơ đồ Pro Controller nhấn mạnh cái gậy bên trái, và "Move with L!"
Băng cờ và dấu nhắc tay được vẽ; phòng phía sau chúng bây giờ được dịch là trung tâm 96×540
Thể thao xem (~98% không đen, luma 85), thay vì đen. Trang là một bước đã định thời gian:
`main_00A00BDC` advances the tutorial manager from page 6 to page 8 when the global counter
`[+0x44c]` reaches `0x12c0`, about 3,100 frames after the page starts. An earlier forced skip
took the `main_00A00300` actor-flag path at `L_A00350`, which calls `main_00620ED0(this, 7)` —
the quit-to-title path; the `SCENECHG` log showed `6 -> 7` and the title reappeared. The skip is
bây giờ bị tắt ([công cụ/pats/patch-move-skip-dip.py] (công cụ/patch/move-skip-disty).
Vậy là sự chuyển đổi dòng thời gian diễn ra.

![PlayerMake gear selection reached through the UI state redirect](docs/images/ui-gear-state9.png)

Khung bằng chứng bang-9 từ lần chạy đầy đủ đầu tiên:
screen (four gear cards on the Switch tablet), reached through `4 -> 7 -> 1 -> 2 -> 9`. This is not
Trường hợp 9 là vô giá trị, vì vậy UI dừng ở đây, hình ảnh xác nhận rằng chuyển hướng
Bị bắn mất bang 7 là một đường vòng vào máy chơi Make UI, chứ không phải là ra khỏi quảng trường.

![PlayerMake character creation, eye colour step](docs/images/boot-playermake-en.png)

*Player Make, bước màu mắt ("Pick một màu mắt!"). Văn bản có thể xác định được vì các cửa hàng
Chữ viết tắt của CPU R8 là hàng đóng gói thay vì cho đến khi nó.
Vẫn còn mất tích từ cái thẻ màu.

![Character confirmation](docs/images/boot-confirm-text.png)

*The confirmation page, captured before the language fix (`この設定でオッケー？`); the small
Gợi ý bên dưới bên trái vẫn còn mặc quần áo — một giây, một chút atlas nhỏ hơn.

Sáu lần sửa chữa lấy cảng từ một chiếc giày gây tử vong đến thời điểm này:

- **Dropped tail call.** `Cui::Page::findPartsControl` (`0x20BD74`) ends in
  `b 0x20CF60`, a tail call into `Control::List::searchAs<PartsCtrl>`. The recompiler emitted
  hai hướng dẫn trước khi nó và không gọi, vì vậy các chức năng trở lại
  `page->controls + 0x38` — a list pointer — to callers that expect a `PartsCtrl*`;
  `Cui::CustomizePartsSet::onInitialize` then called `(*ctrl)[0]` through it and died with
  `call to 50c12201b8` (heap) at boot. A scan of every generated function in every module for a
  final `b` to another function with no emitted call found **this as the only case in the whole
  Trò chơi**. Patch: [công cụ/patches/patch-tail call-patch-taild74.py] (công cụ/patch/patch-tail call-bd74.py).
- **The glyph atlas is CPU-written.** The 2048×2048 R8 atlas is created with `stride 0` (the
  builder treats it as tiled), swizzle (R,1,1,1) and `alpha_from_r`, but the game fills it from
  the CPU, so its guest memory is packed `width`-byte rows. Untiling it produced streak noise
  (the `NX_DUMP_ALPHA` dump of the uploaded atlas showed no glyph shapes); treating stride 0 as
  `row_stride = width` and widening R8 → RGBA8 `(255,255,255,R)` made the labels legible.
  Đắp vá: [công cụ/patch/patch-alpha-atlas.py] (công cụ/patch/patch-alpha-atlas.py).
- **Các bản đồ chạm khắc được tải lên chỉ một lần.** Bản đồ cỡ 100 BitzBold cũng được viết bởi
  CPU thông qua bản đồ bộ nhớ, nhưng động cơ phông chữ không bao giờ báo cáo phạm vi đó
  `nvnMemoryPoolFlushMappedRange` (the 32 KB+ flushes the port sees belong to other pools), so the
  ảnh giữ những bức thư của bất cứ khuôn mặt hay kích cỡ nào đã lấp đầy những tế bào này trước — những bức chạm khắc sạch sẽ,
  Văn bản sai. Cổng đã lấy mẫu byte trong 61 của mỗi ảnh R8 đọc như alpha một lần
  khung và tải lại toàn bộ ảnh khi hash thay đổi; các câu hướng dẫn của giáo sư ngay bây giờ
  đọc đúng và chi phí tải lên chỉ được trả trên khung động cơ phông chữ rasterise
  (`NX_ATLAS_REFRESH=0` disables). Patch: [tools/patches/patch-atlas-refresh.py](tools/patches/patch-atlas-refresh.py).
- **The reported language was byte-swapped.** `nn::settings::LanguageCode` is a `char[8]`,
  Nhưng cổng đã viết mỗi thẻ như một số với ký tự đầu tiên của nó trên byte cao, vì vậy
  `"en-US"` landed in memory as `"SU-ne"`. The game matched no language and fell back to
  Japanese (`/Message/CommonMsg_JPja.szs`), even though `nn::oe::GetDesiredLanguage` already
  answered `en-US` (that path `memcpy`s the tag). The codes are now derived from their string
  literals at compile time and the game loads `/Message/CommonMsg_USen.szs`.
  Đắp vá: [công cụ/patherches/patch-language- code.py] (công cụ/patch/patch-language.py).
- **A null font face on the intro→title transition.** `nn::font::FSS_set_scale` checks the
  face pointer, calls `get_scale_inputs` (which can release and rebuild the face) and then
  reloads the pointer and reads `[face+0x20]` without checking it again. When the face is null
  at that point the game died at data address `0x20`. The patch honours FSS's own null-face
  error (`0x131`) instead, so the caller falls back to the unscaled glyph instead of crashing.
  Đắp vá: [công cụ/pats/patch-fsch-null-face.py] (công cụ/patch/patch-fs-null-face.py).
- **Whole-tareget đã xóa các tấm UI.** NVN clip rõ ràng để kéo khóa.
  ignored the scissor (behind `NX_CLEARS_SCISSOR=1`) and cleared the whole attachment instead, so
  rõ ràng có nghĩa là cho một bảng điều khiển UI xóa phần còn lại của ảnh UI. Trên các giáo viên đầu tiên
  gỡ bỏ sơ đồ Pro Controller và các phần bố trí khác, chỉ để lại ảnh chụp, băng cờ
  and arrows. Honouring the scissor by default restores the whole page. `NX_CLEARS_SCISSOR=0`
  Phục hồi các hành vi cũ cho phân loại (Bản một khi nhìn thấy một khóa học phá vỡ với scissored
  An toàn, bác sĩ/nvn/DEBUG.md #52).
  Đắp vá: [công cụ/patherches/patch-scissor-mặc định.py] (công cụ/patherches/patch-scissor-scissor.py).

### Quảng trường

After the news, `SeqMgrPlaza` runs `5 cNews → 7 cGetTurbunShell → 1 cPreProgress → 2 cProgress`.
The Turbun Shell reward is the pop-up at frames 10000–15000 of the plaza run; `cProgress` is
Quảng trường New York, HUD lên, với đánh dấu NPC/Action trên màn hình.
string table at `main.bin+0x282e0d9` (`cReady, cPreProgress, cProgress, cFirstDemo, cTitle,
cNews, cIntro, cGetTurbunShell, cFirstTurbunShell, cNpc, …`), and the delegate table is at
`main.bin+0x2fbb578`.

Một điều trong hình vuông là giải quyết, là hữu ích để phân chia những gì làm việc với những gì làm
not. Standing in front of an NPC and pressing `A` calls `SeqMgrPlaza::requestLookAtNpc`(`0x97CC2C`) → `changeStateTo(9)` = `cNpc`; that spawns `Game::SeqPlazaNpc` and opens
`stateShowGearNpc` (`main_00988E6C`). Inside that page the stage's sky draws behind the gear
card: đầy đủ dân cư, mây bão hòa qua sương mù (100% không đen, 63–77 màu sắc riêng biệt cho mỗi người
sampled region). `B` there calls `changeStateTo(1, true)` into `stateShowStatusNpc`, whose back
button calls `outGearOrder` and returns `SeqMgrPlaza` to `cProgress`. With the page closed the
square is black again, while the `Lp::UI` markers and the HUD still draw (98% of pixels black).

The difference is not the route and not the moment the page closed. Entering `cProgress` and
never opening an NPC page leaves the square black; opening one, closing it with `B` and turning
Máy quay để nó cũng đen - cùng khung với nhau theo định sẵn theo bất cứ cách nào
`cProgress` is reached (frames 37500 and 42500 of the `plazab` run). The page camera is what
để sân khấu thu hút một trạng thái có thể sử dụng được.

Những gì các bản ghi quy định:

- Không có sân khấu nào cần thiết cả.
  this run (`0 unknown` submits, `nvnCommandBufferSetAlphaRef` is the newest command the game
  Cuộc gọi đầu tiên, và tất cả các cuộc gọi trực tiếp khác của NVN — gián tiếp vẽ, bản sao đệm,
  transform feedback, debug groups — is never made).- **Missing pipelines.** The 60-frame report shows `0 no pipeline` throughout; the stage's 637
  pipelines and 13 ASTC textures are built right after `2 → 9` (3.5 s of compile). Draws that
  reach the replay without a *program* do not draw: `no program` goes from 0 to ~3–5 million
  trên đường chạy, và 512 đường ống dẫn dầu từ đầu trở đi.
  Kết quả của cái nắp bộ nhớ tạm, không phải bộ đánh bóng bị mất.
- **The viewport's clears.** The last clear statistics show `96812 scissored`, of which only 13
  để lại thẻ thông hành của họ và dọn sạch một mục tiêu toàn bộ - các ô rõ ràng của quảng trường được scissored đến các
  96×540 công cụ quan sát tổng hợp, vậy nên thẻ thông hành của hình vuông không bị xóa khỏi bên ngoài.

Vì vậy, câu hỏi mở là bên trong sân khấu vượt qua chính nó.
plaza frame (`NX_TRACE_PASSES_FROM_FRAME`, [patch-pass-frame.py](tools/patches/patch-pass-frame.py)):
Mục tiêu mà sân khấu vẽ vào, cho dù vượt qua được tạo ra ở đó, và cho dù nó
thu hút sự chú ý của mọi người sau khi xem xong.

### Bộ nhớ, đầu vào và hướng dẫn

- **Six-axis sensor HLE.** `GetSixAxisSensorHandles` used to leave the output untouched, and it
  returned 0 where the API returns the number of handles written. `sead::NinJoyNpadDevice::calc`
  các cửa hàng có giá trị như số lượng cảm biến của nó, vì vậy trò chơi kết thúc điều khiển đã không có cảm biến và
  never called `StartSixAxisSensor` or `GetSixAxisSensorStates`. With the count returned, the game
  bắt đầu cảm biến 0 và đọc 16 trạng thái mỗi khung; HLE báo cáo một bộ điều khiển được giữ cấp
  (identity direction, gravity on -Z, 1/60 s delta). `NX_SIXAXIS_WOBBLE=1`
  ([patch-6axis-wobble.py] (công cụ/patch-axis-wobble.py) thêm vào một độ dốc chậm/yaw
  Đối với bổ sung của các hướng dẫn viên " hiệu chỉnh các điều khiển để mục tiêu!" bước. Đắp vá:
  [công cụ/patch--6axis.py] (công cụ/patch-axis.py).
- **R11G11B10F stored natively.** NVN format `0x3f` was always widened to RGBA16F off Android,
  Tăng gấp đôi mỗi trọng tải HDR/ store/sample (636 MB của 1020 MB ảnh trực tiếp tại tiêu đề trên một tiêu đề 6 GB
  Máy tính xách tay GPU, và nó hết bộ nhớ thiết bị ở hướng dẫn. Cổng giờ dùng
  `B10G11R11_UFLOAT_PACK32` when the device can render, blend, filter and copy it, halving
  those images (`NX_R11G11B10_EMULATE=1` restores the old behaviour). At the tutorial the live
  Thiết lập đi từ 5.6 GB đến 1. 1. 7 GB không có mã định vị thất bại. Patch:
  Dịch bởi Vũ Hạnh, Mai Linh, Nga, Huy Tô, Yuki, Ann, Phương, Phương The Vampire3X Subteam
- **Image accounting.** A live `VkDeviceMemory` histogram by NVN format is logged with the
  Báo cáo 60 khung, đó là cách kích thước của bộ R11G11B10F và D32F.
  [công cụ/patherches/patch-Patts.py.py] (công cụ/paches/patch-Patts.py).
- **Pipelines.** The pipeline cache is capped (`NX_PIPE_CAP`, default 2048) with deferred
  phá hủy; UI của gia sư đạt được khoảng 2100 đường ống trực tiếp, vì vậy nắp là một băng cá nhân
  Thay vì sửa chữa, và bộ nhớ ống dẫn là một phần lớn trong ngân sách 6 GB.

Mở:

- **The plaza's 3D world.** `SeqMgrPlaza::stateProgress` runs, the HUD and markers draw, and the
  Đường ống và kết cấu của sân khấu được xây dựng, nhưng hình học của hình vuông và bầu trời của riêng mình không để lại điểm ảnh tại
  phần còn lại — chỉ máy ảnh của NPC quay bầu trời sân khấu (xem quảng trường đầu tiên).
  sân khấu tự nó đi qua, kể từ khi những mảnh bóng của tổng hợp chỉ bao gồm 96×540 tầm nhìn,
  and the pipeline cache thrash (512 cap, 3–5 million `no program` draws) is what makes the
  Rút súng lại.
- **UI làm việc ở quầy tính năng chuyển đổi ký tự.** Khoảng một khởi động trong ba lần ngừng trò chơi
  Đang tăng ở khung ~2933–2942 mà không giải quyết hoạt động mạch: các mạch chính chờ trong
  `Lp::UI::Impl::JobMgr::endRun` on a light event while a UI job worker is still inside
  `nn::font::TextureCache::CalculateKerning` → `FSS_set_scale`, so the job never completes.
  Khởi chạy lại cùng một văn lệnh thường được thông qua. chồng chất nằm trong con đường mã phông chữ có độ xoay
  Được xử lý bằng phương pháp trị liệu mới ở phía trên, nên xử lý khuôn mặt/glyph-cache là nghi phạm đầu tiên.
- **Font layout loop.** A `FSS_set_scale` layout can keep the UI job worker inside the glyph
  Vòng lặp trong phút.
  ([tools/patches/patch-fss-loop-cap.py](tools/patches/patch-fss-loop-cap.py)) returns `0x131`
  Sau nắp, giữ cho người quản lý công việc sống; gỡ bỏ khuôn mặt và inlas xử lý là
  Sửa chữa thật sự và tiếp tục mở cửa.
- **Characters.** Gửi mỗi khung như là hoàn toàn lột da với các kết cấu mô hình thực, và
  thông qua mặt nạ rasterise họ (đã được sửa bằng hình ảnh đích), nhưng màu sắc nhìn thấy được thông qua
  không để lại điểm ảnh.
- **Device bộ nhớ.** Trên máy tính xách tay GPU, tải vẫn còn đỉnh trên R11G11BF
  savings: several runs log `vkAllocateMemory failed (-2)` around the character customisation
  tải (sống lại ảnh 2. 6 GB tại khung 283) và hoặc phục hồi hoặc trì hoãn. Thiết lập trực tiếp đã giảm
  1.2–1.7 GB một khi các hướng dẫn đã được tăng lên, vì vậy các đỉnh, không phải trạng thái ổn định, là vấn đề.
- **Loading là chậm.** Màn hình "nỡ lên" với bộ quay mực chạy ở 0,8–6 fps bởi vì
  Việc đăng ký kết cấu và giảm áp lực của trò chơi chạy như mã khách tái sử dụng;
  Một khi tải xong màn hình tiêu đề chạy ở 33–58 fps.

## Bắt đầu từ đây

|Anh muốn gì?|Đi đâu đây?|
|---|---|
|Những gì chúng ta biết, những gì là không, và theo những gì để đọc|[STATUS.md] (STATUS.md)|
|Cánh cổng đã lên màn hình bao xa?|[RECOMP_BOO_TO_UI.md] (RECOMP_BOO_TO_UI.md)|
|Chuỗi khởi động đã được giải mã|[Tiếng nhạc]|
| The whole `main` module in one document |[ENGINE_REFERCE.md] (ENGINE_REFERCE.md)|

### Cổng

- Phạm vi và mục tiêu:
- Danh sách làm việc và hợp đồng nền tảng: [PORT_WORKLST.md] (PORT_WORKLES.md), [PLATORM_IPEFECE.EPEC.md] (PLATORM_IPEPEPERSERSETETERSETETETED.D.)
- Nơi lớp nền tảng sống: [PLATORM_LAYER_LCOR.M]
- Đường dẫn đồ họa: [GPRICS_NVN.md] (GPPHCS_NVN.md), [GPRICS_SCOPE.md] (GPPHCS_SCOPE.md)

### Nền và tin tức

- Máy và phần mềm trung gian: [ENGINE_RECONSTRation.md] [ENGCON_RECONSTRation.md], [SEAD_ CERED.MED.D.ED.ED.ED.ED.ED.ED.ED.E.E.E.E.E.E.E.E.S.E.E.E.S.E.E.E.E.E.E.E.D., [N.E.E.S.E.E.E.E.E.E.E.E.E.E.E.S.E.E.E.E.E.E.E.E.L.E.E.E.L.E.L.E.E.L.E.E.E.L.D.E.E.E.E.E.E.E.E.E.D.D.E.D.D.D.E.,,::
- `sdk` module: [SDK_ANALYSIS.md](SDK_ANALYSIS.md), [SDK_REFERENCE.md](SDK_REFERENCE.md)
- Xác thực Bố trí: [VERIFIE.md]
- Công cụ và đường phân hủy: [DECOMPILAD_UNBLEPID.D.ED.AD.D., [EDCOMPLELED_BODES.md] (DEDCOMPLELED_DES.D.D.ED.ED.EPLELE.D.D.E.E.D.E.E.D.D.E.E.E.D.E.D.E.D.E.D.E.E.D.E.E.D.D.E.E.D.E.D.E.D.E.D.E.D.D.E.E.E.E.E.E.D.E.E.D.D.D.D.D.E.D.E.E.D.E.E.E.D.E.E.D.E.E.D.D.D.D.D.D.E.E.E.D.E.E.E.D.E.E.E.D.E.E.E.E
- Cuộc khảo sát hệ sinh thái mở rộng: [ECOSYSTEM.md] [ECOSSTEM.md], [phụ đề hệ thống-map.txt] (conse hệ thống-map.txt)

## Trong tài liệu này

[Status] (#status) · [Target] [#tareget] ·[SO container cha trí] [#nso-container-layout]
[Các quan sát kiến trúc] <b># bước theo kiến trúc</i> <b>Silence:</b># bản đồ lưu niệm].</i> <i>#memory-map.</i>
Dịch bởi Vũ Hạnh, Mai Linh, Nga, Ann, Yuki, Phương The Vampire3X Subteam
Dịch bởi Vũ Hạnh, Mai Linh, Nga, Ann, Yuki, Phương The Vampire3X Subteam
[Legal] (#legal) · [License] (#license)

---

## Trạng thái

|Vùng|Tình trạng|
|---|---|
|Nhận diện mục tiêu|Hoàn tất|
|Bộ ngăn chặn/ định dạng|Hoàn tất|
|sơ đồ bộ nhớ|Hoàn tất|
|Kiểm tra hàm/ymbol|Hoàn tất (113, 150 chức năng)|
|Phân hủy hệ thống con|Xong (55 vùng tên)|
|Nhận diện cơ chế & phần mềm giữa|Hoàn tất|
|**Sự phân rã chức năng cơ thể**|** Chưa xong** — xem [bắt chước] (# giới hạn)|
|** Cổng PC song song**| Boots to the in-game UI: `RootTask::prepare_`, display loop, PlayerMake character creation, the title screen at 1920×1080, and the first-launch tutorial - [RECOMP_BOOT_TO_UI.md](RECOMP_BOOT_TO_UI.md). The tutorial advances past aim/ZR with legible guide text, and the Move page's central 960×540 3D room renders. The tutorial→plaza boundary is under test: an idempotent patch redirects the tutorial's `5 → 6` to warp state 7, and the 21-state UI/page manager's real `4 → 5` handoff loads the Off the Hook news scene (the old table's state-5 entry is null because the transition creates a new page manager). The earlier `4 → 7` detour reached the gear-selection screen and stalled at null state 9; it is a diagnostic, not the plaza path. The 3D plaza is still unconfirmed; the news scene and its two hosts render in the central 960×540 viewport. About one boot in three stalls at the character→tutorial UI job transition. |

Tất cả mọi thứ bên dưới là tĩnh phân tích của nhị phân vận chuyển trừ khi một phần nói
Nếu không; tìm kiếm thời gian chạy từ cổng được dán nhãn như vậy. Cư xử chỉ là
tuyên bố nơi nào quan sát hoặc bị phân hủy.

---

## Mục tiêu

|Thuộc tính|Giá trị|
|---|---|
|Module| `exefs/main` (23,717,627 bytes) |
|Ngăn chứa|**NSO0** (không phải là ELF trên đĩa)|
|Kiến trúc|Aarch64, 64 bit-endian|
|ID tiêu đề| `01003bc0000a0000` |
|ACID| `Is Retail: 1` |
|Tạo ID| `F18FF3CFCBAD0884D72ABBEB6C540D6B00000000000000000000000000000000` |
|chồng sợi chính| `0x100000` |
|Ưu tiên chỉ chính|44 (CID cho phép phạm vi 28–59)|
|Anh chị em ruột| `main.npdm`, `rtld`, `sdk`, `subsdk0`–`subsdk3` |
|Cơ sở ảnh (như được nạp)| `0x7100000000` |

### Xác nhận đây là Slaptoon 2

Resource names recovered from `.rodata` are conclusive:

```
WeaponInfo_%s.byml      GearInfo_%s.byml        UdemaeGrade.byml
TankInfo.byml           SkillInfo.byml          BrandInfo.byml
BottomInfo.byml         HairInfo.byml           PaintResTex.byml
PlayerRank.byml         EnemyInfo.byml          DamageRateInfo.byml
MapInfo.byml            NpcInfo.byml            ActorDb.byml
WorldHotaruTalkInfo.byml                        WorldHotaruFreeTalkInfo.byml
```

Bản đồ vận chuyển như **MakoMart** mang theo bí danh nội bộ **Bitz** —
`Map/Blitz.mutre.szs` — independently corroborated by a `BlitzViewer` symbol
Không gian tên trong nhị phân.

---

## Name

`main` is an NSO0 container: the sections are LZ4-compressed and packed
Quay trở lại trên đĩa, nhưng mỗi phần của *mory* bù đắp được in trang-a dấu.
Khoảng trống là chi tiết quan trọng nhất khi tái tạo lại hình ảnh.

|Phần|Phạm vi bộ nhớ|Cỡ|
|---|---|---|
| `.text` | `0x0000000` – `0x1415068` | 21,045,608 |
| `.rodata` | `0x1416000` – `0x2d624b3` | 26,526,899 |
| `.rwdata` | `0x2d63000` – `0x2fdb1b0` | 2,589,104 |
| `.bss` | `0x2fdc000` – `0x3699e50` | 7,065,504 |

### MOD0

The module header `MOD0` sits at **`.text+0x8`**. Per the
[SwitchBrew MOD specification](https://switchbrew.org/wiki/MOD) it is a
replacement for `PT_DYNAMIC` and **contains no entry point**:

|Hiệu|Tìm kiếm|Xây dựng này|
|---|---|---|
|0x0| Signature `"MOD0"` | `4d4f4430` |
|0x4| `DynamicOffset` | `0x2f9a468` |
|0x8| `BssStartOffset` | `0x2fdbff8` |
|0xC| `BssEndOffset` | `0x3698f98` |
|0x10| `ExceptionInfoStartOffset` | `0x2921ec0` |
|0x14| `ExceptionInfoEndOffset` | `0x2a00eac` |
|0x18| `ModuleOffset` (runtime-generated, ≈ `.bss` base) | `0x2fdbff8` |

> ** Sửa đổi.**Một bản sửa đổi trước đây của trình duyệt này ReadME bắt nguồn từ một VA " đăng nhập" từ
> `entryTarget + entryOffset` using offsets `0x10`/`0x14`. Those fields are
> Siêu dữ liệu ngoại lệ. Không có điểm mục nhập trong MOD0; mô- đun là
> vào qua phần năng động.
> Cho chuỗi khởi động thật.

The dynamic section (VA `0x2f9a470`) carries the boot-relevant pointers:

```
DT_INIT          = 0x24
DT_FINI          = 0x160
DT_INIT_ARRAY    = 0x2fd7f90      1604 static constructors
DT_INIT_ARRAYSZ  = 0x3220
```

### Một ghi chú trên một trường dẫn đầu NSO

The 32-bit field at NSO header offset `0x40` is **reserved**. It is not a `.bss`
address, and it must not be read as one — in this container it holds the `.data`
section's compressed size. Treating it as an address produces a `.bss` that
overlaps `.rwdata`. `.bss` follows the last initialised section in memory.

---

## Quan sát kiến trúc

`.text` holds 5,264,410 instructions. Instruction census:

|Bộ mã|Số lượng|Nghĩa là|
|---|---|---|
| `STP x29,x30,[sp,#-N]!` | 7,316 |phần mở đầu hàm (từ dưới đến hàm)|
| `STP x29,x30,[sp,#N]` | 60,453 |Các cửa hàng đã lưu|
| `B` (`0x14......`) | 114,236 |Chi nhánh vô điều kiện|
| `PACIBSP` / `AUTIBSP` | **0** |không có xác thực con trỏ|
| `BTI c` | **0** |không nhận diện mục tiêu chi nhánh|

The first instruction at VA `0x100` is `stp x29,x30,[sp,#-0x10]!`, a textbook
prologue confirming `.text` begins with code.

> **Inference.** Xác thực điểm và BTI là những dấu chấm thập phân được giới thiệu bởi
> Nintendo sau này là SDK, sự vắng mặt hoàn toàn phù hợp với một công trình xây dựng từ
> Công cụ phóng từ thế kỷ 2017 đây là một suy luận từ sự vắng mặt chỉ dẫn,
> Không phải là quan sát dây cung.

---

## sơ đồ bộ nhớ

Được tái tạo bởi một tải phân tích của mô-đun (18 khối):

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

** Mô- đun chưa được gỡ bỏ.** Bảng biểu tượng động ELF còn lại:
3.5 MB of `.dynsym` and 8.8 MB of `.dynstr`. This is the single most valuable
Thuộc tính của mục tiêu này — phân tích bắt đầu từ 113, 150 tên hàm số thực thay thế
than `FUN_xxxxxxxx`.

---

## Phân hủy hệ thống con

113, 150 chức năng trên 55 không gian tên cấp cao.

|Miền tên|Hàm|Giải thích|
|---|---:|---|
| `Game` | 28,439 |Trò chơi lõi|
| `nn` | 15,953 |NintendoSDK|
| `Lp` | 10,672 |Lớp khung trò chơi|
| `Cmn` | 4,447 |Mã trò chơi chung|
| `sead` | 4,022 |@ info: status|
| `agl` | 2,852 |Đồ hoạ|
| `aal` | 2,264 |Tiểu dụng SIK/UI|
| `gsys` | 2,099 |Lớp trò chơi|
| `Cui` | 1,815 |Thành phần giao diện người dùng SDK|
| `eui` | 803 |Giao diện người dùng mở rộng cho SDK|
| `Lobby` | 792 |Hành lang trực tuyến|
| `enl` | 717 | — |
| `Cnet` | 590 |mạng|
| `Match` | 555 |Ngày mai|
| `xlink2` | 548 |Phần mềm giữa âm thanh/ hiệu ứng|
| `Shop` | 509 |Cửa hàng trò chơi|
| `pead` | 490 |âm thanh|
| `UICheck` | 413 |Hợp lệ UI|
| `MiniGame` | 184 | — |
| `PlayerMake` | 132 |Tạo ký tự|
| `Cstm` | 121 |Tùy chỉnh|
| `DbgSetting` | 120 |Thiết lập gỡ lỗi|
| `PlayerViewer` | 86 |Trình xem lỗi|

Plus 33,692 `_Z`-mangled functions (operators, thunks, templates) and 327 plain-C
chức năng.

### Hiện diện trong các công trình xây dựng bán lẻ

Thiết bị gỡ lỗi và thử nghiệm tồn tại trong hệ nhị phân vận chuyển:

```
DbgSetting 120   PlayerViewer 86   UdgwTest 66      NisdTest 33
EnemyObjViewer 28   ScheduleViewer 27   YmgcTest 25   JintTest 21
GearUnsetupTest 20  BlitzViewer 9   GndColTest 7      MrmtTest 3
```

### Máy và phần mềm trung gian

|Thành phần|Bằng chứng|
|---|---|
|**Rawed**| `sead::CalculateTask` (calculate/draw task graph), `ExpHeap`, `CriticalSection`, `SafeStringBase`, `Matrix34f`, `TreeNode`, `Path::getExt` |
|**agl**| 2,852 functions, 6,024 `.rodata` hits |
|**Radiance**| `Etc/BRDFFitting/ggx_ltc.byml` (GGX LTC BRDF fitting) |
|**NintendoWare / Nw4f**| 35 `.rodata` hits |
| `nn::nex` |Mạng Nintendo|
| `nn::bcat` |Bộ nhớ tạm giao hàng (bộ đệm mặt sau)|
| `nn::aoc` |Thêm nội dung|
| `nn::nfp` | Amiibo (`Cmn::Def::isSupportedAmiibo`) |
|Comment|24 chức năng / 36 ký hiệu HTTP|
|**wslay**|53 chức năng — Ổ cắm Mạng|
|zlib|49 hàm số / 63 ký hiệu|
| libc++ (`std::__1`) |292 chức năng|
| `__nnmusl` |Nintendo's musl-detive libc|

The libcurl + wslay + `Cnet`/`Match`/`Lobby`/`Shop` combination is consistent with
Một công trình kiến trúc trực tiếp.

---

## Đường ống nội dung

Resource paths recovered from `.rodata`:

```
Model/%s.Nin_NX_NVN.szs      NX NVN (NVIDIA) model container
Map/%s.szs                   Map/Blitz.mutre.szs
Env/%s.szs                   Etc/LightCtrl/%s.byml
Nin_NX_NVN.release.szs       Etc/BRDFFitting/ggx_ltc.byml
HapTexture.bfres             PanelTexture.bfres        IconTexture.bfres
```

Một chuỗi rò rỉ các công cụ xây dựng bên trong:

```
File = %%AGL_ROOT%%/tools/bat/convertTempTexture.bat, NoWindow = True,
WindowStyle = Hidden, WaitEnd = True, Arg = %%AGL_ROOT%%/tools/temporary/temp_proj_light.bfres
```

`.mutre` is a distinct map variant format from `.szs`.

---

## Name

### Những người được chọn

- **Ghidra 12.1.2** (phần mở rộng bên dưới khớp phiên bản này)
- **JDK 21+** — `JAVA_HOME` must point at the JDK root
- **[SwitchLoader](https://github.com/Adubbz/Ghidra-Switch-Loader)** — Ghidra
  Bộ tải cho định dạng chuyển đổi Nintendo. Cung cấp cả hai thư mục NSO và ELF
  `.dynsym` recovery used here.
- **Hactool** — để trích xuất ExeFS từ phần XCI và decompress NSO
- **Node.js 18+** for the scripts in `tools/`
- **Python 3** Thông qua PyGhidra's nếu bạn muốn xuất khẩu hàng tồn có kịch bản

### Môi trường

```powershell
$env:GHIDRA_INSTALL_DIR = 'C:\path\to\ghidra_12.1.2_PUBLIC'
$env:JAVA_HOME          = 'C:\Program Files\Java\jdk-21.0.12'
```

Cài đặt bộ chuyển đổi qua tập tin * của Ghidra cài đặt phần mở rộng... *, sau đó khởi chạy lại
Ghidra.
Thư mục mở rộng — Ghidra hủy bỏ cùng
`Multiple modules collided with same name`.

### Rút ra mục tiêu

```powershell
hactool -t xci --exefsdir=exefs "Splatoon 2 USA.xci"
hactool -t nso exefs/main --uncompressed=main.decompressed
```

Chìa khóa được yêu cầu cho XCI nhưng ** không phải là một phần của kho này** và phải
Không bao giờ cam kết.

---

## Sinh sản

### 1. Xuất khẩu các biểu tượng

PyGhidra phải được khởi chạy một cách rõ ràng, nếu không thì các văn lệnh Python sẽ thất bại với
*"Ghidra không bắt đầu với PyGhidra"*:

```powershell
& "$env:GHIDRA_INSTALL_DIR\support\pyghidraRun.bat" -H `
    "<project-dir>" Sp2 `
    -import "exefs\main" `
    -noanalysis `
    -scriptPath "<repo>\tools\ghidra" `
    -postScript ExportInventory.py "<repo>\inventory.txt" `
    -deleteProject
```

Mong đợi:

```
ExportInventory wrote inventory.txt (functions=113150 symbols=148138 strings=146621)
```

An import-only pass (`-noanalysis`) is deliberate: the ELF symbol table gives the
Tên hàm mà không trả tiền cho phân tích. Hàm *sizes* từ đèo này là
giữ chỗ và không được giải thích là kích cỡ mã.

### Phân tích hàng tồn kho

```bash
node tools/static/analyze-inventory.mjs inventory.txt
node tools/static/namespace-report.mjs   inventory.txt
node tools/static/subsystem-map.mjs      inventory.txt subsystem-map.txt
node tools/static/symbol-census.mjs      main.decompressed
node tools/static/check-prologue.mjs     main.decompressed
```

### 3. Vật chứa tooling

`tools/nso/nso2elf.mjs` rebuilds a loadable ELF64 from a decompressed NSO. It
tồn tại cho các động cơ phân tích mà không có hỗ trợ NSO; Ghidra với Skloader làm
Không cần đâu.

```bash
node tools/nso/nso2elf.mjs main.decompressed main.elf
node tools/nso/validate-elf.mjs main.elf      # structural self-check
node tools/nso/mod0-exports.mjs main.decompressed
```

`validate-elf.mjs` checks the ELF header, the `p_vaddr ≡ p_offset (mod align)`
segment rule, segment/section overlap, and `.bss` placement. It was written after
4 lỗi bố trí thật được tìm thấy bằng tay.

---

## Hạn chế

Đây là những khoảng trống chân thật, không được giải quyết, không được đọc đầy đủ các bảng trên
Tài khoản nhị phân.

1. **Không có bộ phận chức năng nào bị phân hủy.** Bản kiểm kê là chỉ có cấp độ biểu tượng.
   Do đó, không có tuyên bố về hành vi thời gian chạy được thực hiện bất cứ nơi nào trong này
   Kho hàng.

2. ** Trình phân tích tự động không hoàn tất.** Bộ phân tích không đầu của Ghidra
   Vô cùng kinh ngạc. 22 chức năng lặp lại thông qua tính toán nhảy có mục tiêu rơi
   bên ngoài ảnh; bản ghi sau đó tiến bộ chỉ ~99 byte mỗi 3 phút:

   ```
   WARN Decompiling 710090ab30: Unable to read bytes at ram:23504cd0fec
   ```

   Đây là decomiler theo sau một bước nhảy tính toán, không phải là một khuyết điểm trong các
   Đang chạy phân tích trong giao diện người dùng đồ hoạ **Ghidra, có thể là
   lái xe ngày càng nhiều, là cách đề nghị vượt qua nó.

3. **REA không thể lái mục tiêu này trên Windows.** Bộ thích nghi REA 6.5.0 Ghidra
   Chỉ thừa nhận x86/x86-64 và được chọn rõ ràng 602 ảnh thô:

   > "Ghidra P0 chấp nhận bản địa x86 và x86-64 các ứng dụng PE và DLs,
   > và rõ ràng chọn thô 602 ảnh"

   Both an ELF and a headerless `--architecture arm64` attempt are rejected with
   `target_format_unsupported`. Hopper is macOS-only and IDA was unregistered.
   Các Ghidra tự lắp đặt mình làm tàu Aarch64, do đó, đây là một thích nghi viên
   Hạn chế, không phải mô-đun xử lý còn thiếu.

4. **MOD0 phân loại có khả năng xuất khẩu không được giải quyết.** Hai trường ứng cử viên bố trí cho
   Kết quả mâu thuẫn (một bù đắp tiêu cực, một trong quá khứ EOF), vì vậy không có chức năng
   Tên trong kho này được lấy từ bảng MOD0. Những tên đến từ
   the ELF `.dynsym` via SwitchLoader.

5. ** Chỉ dùng dấu chấm phẩy không gian (không gian) mới có đầu đề biểu tượng.** nhãn vùng tên
   Hãy miêu tả một biểu tượng được công bố ở đâu, chứ không phải những gì đoạn mã làm.

---

## Hợp thức

Kho này chứa **no game code, không dữ liệu trò chơi, và không mã hóa
phím** — chỉ phân tích ghi chú và dán gốc. Slaptoon 2 và Nintendo
Công cụ chuyển đổi là nhãn hiệu của Nintendo.
Hướng tới nghiên cứu và bảo tồn khả năng tương tác; sử dụng hợp pháp của riêng bạn
Nhận được bản sao của trò chơi.

## Giấy phép

Bản gốc và ghi chú trong kho này được phát hành dưới giấy phép MIT.
Thấy chưa?
