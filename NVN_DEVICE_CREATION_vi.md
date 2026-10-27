# Đường dẫn thiết bị NVN — được định vị

`PATH_A_DEVICE_API.md` and `DEVICE_INIT_CALLER_SEARCH.md` both failed to find the device-creation
và ba người giải mã bằng tay đã tạo ra những kết quả vô giá trị.
phương pháp đã thực sự hiệu quả — tìm thấy nó ngay lập tức.** Nó chính xác là những gì hiện nay nhìn
Rõ ràng là nhìn lại.

---

## 1. The path is inside `initializeGraphicsSystem` itself

From `sead::GameFrameworkNx::initializeGraphicsSystem` (`0x7100e6738c`):

```c
pcVar12 = (code *)nvnBootstrapLoader("nvnDeviceInitialize");
puVar13 = (undefined *)nvnBootstrapLoader("nvnDeviceGetProcAddress");
if ((pcVar12 != 0) && (puVar13 != 0)) {
    ...
    pcVar12(...);            // the device is initialised here
    nvnLoadCProcs(device, puVar13);
    ...
}
```

Ba điều rơi ra, mỗi câu hỏi mở:

**`nvnDeviceInitialize` is not a symbol — it is a STRING.** The engine resolves it at runtime by
passing the literal `"nvnDeviceInitialize"` to `nvnBootstrapLoader`. So there was **never a symbol
để tìm**, và hai bản scan đối chiếu của tôi đã tìm kiếm một cái gì đó mà không tồn tại như một
biểu tượng:

- the `BL` scan (`DEVICE_INIT_CALLER_SEARCH.md` §1) — correct that it found no caller, wrong to
  Kết luận là người gọi đã bị giấu;
- the ADRP scan (`NNGFX_LAYER.md` §3) — same category.

**`nvnBootstrapLoader` is the real entry point.** It takes a **function name** and returns that
function's address. That is why `GRAPHICS_NVN.md` §2 found only `nvnBootstrapLoader` and
`nvnLoadCProcs` as `nvn*` symbols: **both are name-based resolution mechanisms**, one per function
Và một cho toàn bộ bàn. kết luận trước đó: "NVN không có bề mặt một chức năng vì nó
được chạm đến thông qua con trỏ" — là đúng trong tinh thần và sai trong cơ chế: nó được đạt **by
tên, thông qua một người chở hàng**.

**`nv::InitializeGraphics` is probably `nvnBootstrapLoader` itself.** `ATTEMPT` (the previous
commit) recorded that `nv::InitializeGraphics` was **not found in the symbol table**, as called by
`initializeGraphicsSystem`. The body now shows `nvnBootstrapLoader("nvnDeviceInitialize")` at
Giải thích kinh tế nhất là phân hủy tên
`nv::InitializeGraphics` call as a `nvnBootstrapLoader` call — **the same function under two
Tên** — chứ không phải là có hai cuộc gọi riêng biệt.

## Tại sao vị trí bị đánh bại mỗi lần quét

`nvnDeviceInitialize` is the device creation, and it appears in `initializeGraphicsSystem` as a
**computed call**: `pcVar12(...)`, where `pcVar12` came from a loader. Every scan I wrote looked
cho một mối quan hệ * tĩnh:

|Quét|Tìm kiếm|Tại sao nó không thể thành công|
|---|---|---|
| `BL` callers of `DeviceImpl::Initialize` |một nhánh trực tiếp| the call is `pcVar12(...)` — an indirect call through a loader result |
| `ADRP+ADD`/`LDR` for `PTR_pfnc_nvn*` |một tham chiếu dữ liệu|những toàn cầu tồn tại, nhưng đường dẫn thiết bị sử dụng **loader**, không phải bàn giải quyết|
| `MOVZ` for `0x3018` |một hằng số|đối tượng thiết bị không được cấp phát bởi đường dẫn này ở tất cả|

**Cả ba đều bị kết thúc bởi cùng một sai lầm: giả sử một liên kết tĩnh nơi nhị phân sử dụng tên
Độ phân giải.** Đó là một khám phá tổng quát, và đó là lý do tại sao đọc nhịp tim bốn lần.

## 3. Hình ảnh được chỉnh sửa của giao diện NVN

Putting this together with `DEVICE_IMPL_INITIALIZE.md` and `GRAPHICS_NVN.md` §2:

```
engine bring-up
  └─ nvnBootstrapLoader("nvnDeviceInitialize")      -> fn ptr   [initializeGraphicsSystem]
     nvnBootstrapLoader("nvnDeviceGetProcAddress")  -> resolver ptr
     fn(device, &builder)                            -> DEVICE EXISTS
     nvnLoadCProcs(device, resolver)                 -> 453 named globals filled
        └─ each entry reached as PTR_pfnc_<name>

nn::gfx's own path (a DIFFERENT route, not taken at sead bring-up)
  └─ DeviceImpl<4,8>::Initialize (0x710135d8d8)
        nvnLoadCProcs(0, resolver)      pass 1, null device
        nvnDeviceInitialize(...)        via the table, not the loader
        nvnLoadCProcs(device, resolver) pass 2
```

** Vì vậy, có hai tuyến đường dẫn thiết bị**, và chúng khác nhau trong cơ chế: sử dụng mang biển
`nvnBootstrapLoader` by name, while `nn::gfx`'s `DeviceImpl::Initialize` uses the resolved table.
Both reach the same NVN operation. That explains why `DeviceImpl::Initialize` had no caller on the
Đường biển — nó nằm trên con đường kia.

## 4 nghĩa là gì đối với cảng?

** Đường dẫn thiết bị sáng tạo bây giờ được biết đến và nó là bốn bước**, tất cả bên trong
`initializeGraphicsSystem`:

1. `nvnBootstrapLoader("nvnDeviceInitialize")` → function pointer
2. `nvnBootstrapLoader("nvnDeviceGetProcAddress")` → resolver pointer
3. gọi thiết bị kích hoạt con trỏ với người xây dựng
4. `nvnLoadCProcs(device, resolver)` → fill the 453-entry table

**A port can implement all four**, because `nvnLoadCProcs` is already ported (with the measured 453
names) and `nvnBootstrapLoader` is a name→function lookup that a port controls entirely. That is a
Vị trí rõ ràng tốt hơn là "các thiết bị đến từ một con đường mà chúng ta chưa định vị".

## Giới hạn 5.

- **The full `initializeGraphicsSystem` body was NOT read this round** — only the region around
  `nvnDeviceInitialize`. The `if` branch shown is partial (its condition and the call inside were
  đọc; khoảng 2,372 byte không được kiểm tra lại).
- **`nvnBootstrapLoader`'s own body was NOT decompiled.** That it takes a name and returns an
  địa chỉ bị tắt từ nơi gọi, không phải đọc từ chức năng.
- **§1's third claim (that `nv::InitializeGraphics` and `nvnBootstrapLoader` are the same function)
  Đó là sự đọc kinh tế nhiều nhất, nhưng chưa được xác nhận.
- ** Nội dung của người xây dựng đã không được đọc**, vì vậy những gì thiết bị được cấu hình với không rõ.
- **Không mã số nào được chuyển đến vòng này.** Người chạy giày vẫn dừng lại ở bước 11.
