# Đá lê: khởi động tới trình đơn chính (điu tắt, chỉ người chơi đơn)

(Tiếng thét)

The narrowest useful target: play the original `main` on PC and reach the title
Màn hình, vẫn chưa có trò chơi đằng sau nó.

Tài liệu này xác định một cách chính xác, xác định bộ máy khởi động, và
cho biết chiến lược làm cho nó dễ uốn nắn.

---

## 1. chỉnh sửa các giả định ban đầu của dự án

Các ghi chú trước đó được xử lý MOD0 như là bao gồm một điểm nhập và bắt nguồn từ một VA nhập cảnh
from `+0x10 + +0x14`. **That was wrong.** Per the
[SwitchBrew MOD specification](https://switchbrew.org/wiki/MOD), the module header
không chứa điểm nhập:

|Hiệu|Tìm kiếm|Xây dựng này|
|---|---|---|
|0x0| Signature `"MOD0"` | `4d4f4430` |
|0x4| `DynamicOffset` | `0x2f9a468` |
|0x8| `BssStartOffset` | `0x2fdbff8` |
|0xC| `BssEndOffset` | `0x3698f98` |
|0x10| `ExceptionInfoStartOffset` | `0x2921ec0` |
|0x14| `ExceptionInfoEndOffset` | `0x2a00eac` |
|0x18| `ModuleOffset` (runtime-generated, ≈ `.bss` base) | `0x2fdbff8` |

So `+0x10`/`+0x14` is **exception-handling metadata**, not an entry, and `+0x18`
is the module object in `.bss` — consistent with `BssStartOffset` and with the
computed `.bss` base `0x2fdc000`. MOD0 is a replacement for `PT_DYNAMIC`, not a
mục nhập chương trình.

Bất kỳ tài liệu nào trong rep này trích dẫn một "MD0 mục nhập" nên được bỏ qua.
Cái [README] (REDME.md) đã được chỉnh lại phù hợp.

---

## 2. Mô-đun này thực sự bắt đầu như thế nào

Hai cơ chế, vừa thật vừa có thể đọc được từ nhị phân:

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

1604 máy tạo tĩnh chạy trước khi có bất cứ điều gì khác.
Biểu tượng mà người ta mong đợi — họ là những người biên dịch tại địa phương.

**Framework startup sequence**, recovered from the symbol table (`Lp::Sys`):

|Địa chỉ|Ký hiệu|Nhiệm vụ|
|---|---|---|
| `0x71011f5b20` | `Lp::Sys::SysInit::Init` |Mục nhập khung|
| `0x71011f5ab4` | `Lp::Sys::SysInit::nninitStartup` |Chạy SDK|
| `0x71011f603c` | `Lp::Sys::SysInit::printFromStartTime` |Thời gian khởi chạy|
| `0x71011fca28` | `Lp::Sys::RootTask::parallelInitThreadFunc` |Init song song|
| `0x71011fcb44` | `Lp::Sys::RootTask::runParallelInitThread` |Init song song|
| `0x71011fcba4` | `Lp::Sys::RootTask::waitDoneParallelInitThread` |Tham gia vào nó|
| `0x7100053a8c` | `Lp::Sys::Scene::sceneCalc` |Cập nhật mỗi khung|
| `0x7100096838` | `Lp::Sys::CalcInGSysCalc` |Name|

`Lp::Sys::SysInit::Init` is the practical entry for a port, and
`RootTask::parallelInitThreadFunc` is the fan-out point where the framework
initialises subsystems concurrently. `sead::JobQueue::run` (`0x7100096a34`)
dưới sự hỗ trợ của thông điệp.

Note the boot framework lives in the **`sdk` module**, not `main` — so `sdk` is
Không phụ thuộc vào giàn giáo. Nó nằm trên đường dẫn quan trọng đến khung thứ nhất.

---

## 3. Chiến thuật: vá, đừng viết lại

Đây là quyết định quan trọng nhất, và nó thay đổi mốc quan trọng từ
rất lớn để ràng buộc.

Có hai cách để một hệ nhị phân ARM64 chạy trên x86-64 PC:

**(a) Sự phân hủy hoàn toàn + tái phối hợp.** Xây dựng lại tất cả 113, 150 chức năng trong C++,
Đây là dự án phân hủy cổ điển, và nó là nhiều năm,
Nỗ lực của nhiều người được mô tả trong [PORTING.md].
Điều kiện tiên quyết để khởi động.

**(b) Binary translation with incremental replacement.** Keep the original `main`
Chương trình nhị phân và thực hiện nó, thay thế lớp nền bên dưới nó.
Hàm bổ sung thay thế một khe bộ gửi; còn lại 100,000+ chức năng
Chạy không bị động. Đây là cách một số cổng PC thương mại thực sự được sản xuất.

** For "boot to menu" và một người chơi, (b) là con đường chính xác.** Dưới nó,
Giai đoạn quan trọng không phải là sự kết thúc cuộc chơi. Đó là:

> reimplement `nn::` platform functions until the binary stops asking for
> Phần cứng Nintendo.

Đó là một mục tiêu ràng buộc, có thể liệt kê: xấp xỉ **4,070 chức năng**
across the `nn::` namespaces, of which only the boot-reachable subset matters for
this milestone. The `DummyMatch` / `DummyLocalMatch` / `LobbyForShow` paths found
Trước đó là bằng chứng rằng trò chơi đã dung thứ cho các hệ thống con được mô phỏng, mà
phù hợp để tiếp cận (b) trực tiếp.

---

## 4. phụ thuộc nhỏ nhất khởi động

Để tới được màn hình tiêu đề, những thứ này phải hoạt động.

|Thứ tự|Hệ thống con|Hàm|Tại sao nó lại cần thiết để khởi động?|
|---:|---|---:|---|
| 1 | `nn::os` | 159 |Các sợi chỉ, dây câm, sự kiện, hệ thống định vị — khung được nối liền|
| 2 | `nn::mem` | 17 | heap for the 7 MB `.bss` and every allocation |
| 3 | `nn::oe` | 36 | application lifecycle; `nn::oe::Initialize`, `FinishStartupLogo` |
| 4 | `nn::fs` | 44 |Mount romfs, không có gì nhiều nếu không có nó|
| 5 | `nn::vi` / `nn::nvn` | — |Hiển thị và trình bày|
| 6 | `nn::gfx` | 289 |Thiết bị đồ hoạ, hồ nhớ, bộ đệm lệnh|
| 7 | `nn::g3d` | 292 |Trình vẽ tiêu đề 3D sẽ sử dụng|
| 8 | `nn::ui2d` | 476 |Trình vẽ hai chiều cho bố trí trình đơn|
| 9 | `nn::atk` | 1,426 |UI công cụkit — tiêu đề, thực đơn, nút|
| 10 | `nn::font` | 230 |trình đơn|
| 11 | `nn::hid` | 112 |ở mức tối thiểu, "bắt đầu ấn tượng"|
| 12 | `nn::audio` | 182 |nhiều trò chơi chặn khởi động trên âm thanh init|

The long poles are `nn::atk` (1,426) and `nn::ui2d` (476) — the menu system is
the largest single boot dependency. `nn::gfx` + `nn::g3d` are next.

Reassuringly, **`nn::nex` (6,815) and `nn::pia` (4,687) are not on this list.**
Toàn bộ các chồng trực tuyến có thể được stucce và khởi động vẫn tiếp tục tiếp tục.
quyết định ngoại tuyến duy nhất.

---

## 5 đề nghị thực hiện bước đầu tiên

1. **Get `Lp::Sys::SysInit::Init` under the debugger.** Whether boot proceeds at
   Tất cả là trả lời có thể bằng cách xem nơi nó lần đầu tiên gọi vào nền tảng un-inmented
   code. Every unknown gets a `stub → log → return 0` implementation.
2. **Implement `nn::os` first.** The framework is threaded from very early;
   Không có chỉ làm việc và sự kiện nhị phân sẽ treo thay vì thất bại
   cleanly. This is where stubs must be real, not `return 0`.
3. **Stub lớn tiếng, không phải lặng lẽ.** Mỗi chức năng nền tảng đơn giản nên đăng nhập
   Tên bị gỡ rối. Bản ghi khởi động sau đó trở thành hàng đợi công việc, phụ thuộc
   Thứ tự, đó là cách mà lớp dự án này thường được điều khiển.
4. **Expect the first wall at `nn::fs` / romfs.** The title screen needs layouts
   and fonts from `romfs`. Extraction and a native filesystem shim are early work.
5. **Do not start with `nn::atk`.** It is the largest dependency but it is reached
   trễ; thực hiện nó trước khi thiết bị đồ họa tồn tại không có gì cần vẽ.

## 6. Điều quan trọng này cố tình loại trừ

- Không chơi game, không cầu thủ, không cơ khí mực.
- Không trực tuyến, không mai mối, không hành lang — bị kẹt cứng.
- Không cá hồi Run, không chiến tranh Turf.
- Không lưu dữ liệu, không Amibo, không chụp màn hình.

## 7 Thành thật đánh giá

Thậm chí thu hẹp thành "boot to menu", đây là một dự án đáng kể: con đường quan trọng
Chạy qua lớp hệ điều hành, hệ thống tập tin, thiết bị đồ họa, thiết bị 2D/3D
Các nhà sản xuất, và 1,426 công cụ giao diện công cụ giao diện, đó là tháng làm việc, chứ không phải ngày.

Lý do nó đáng để cố gắng là mục tiêu bị giới hạn và
Nhìn thấy**. Không giống như "để lại trò chơi", "đã đến được màn hình tiêu đề" có một nhị phân riêng
Tình trạng thành công, và nhật ký khởi động cho biết chính xác phải thực hiện gì tiếp theo.
con đường đó không cần phải phân giải 113, 150
chức năng trước.
