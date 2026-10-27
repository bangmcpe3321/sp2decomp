# Di chuyển đánh giá và đồ thị đường

Scope analysis for bringing **Splatoon 2** (title `01003bc0000a0000`) to PC, built
từ phân tích biểu tượng và hệ thống con trong kho này.

Đọc nó như là một tài liệu khả thi và trình tự, không phải một lời hứa.
phiên bản là trong [Bottom line] (# end-line).

---

## 1. những gì đang được chuyển đi

|Thành phần|Cỡ|Hàm|
|---|---|---|
| `main` |23,162 KB| 113,150 |
| `sdk` |2.962 KB|chưa phát minh ra|
| `subsdk0` |769 KB|chưa phát minh ra|
| `subsdk1` |KB 66|chưa phát minh ra|
| `subsdk2` |48 KB|chưa phát minh ra|
| `subsdk3` |170 KB|chưa phát minh ra|
| `rtld` |13 KB| — |
| `romfs` |5.390 tập tin, 17 hệ thống con| — |

Architecture is AArch64. `main` alone is 113,150 functions, and its `.text` is
21,045.608 byte.

### Sự thật quyết định

Counting the platform and middleware surface inside `main`:

|Hệ thống con|Hàm|Mang theo được không?|
|---|---:|---|
| `nn::nex` — matchmaking, rankings, protocol framework | 6,815 |**No** - bên máy chủ|
| `nn::pia` — peer-to-peer session layer | 4,687 |**No** — Cơ sở hạ tầng Nintendo|
| `nn::atk` — UI toolkit | 1,426 |Phải.|
| `nn::ui2d` | 476 |Phải.|
| `nn::vfx` — effects | 396 |Phải.|
| `nn::g3d` / `nn::gfx` — rendering | 292 / 289 |Đúng vậy.|
| `nn::font` | 230 |Vâng (bản đồ đến FreeType/HefBuzz)|
| `nn::audio` | 182 |Vâng (bản đồ đến miniaudio/ Ex openAL)|
| `nn::os` | 159 |Có ( Sơ đồ tới cột/ thô sơOS)|
| `nn::hid` — input | 112 |Vâng (bản đồ đến SDL)|
| `nn::sf`, `nn::socket`, `nn::ldn` | 189 |Một phần|
| `nn::fs` | 44 |Phải.|
| `nn::nfp` — Amiibo | 40 |Cần thay thế phần cứng|
| `nn::account`, `nn::friends`, `nn::bcat`, `nn::capsrv` | ~148 |Thiết kế lại|

**`nn::nex` + `nn::pia` are 11,502 functions — roughly 10% of the entire codebase
Họ là khách hàng của các dịch vụ trực tuyến của Nintendo và
Cơ sở hạ tầng đồng đẳng.
Đó là điều chỉnh lại dự án: những gì được công bố là trò chơi,
Và những gì được viết ra là một chồng mạng lưới mới.

---

## 2. Hệ thống trò chơi (từ không gian tên biểu tượng)

Những số này là các chức năng có biểu tượng sống trong không gian tên tương ứng.
Đo bề mặt ADI, không khó.

### Chế độ đa người chơi

|Hệ thống|Hàm|Ghi chú|
|---|---:|---|
| `Game::Coop` | 2,995 |Name|
| `Game::Cmp` | 1,641 |cạnh tranh với|

### Bộ phát

|Hệ thống|Hàm|
|---|---:|
| `Game::Player` | 542 |
| `Game::PlayerInkAction` | 209 |
| `Game::PlayerEffect` | 87 |
| `Game::PlayerNetControl` | 78 |
| `Game::PlayerCloneHandle` | 105 |
| `Game::PlayerMake` | 132 |
| `Game::PlayerViewer` | 86 |

### Các ông chủ chạy máy (tên mã nội bộ)

|Hạng|Hàm|Tên đã được đóng gói (trích dẫn)|
|---|---:|---|
| `Game::EnemyLastKing` (+`Punch`) | 221 + 114 |Vua Sanh- môn|
| `Game::EnemyHangedKing` / `EnemyHangKing` | 164 / 99 | — |
| `Game::EnemyRollerKing` (+`Test`) | 139 + 110 | — |
| `Game::EnemyStampKing2` / `EnemyStampKingDeco` | 124 / 149 | — |
| `Game::EnemyBakeryKing` | 141 | — |
| `Game::EnemyGelidiumKing` (+`_Mark2`, `_Mark4`) | 103 / 98 / 119 | — |
| `Game::EnemyTakolienMovable`, `EnemyTakopter`, `EnemyTakodozer` | 74 / 73 / 70 | — |

Bản đồ tên mã là ** chưa được thiết lập** và không nên
giả sử; đây là những nhãn vùng tên.

### Khớp dòng và mục tiêu

`Game::SeqMgrWorld` (146), `Game::SeqMgrMission` (104),
`Game::SeqPlazaVender` (123), `Game::SeqPlazaAmiibo` (99),
`Game::PageHandlerVersus` (113), `Game::PageHandlerPlaza` (86),
`Game::PageHandlerMission` (84), `Game::PageHandlerCoop` (81),
`Game::Gachihoko` (107, Tower Control), `Game::InkRail` / `InkRailVersus`
(90 / 93), `Game::VictoryLift` (78), `Game::BulletMgr` (115).

### Lớp làm việc khung

`Lp::Sys` (4,676), `Lp::UI` (3,282), `Lp::Utl` (1,902), `Lp::Net` (812),
`Game::Utl` (426), `Cmn` (4,447), `gsys` (2,099).

### Phần giữa của bên thứ ba

|Thành phần|Hàm|Cổng|
|---|---:|---|
| `xlink2` (audio/effect linking) | 1,075 |Phải, nhưng độc quyền-adjacent|
| `sead` (Nintendo C++ library) | 4,022 |Sự hồi sinh cộng đồng đã tồn tại|
| `agl` (Nintendo graphics) | 2,852 |Tăng cường|
|Comment| 24 |Thả vào|
|wslay (WebSet)| 53 |Thả vào|
|zlib| 49 |Thả vào|
|libc++| 292 |Thả vào|

---

## Phạm vi 3. chỉ ngoại tuyến

** dự án này mục tiêu ngoại tuyến.** Quyết định đó loại bỏ các lớn nhất
Thành phần không thể truy cập và được phản ánh trong suốt tài liệu này.

Measured against the 113,150 functions in `main`:

|Bộ cánh|Hàm|Chia sẻ|
|---|---:|---:|
|**Chỉ trên dòng — chấm, thay thế, hoặc thả**| **15,485** | **13.7%** |
|Nền tảng API — Phục hồi trên máy tính| 4,070 | 3.6% |
| Engine / middleware (`sead`, `agl`, `xlink2`) | 8,629 | 7.6% |
| Framework / UI (`Lp`, `Cui`, `eui`, `aal`, `gsys`, `Cmn`) | 21,701 | 19.2% |
|Chơi trò chơi ngoại tuyến| 6,454 | 5.7% |
|Không được phân phối bởi tiền tố biểu tượng| 56,811 | 50.2% |

The 13.7% matches the earlier `nex` + `pia` estimate and is now bounded by the
toàn bộ bề mặt trực tuyến.

> **Cavhaat.** Cái xô 50.2% "nattributed" là một giới hạn của tiêu chuẩn biểu tượng
> Nhận diện, ** không** một thước đo mã không xác định. Nhiều mục nhập là biểu tượng cục bộ
> những người điều hành và những người có tên không gian mà quy tắc tiền tố không thể phục hồi.
> Giải quyết trước khi có thể xử lý chính xác.

### Cái gì bị cắt?

|Bề mặt|Hàm|
|---|---:|
| `nn::nex` — online service | 6,815 |
| `nn::pia` — P2P session layer | 4,687 |
| `Lp::Net` — game network layer | 812 |
| `Lobby` — online lobby | 792 |
| `Cnet` — network transport | 590 |
| `Match` — matchmaking | 555 |
| `Shop` — online shop | 509 |
| `Game::PageHandlerVersus` — versus match UI | 113 |
| `Game::PageHandlerCoop` — Salmon Run match UI | 81 |
| `Game::PlayerNetControl` — network sync | 78 |
| `Game::SeqMgr*Versus/Coop` — online match sequences | 74 |
| `Game::MissilePositionOnline` | 68 |
| `nn::socket` | 62 |
| `nn::ldn` — local wireless | 50 |
| `nn::web`, `nn::account`, `nn::friends` | 128 |

### Lợi thế kiến trúc chính: việc thực hiện giả đã tồn tại

Hệ nhị phân đã có tàu **offline đường dẫn mô phỏng hệ thống mạng**:

```
DummyMatch            18
DummyLocalMatch       17
LobbyForShow          18
LobbyForShow / Show    —   offline lobby presentation
Boot                  19
```

`DummyMatch` and `DummyLocalMatch` strongly suggest the game already has a
local/offline match harness alongside the networked one, and `LobbyForShow`
hàm ý hành lang UI làm việc mà không cần dịch vụ trực tiếp.
Xây dựng trên** — một cổng ngoại tuyến có thể điều khiển con đường ẩn trực tiếp
Xác nhận đây là nghiên cứu đầu tiên giá trị nhất.
nhiệm vụ cho mục tiêu ngoại tuyến.

### Cái gì phải tiếp tục hoạt động?

|Bề mặt|Hàm|Nội dung|
|---|---:|---|
| `Game::SeqMgrMission` | 104 |Chuỗi nhiệm vụ riêng người chơi (Octo Canyon)|
| `Game::PageHandlerMission` | 84 |Nhiệm vụ UI|
| `Game::SeqMgrWorld` | 146 |dãy thế giới/hub|
| `Game::PageHandlerPlaza` | 86 |Trung tâm quảng trường UI|
| `Game::Player` + `PlayerInkAction` + `PlayerEffect` | 838 |người chơi và kỹ thuật mực|
| `Game::BulletMgr` | 115 |Đạn|
| `Game::Enemy*` |40+ hạng|kẻ thù Al (single- player và Salmon Run)|
| `Game::Utl` | 426 |Tiện ích chơi trò chơi|
| `MiniGame` | 184 |Trò chơi nhỏ cục bộ|
| `Game::DbgSetting` | 120 |tuỳ chọn/ debug|

### Ý nghĩa nội dung

- **Single- Player (Octo Canyon) hoàn toàn không hoạt động** — không cần thiết thiết thiết thiết kế lại.
- **Salmon Run và Turf War / Ranked được quản lý máy chủ trong trò chơi bán lẻ.** Với
  the online layer removed they must be driven either through the `Dummy*` paths
  hoặc thông qua robot và trò chơi cục bộ. Salmon Run là hợp lý; quy mô lớn Turf
  Chiến tranh là vấn đề thiết kế chứ không phải vấn đề vận chuyển.
- Amiibo (`nn::nfp`, 40) has no PC equivalent and needs a data-file substitute.
- `nn::bcat` (36) delivered content in the background; with no service, formerly
  phải chuyển hoặc bỏ qua nội dung.

### Bộ trình bày đã sửa đổi cho khả năng ngoại tuyến

Giai đoạn 5 (theo dòng) từ kế hoạch ban đầu là **deleted**. Thứ tự trở thành:

1. **Phase 0 — Harness.** Trích dẫn và phân tích đường ống.
2. **Phase 1 — Platform layer.** `nn::gfx`/`g3d` → Vulkan, `hid` → SDL,
   `audio` → miniaudio, `fs` → std::filesystem, `font` → FreeType.
3. **Phase 2 — Engine.** `sead`, then `agl`, then `xlink2`.
4. **Phase 3 — Framework.** `Lp::Sys`, `Lp::Utl`, `Lp::UI`, `gsys`, `Cmn`.
5. **Phase 4 — Offline gameplay.** `Game::Player` + `PlayerInkAction` +
   `BulletMgr`, then single-player via `SeqMgrMission` / `PageHandlerMission`.
6. **Phase 5 — Local multiplayer.** Drive `DummyMatch` / `DummyLocalMatch`.

Loại bỏ trực tuyến cũng loại bỏ nhu cầu cho một dịch vụ hậu phương mới, đó là
Trước đây là một dự án đơn lẻ lớn nhất trong dự án.

---

## Thứ tự quan hệ phụ thuộc

Một cổng không thể được xây dựng theo thứ tự hệ thống con xuất hiện ở trên. Nó phải được xây dựng.
Từ dưới lên, bởi vì không có gì trên có thể chạy cho đến khi lớp bên dưới tạo ra khung,
âm thanh và đầu vào.

### Giai đoạn 0 — Độ độc (không mã trò chơi)

- Reproducible extraction and analysis pipeline (already in `tools/`).
- Một không gian làm việc phân tích còn tồn tại trong ngăn phân tích được ghi nhận trong
  [REDME].
- Quyết định ngôn ngữ và công cụ để tái tạo lại mã.

### Giai đoạn 1 — Lớp nền (khó khăn nhất, không thể tránh được)

Replace the `nn::` platform surface. Each is a mapping problem, not a research
vấn đề:

|Nintendo|Tương đương với PC|
|---|---|
| `nn::gfx`, `nn::g3d` (NVN on Switch) |Vulkan (gần NVN)|
| `nn::ui2d`, `nn::atk` |Chủ sở hữu UI, hay ImGui thân yêu cho đậu nành|
| `nn::audio` |miniaudio hoặc OpenAL|
| `nn::hid` |SDL2/SDL3|
| `nn::fs` |std::file system|
| `nn::font` |FreeType + HarfBuzz|
| `nn::os`, threads, events |Hệ điều hành thô sơ|

### Giai đoạn 2 — Lớp động cơ

`sead` (allocation, task graph, strings, paths, math — note `sead::CalculateTask`,
the frame calculate/draw graph) then `agl` (rendering), then `xlink2` (audio
Hiệu ứng).

`agl` is where the Switch-specific rendering assumptions concentrate. Expect this
để trở thành nhiệm vụ tái tạo duy nhất lớn nhất sau lớp nền tảng.

### Giai đoạn 3 — Nền tảng trò chơi

`Lp::Sys`, `Lp::Utl`, `Lp::UI`, then `gsys`, `Cmn`.

### Giai đoạn 4 — Chơi

`Game::Player` + `Game::PlayerInkAction` + `Game::BulletMgr` first — the ink system
is the mechanical core. Then `Game::Cmp` (versus), then `Game::Coop` (Salmon Run).

### Giai đoạn 5 — Trực tuyến (được thay thế, không phải cổng)

Thiết kế lại chống lại một hậu phương mới:

- Replace `nn::nex` matchmaking/rankings with your own service.
- Replace `nn::pia` P2P with a rollback-friendly transport, or Steam networking.
- Replace `nn::account` / `nn::friends` with platform identity.
- `nn::nfp` (Amiibo) has no PC equivalent — substitute a data file.

** Mô phỏng: cắt trực tuyến từ dấu hiệu đầu tiên.** Xây dựng trò chơi ngắt kết nối
Đầu tiên, nó loại bỏ các loài động vật có vú.
10% của mã nguồn từ v0.1 và toàn bộ phần còn lại của trò chơi vẫn hoạt động.

---

## Trình tự thực tế 5.

1. **Do not start with `main`.** Start with `subsdk1` (66 KB) or `rtld` (13 KB).
   Mục đích là để chứng minh đường ống này kết thúc bằng một cái gì đó có thể hoàn thành được.
2. **Then `sdk` (2,962 KB).** Large enough to be representative, small enough to
   Hoàn thành, sống cùng nhau ở đây.
3. **Then offline `main`**, with online stubbed.
4. ** Rồi online**, trên một hậu phương mới.

## 6, luật pháp và sự phân phối

Những hạn chế thực tế hình thành kiến trúc:

- Cảng không được vận chuyển tài sản, mật mã hay chìa khóa của Nintendo.
- Một cảng yêu cầu bản sao bỏ của người dùng cho tài sản đã được thiết lập,
  mẫu rủi ro thấp hơn (Ship of Harkinian, SM64 Port).
- Một sự tái tạo phòng sạch sẽ sạch sẽ hơn việc phân phối lại
  Nguồn gốc.
- Kho này không chứa tài sản, mật mã, hay chìa khóa, và nên giữ như thế —
  see [`.gitignore`](.gitignore).

## 7, câu cuối

**Scalle.** Để cân nhắc: Siêu Mario 64 phân rã — khoảng 10 MB
MIPS, khoảng 300k dòng C — lấy một đội phân phối * nhiều năm trước khi đến cảng PC
Splatoon 2 là **23 MB của Aarch64 với 113, 150 chức năng**.
Quyết định ngoại tuyến chỉ gỡ bỏ 13.7% mà không thể được gửi đi ở tất cả, nhưng nó
không thay đổi quy mô của phần còn lại: đây vẫn là một năm đa chiều,
Bất cứ kế hoạch nào cho rằng ngược lại là sai.

**Những gì các quyết định ngoại tuyến đã mua:**

- Khoảng 15.485 chức năng được gỡ bỏ khỏi phạm vi, bao gồm cả toàn bộ không thể cập nhật được
  chồng lên mạng.
- ** Không có dịch vụ hậu phương mới nào để xây cất** — trước đây là đơn lẻ lớn nhất.
- A plausible existing seam: `DummyMatch` / `DummyLocalMatch` / `LobbyForShow`
  gợi ý đường dẫn mô phỏng ngoại tuyến đã có trong nhị phân.

** Những gì là thực sự ưu đãi ở đây:**

- Hệ nhị phân không bị lột bỏ** — 113, 150 tên hàm số thật, bao gồm
  gameplay systems named in the clear (`PlayerInkAction::shotBullet_B`).
- The engine stack is understood and has public prior art (`sead`).
- Bản đồ nền tảng được áp dụng rất tốt; không có gì cần nghiên cứu mới.
- Octo Canyon đã ngưng hoạt động và không cần thiết kế lại.

** Cái gì là thực sự không thể thay đổi:**

- `agl` + `nn::gfx` rendering reimplementation is very large.
- 50.2% chức năng chưa phân phối bởi tiền tố biểu tượng và cần thiết đúng cách
  Phân loại trước khi phạm vi là cuối cùng.
- Thời gian phục hồi của Salmon Run và Turf Chiến tranh máy chủ được giám sát; việc lái xe họ ngoài là một
  Vấn đề thiết kế, không phải vấn đề dịch thuật.
- Không có sự khác biệt nào về danh hiệu này tồn tại để xây dựng.

**Những bước tiếp theo giá trị cao nhất:**

1. Confirm the `DummyMatch` / `DummyLocalMatch` path can drive a match without a
   Dịch vụ trực tiếp — đây là quyết định xem nhiều người chơi ngoài cuộc có rẻ hay không.
2. Giải quyết 50.2% chưa được phân phối nên các con số trong phạm vi trở nên đáng tin cậy.
3. Prove the whole pipeline on `subsdk1`, then `sdk`. Finishing a small module
   dạy nhiều hơn là bắt đầu một cuộc thi lớn.
