# `nn::gfx::detail::DeviceImpl<4,8>::Initialize` — the nested bring-up, and a correction

`NNGFX_LAYER.md` recorded that the `DeviceImpl` constructor is only 28 bytes, so the real
device initialisation is in another method. It is `Initialize`, and reading it **corrects a
conclusion in `NVN_BOOT_SUBSET.md`.**

---

## 1, cái xác.

`nn::gfx::detail::DeviceImpl<ApiVariation<ApiType<4>, ApiVersion<8>>>::Initialize(DeviceInfo const&)`
at **`0x710135d8d8`, 192 bytes**:

```c
UseMiddleWare();
puVar2 = nvnBootstrapLoader("nvnDeviceGetProcAddress");
nvnLoadCProcs(0, puVar2);                                    // pass 1: device == NULL

nvnDeviceBuilderSetDefaults(&builder);
nvnDeviceBuilderSetFlags(&builder, 0);
nvnDeviceInitialize(device, &builder);                       // <-- the device comes to life

nvnLoadCProcs(device, puVar2);                               // pass 2: real device
uVar1 = Nvn::GetDeviceFeature(device);
*(uint *)(this + 0x300c) = uVar1;
*(byte *)(this + 0x3009) &= 0xfe;
*(this + 0x3008) = 1;
```

## 2. 2. 3 thứ đã được xác minh

**`nvnLoadCProcs` IS CALLED TWICE, AND THAT IS THE POINT.** Once with a NULL device, then again
with the initialised device. This fits `nvnLoadCProcs`'s own body exactly — a `GetProcAddress`
Giải quyết — và giải thích tại sao hệ nhị phân cần một điểm nhập mà lấy thiết bị làm một
Tham số: **Các con trỏ hàm là cụ thể về thiết bị, vì vậy chúng phải được giải quyết lại sau khi
device exists.** `NVN_BOOT_SUBSET.md` described the resolver correctly but did not note the
Đó là một chi tiết thực sự của kiến trúc, được tìm thấy ở đây.

**`nvnBootstrapLoader` appears by name**, corroborating `GRAPHICS_NVN.md` §2's symbol list
(`nvnBootstrapLoader` at `0x7101413d48` / `0x7103877000`) from a second call site. The string
`"nvnDeviceGetProcAddress"` is passed to it — which is how the resolver callback is obtained.

**The `0x3018`-byte object's layout is now clearer**: NVNdevice at `+0x0000`, flags byte at
`+0x3008`, a bit-cleared byte at `+0x3009`, device-feature bitmask at `+0x300c`. `NNGFX_LAYER.md`
had the `+0x3008`/`+0x300c` fields; `+0x3009` is new.

## 3. CORRECTION to `NVN_BOOT_SUBSET.md`

Tài liệu đó ghi:

> "Không có hỗn hợp, không có độ sâu, không có đỉnh, không có polygon, không màu sắc, không có chương trình, không có kết cấu tạo, và 127
> của 130 chức năng lệnh. Các đường dẫn mang lại phân bổ và khởi động; nó không vẽ. "

**"không vẽ"** một nửa vẫn chưa bị động đến và vẫn đúng. nhưng khung của nó ngụ ý 30NVN
set was the bring-up surface, and **it is not complete**: `DeviceImpl::Initialize` reaches

- `nvnDeviceBuilderSetDefaults`
- `nvnDeviceBuilderSetFlags`
- `nvnDeviceInitialize`

and `nvnDeviceInitialize` was **not** in the 30. So:

> ** 30 người là một kẻ hạ cấp được thiết lập từ ba cơ thể cụ thể, chứ không phải toàn bộ hệ thống mang về.**
> `DeviceImpl::Initialize` is a fourth bring-up body, and it adds at least three more —
> ** 33 cho đến nay.** phương pháp quét âm thanh; danh sách cơ thể chưa đầy đủ, và trước đó
> tài liệu không nói rõ như vậy.

This is the same class of error as the `registerCallback` model and the `+0x80` method
Sự xác định sai lầm: một kết luận hoàn toàn đúng về bằng chứng của chính nó** và ** overstateed như một
Tướng quân nói nó được chỉnh sửa ở đây chứ không phải sửa lại một cách im lặng.

## 4 Điều này có nghĩa gì cho kế hoạch

`DeviceImpl::Initialize` is **192 bytes and is the single most load-bearing graphics function
tìm thấy cho đến nay**: nó là nơi thiết bị NVN được tạo ra. Quan hệ phụ thuộc của nó là nhỏ và
entirely enumerable — `UseMiddleWare`, `nvnBootstrapLoader`, 2× `nvnLoadCProcs`,
`Nvn::GetDeviceFeature`, and 3 `nvnDevice*` calls.

**Who calls it is not yet established.** `GraphicsNvn::initializeImpl` calls the *constructor*
(`0x710135d8b8`), not `Initialize`, so the caller is elsewhere — most likely a device-creation
path reached from `nn::gfx` proper or from `agl`. Locating it is the next step, and it is a
Bị ràng buộc.

## Giới hạn 5.

- **The caller of `DeviceImpl::Initialize` was NOT located.**
- **`UseMiddleWare()` was not decompiled** — its role is unestablished.
- ** Thiết lập cuộc gọi NVN vẫn còn mở.** Với 1 cơ thể được thêm vào và _3 chức năng được tìm thấy, thêm mang lên
  Các cơ thể sẽ thêm vào; số lượng cuối cùng là chưa rõ.
- **`*param_1 = (long)(param_1 + 1)` in the decompiled body is Ghidra's rendering of a pointer
  store into the object's first field** (the NVNdevice at `+0x0000`), not an arithmetic
  Sự khác thường — được lưu ý vì nó đọc một cách kỳ lạ.
- **Không có mã số nào được chuyển đến.** Người chạy giày vẫn dừng lại ở bước 11.
