# Cột mốc: boot tới menu chính (chỉ offline, chỉ single-player)

[English](BOOT_MILESTONE.md)

Mục tiêu hẹp nhất mà vẫn hữu ích: chạy `main` gốc trên PC và tới được màn hình
tiêu đề, chưa cần gameplay phía sau.

Tài liệu này định nghĩa chính xác cột mốc đó, xác định bộ máy khởi động, và nêu
chiến lược khiến nó trở nên khả thi.

---

## 1. Đính chính các giả định trước đó của dự án

Các ghi chú trước đây coi MOD0 là có chứa entry point và suy ra "entry VA" từ
`+0x10 + +0x14`. **Điều đó sai.** Theo
[đặc tả MOD của SwitchBrew](https://switchbrew.org/wiki/MOD), header module
****không** chứa entry point**:

| Offset | Trường | Bản build này |
|---|---|---|
| 0x0 | Signature `"MOD0"` | `4d4f4430` |
| 0x4 | `DynamicOffset` | `0x2f9a468` |
| 0x8 | `BssStartOffset` | `0x2fdbff8` |
| 0xC | `BssEndOffset` | `0x3698f98` |
| 0x10 | `ExceptionInfoStartOffset` | `0x2921ec0` |
| 0x14 | `ExceptionInfoEndOffset` | `0x2a00eac` |
| 0x18 | `ModuleOffset` (sinh lúc runtime, ≈ base của `.bss`) | `0x2fdbff8` |

Vậy `+0x10`/`+0x14` là **metadata xử lý ngoại lệ**, không phải entry, và `+0x18`
là đối tượng module trong `.bss` — nhất quán với `BssStartOffset` và với base
`.bss` đã tính được là `0x2fdc000`. MOD0 thay thế cho `PT_DYNAMIC`, không phải
điểm vào của chương trình.

Bất kỳ tài liệu nào trong kho này trích dẫn "MOD0 entry point" đều nên bị bỏ qua.
[README](README.md) đã được sửa lại cho đúng.

---

## 2. Module này thực sự khởi động như thế nào

Hai cơ chế, cả hai đều có thật và đều đọc được từ binary:

**Dynamic section** (VA `0x2f9a470`, file offset `0x2f9a570`):

```
DT_INIT          = 0x24
DT_FINI          = 0x160
DT_INIT_ARRAY    = 0x2fd7f90
DT_INIT_ARRAYSZ  = 0x3220      → 1604 constructor entries
DT_SYMTAB        = 0x1c2e7e0
DT_STRTAB        = 0x1f899c8
DT_RELA          = 0x1416048
DT_JMPREL        = 0x19ec6a8
```

1604 static constructor chạy trước mọi thứ khác. Không cái nào trong số đó phân
giải được thành một symbol có tên, và điều đó là bình thường — chúng là các
initialiser cục bộ do compiler sinh ra.

**Trình tự khởi động của framework**, phục hồi từ bảng symbol (`Lp::Sys`):

| Địa chỉ | Symbol | Vai trò |
|---|---|---|
| `0x71011f5b20` | `Lp::Sys::SysInit::Init` | entry của framework |
| `0x71011f5ab4` | `Lp::Sys::SysInit::nninitStartup` | khởi động SDK |
| `0x71011f603c` | `Lp::Sys::SysInit::printFromStartTime` | đo thời gian khởi động |
| `0x71011fca28` | `Lp::Sys::RootTask::parallelInitThreadFunc` | init song song |
| `0x71011fcb44` | `Lp::Sys::RootTask::runParallelInitThread` | init song song |
| `0x71011fcba4` | `Lp::Sys::RootTask::waitDoneParallelInitThread` | chờ init xong |
| `0x7100053a8c` | `Lp::Sys::Scene::sceneCalc` | cập nhật mỗi frame |
| `0x7100096838` | `Lp::Sys::CalcInGSysCalc` | điều phối pass calc |

`Lp::Sys::SysInit::Init` là entry thực tế cho việc port, và
`RootTask::parallelInitThreadFunc` là điểm phân nhánh nơi framework khởi tạo các
subsystem **đồng thời**. `sead::JobQueue::run` (`0x7100096a34`) là nền tảng của
việc điều phối đó.

Lưu ý framework khởi động nằm trong module **`sdk`**, không phải `main` — nên
`sdk` không phải là phần phụ tùy chọn. Nó nằm trên đường tới frame đầu tiên.

---

## 3. Chiến lược: patch, đừng viết lại

Đây là quyết định quan trọng nhất, và nó biến cột mốc từ khổng lồ thành có giới hạn.

Có hai cách để chạy một binary ARM64 của Switch trên PC x86-64:

**(a) Decompile toàn bộ + biên dịch lại.** Dựng lại cả 113.150 hàm bằng C++, biên
dịch native. Đây là kiểu dự án decompile kinh điển, và là nỗ lực nhiều năm, nhiều
người được mô tả trong [PORTING.md](PORTING.md). Nó **không** phải điều kiện tiên
quyết để boot.

**(b) Dịch binary kèm thay thế dần dần.** Giữ nguyên binary `main` gốc và thực thi
nó, đồng thời thay thế tầng platform bên dưới. Mỗi hàm được viết lại sẽ thay thế
một slot dispatcher; hơn 100.000 hàm còn lại chạy nguyên vẹn. Đây chính là cách
một số bản port PC thương mại đã được làm ra.

**Với mục tiêu "boot tới menu" và single-player, (b) là con đường đúng.** Dưới
chiến lược đó, cột mốc không còn là "viết lại game" — mà là:

> viết lại các hàm platform `nn::` cho tới khi binary thôi đòi phần cứng Nintendo.

Đó là một mục tiêu có giới hạn và đếm được: khoảng **4.070 hàm platform** trải
trên các namespace `nn::`, trong đó chỉ tập con mà boot chạm tới là quan trọng cho
cột mốc này. Các đường `DummyMatch` / `DummyLocalMatch` / `LobbyForShow` tìm thấy
trước đó là bằng chứng rằng game vốn đã chịu được các subsystem được mô phỏng —
rất phù hợp với cách tiếp cận (b).

---

## 4. Tập phụ thuộc tối thiểu để boot

Để tới được màn hình tiêu đề, những thứ sau phải chạy được. Chưa cần gì khác.

| Thứ tự | Subsystem | Số hàm | Vì sao cần để boot |
|---:|---|---:|---|
| 1 | `nn::os` | 159 | thread, mutex, event, TLS, semaphore — framework dùng đa luồng |
| 2 | `nn::mem` | 17 | heap cho `.bss` 7 MB và cho mọi cấp phát |
| 3 | `nn::oe` | 36 | vòng đời ứng dụng; `nn::oe::Initialize`, `FinishStartupLogo` |
| 4 | `nn::fs` | 44 | mount romfs; không có nó thì không nạp được gì |
| 5 | `nn::vi` / `nn::nvn` | — | hiển thị và trình bày hình |
| 6 | `nn::gfx` | 289 | graphics device, memory pool, command buffer |
| 7 | `nn::g3d` | 292 | renderer 3D mà scene tiêu đề sẽ dùng |
| 8 | `nn::ui2d` | 476 | renderer 2D cho layout menu |
| 9 | `nn::atk` | 1.426 | bộ công cụ UI — tiêu đề, menu, nút |
| 10 | `nn::font` | 230 | chữ trong menu |
| 11 | `nn::hid` | 112 | tối thiểu là "press start" |
| 12 | `nn::audio` | 182 | một số game chặn boot ở bước init âm thanh |

Hai khối lớn nhất là `nn::atk` (1.426) và `nn::ui2d` (476) — hệ thống menu là phụ
thuộc boot lớn nhất. Tiếp theo là `nn::gfx` + `nn::g3d`.

Điều đáng yên tâm là **`nn::nex` (6.815) và `nn::pia` (4.687) không nằm trong danh
sách này.** Toàn bộ stack online có thể bị stub mà boot vẫn tiếp tục. Đó chính là
phần thưởng của quyết định chỉ làm offline.

---

## 5. Các bước thực hiện đầu tiên được đề xuất

1. **Đưa `Lp::Sys::SysInit::Init` vào debugger.** Việc boot có tiến được hay không
   hoàn toàn trả lời được bằng cách xem nó gọi vào code platform chưa được viết ở
   đâu. Mọi chỗ chưa biết nhận một implementation `stub → log → return 0`.
2. **Viết `nn::os` trước.** Framework dùng đa luồng từ rất sớm; nếu không có thread
   và event hoạt động, binary sẽ **treo** thay vì lỗi rõ ràng. Đây là nơi stub phải
   là thật, không được là `return 0`.
3. **Stub thật ồn ào, đừng stub im lặng.** Mọi hàm platform chưa viết nên ghi log
   tên đã demangle của nó. Log boot sau đó trở thành hàng đợi công việc, theo đúng
   thứ tự phụ thuộc — đó là cách dự án kiểu này thường được thúc đẩy.
4. **Hãy chờ bức tường đầu tiên ở `nn::fs` / romfs.** Màn hình tiêu đề cần layout
   và font từ `romfs`. Việc trích xuất và một shim filesystem native là công việc
   sớm.
5. **Đừng bắt đầu bằng `nn::atk`.** Nó là phụ thuộc lớn nhất nhưng lại được chạm
   tới muộn; viết nó trước khi có graphics device thì không có gì để vẽ lên.

## 6. Những gì cột mốc này chủ động loại trừ

- Không gameplay, không player, không cơ chế mực.
- Không online, không ghép trận, không lobby — đều bị stub.
- Không Salmon Run, không Turf War.
- Không save data, không Amiibo, không chụp màn hình.

## 7. Đánh giá thẳng thắn

Ngay cả khi đã thu hẹp xuống "boot tới menu", đây vẫn là một dự án đáng kể: đường
tới đích chạy qua tầng OS, filesystem, graphics device, các renderer 2D/3D, và một
bộ công cụ UI 1.426 hàm. Đó là **nhiều tháng**, **không phải vài ngày**.

Lý do khiến nó đáng để thử là vì mục tiêu này **có giới hạn và quan sát được**.
Khác với "port cả game", "tới được màn hình tiêu đề" chỉ có **một** điều kiện thành
công nhị phân, và log boot cho bạn biết chính xác cần viết gì tiếp theo. Dưới chiến
lược patch-don't-rewrite, con đường đó ****không** đòi hỏi phải decompile 113.150 hàm
trước**.
