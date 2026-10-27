# What `nn::gfx` is, and the NVN reference scan that did not work

`NVN_BOOT_SUBSET.md` answered which NVN functions the bring-up path reaches (30 of 453) and
closed with the next unknown: **`nn::gfx` sits between `sead::GraphicsNvn` and NVN**, so those
30 cuộc gọi đi qua * qua lớp 289 chức năng. tài liệu này ghi lại lớp đó là gì, và — với
cũng quan trọng như nhau — một sự cố gắng đo lường mà **failed**, vì vậy nó không được lặp lại hoặc sai lầm cho
Một kết quả.

---

## 1. Điểm nhập đã được kiểm tra

`GraphicsNvn::initializeImpl` (`0x7100e70e1c`, 484 bytes) is where the gfx layer is created:

```c
this_00 = operator_new(0x3018, heap, 8);                       // 0x3018 = 12,312 bytes
nn::gfx::detail::DeviceImpl<nn::gfx::ApiVariation<nn::gfx::ApiType<4>, nn::gfx::ApiVersion<8>>>::DeviceImpl(this_00);
*(this + 0x48) = this_00;
*this_00 = *(this + 0x30);                                     // the NVNdevice
*(*(this + 0x48) + 0x3008) = 1;
uVar2 = nn::gfx::detail::Nvn::GetDeviceFeature(*(this + 0x30));
*(lVar5 + 0x300c) = uVar2;
(**(code **)PTR_pfnc_nvnDeviceGetInteger_7102fc8800)(*(this + 0x30), 0xf, &iStack_24);   // 0xf
(**(code **)puVar1)(*(this + 0x30), 0x10, &local_28);                                     // 0x10
(**(code **)puVar1)(*(this + 0x30), 0x11, &local_34);                                     // 0x11
(**(code **)puVar1)(*(this + 0x30), 0x12, &local_38);                                     // 0x12
```

Có hai sự kiện cụ thể được đưa ra:

|Ký hiệu|Địa chỉ|Kích cỡ|
|---|---|---:|
| `nn::gfx::detail::Nvn::GetDeviceFeature(NVNdevice const*)` | `0x7100de0bac` |660 byte|
| `nn::gfx::detail::DeviceImpl<ApiVariation<ApiType<4>,ApiVersion<8>>>::DeviceImpl()` | `0x710135d8b8` |**28 byte**|

**The `DeviceImpl` constructor is 28 bytes** — it is a vtable/field initialiser, not the
initialisation. The `0x3018`-byte object it constructs has an NVNdevice at `+0x0000`, a flag
written at `+0x3008`, and the device-feature bitmask at `+0x300c`. So the real work of bringing
the gfx device up is elsewhere (an `Initialize`-style method reached later), which is the next
phải lần theo dấu vết.

`GetDeviceFeature` is 660 bytes and returns a `uint` bitmask, queried from the NVNdevice. The
four `nvnDeviceGetInteger` calls with selectors `0xf`, `0x10`, `0x11`, `0x12` immediately
sau đó được đọc về giới hạn thiết bị ( Cỡ họa tiết xi măng và tương tự), được cất giữ sau này để sử dụng.

## Hình dạng lớp 2

From the symbol inventory, `nn::gfx` is **289 functions**. Two components dominate what is
hiện ra theo tên:

**`nn::gfx::detail::Nvn` — 32 functions, and they are almost all enum translation.** Examples:

```
Nvn::GetImageFormat(ImageFormat)          Nvn::GetAttributeFormat(AttributeFormat)
Nvn::GetImageTarget(ImageDimension)       Nvn::GetDepthFunction(ComparisonFunction)
Nvn::GetStencilOperation(StencilOperation) Nvn::GetStencilFunction(ComparisonFunction)
Nvn::GetBlendEquation(BlendFunction)      Nvn::GetBlendFunction(BlendFactor)
Nvn::GetLogicOperation(LogicOperation)    Nvn::GetFrontFace(FrontFace)
Nvn::GetFillMode(FillMode)                Nvn::GetDrawPrimitive(PrimitiveTopology)
Nvn::GetMinFilter(FilterMode)             Nvn::GetMagFilter(FilterMode)
Nvn::GetWrapMode(TextureAddressMode)      Nvn::GetShaderStage(ShaderStage)
Nvn::GetShaderStageBits(int)              Nvn::GetRComparisonFunction(ComparisonFunction)
```

**Every one of these is a pure `enum -> enum` mapping**, and every one is a *rendering-state*
conversion. They are exactly the functions `NVN_BOOT_SUBSET.md` §3 showed are **not reached at
mang lên** — bộ có thể chạm không có chất pha trộn, độ sâu, giấy, chất tô đầy hay khoa học nguyên thủy
Gọi nó đi. nhưng nó thuộc về ** Vẽ một nửa, không phải là
Mang một nửa lên đây.

**`DeviceImpl` — 172 symbols.** The `ApiVariation<ApiType<4>, ApiVersion<8>>` specialisation is
Một trong số đó; lớp được mẫu qua kiểu hệ thống AI/version, đó là lý do tại sao cùng một logic
lớp học xuất hiện nhiều lần.

## 3. Con số mà FAILED — được ghi lại nên không được lặp lại

Tôi đã cố gắng trả lời "Thế giới NVN nào làm toàn bộ tham chiếu nhị phân?" bằng cách giải mã nhị phân
own AArch64 `ADRP+ADD` instruction pairs and matching targets against the 453 global addresses,
**instad của** phân giải 289 chức năng một lúc ( đối số của hệ thống chữ Gihdra là
không gian màu trắng, vì vậy một danh sách địa chỉ hàng loạt yên lặng thả tất cả, ngoại trừ điều đầu tiên — một giới hạn đã có
được ghi lại trong dự án này).

**Nó không có hiệu quả.** Chuỗi cố gắng:

1. **ADRS+AD chỉ có 2,290 lượt truy cập trong một khu vực hẹp, nhưng 0 tương ứng với bất kỳ của 453 toàn cầu.**
   Kết quả là dương tính sai từ dữ liệu không liên quan trong cửa sổ được quét.
2. Kiểm tra xem toàn cầu có rơi ra ngoài cửa sổ hay không.
   **178.8 KB** (`0x7102f9ca18` .. `0x7102fc9568`), and **23 fall outside** the initially scanned
   `0x7102fc8000..0x7102fd0000` — including `nvnCommandBufferDrawArrays`,
   `nvnCommandBufferDrawElements`, `nvnPolygonStateSetCullFace` and `nvnBufferGetAddress`. That
   là một sự sửa chữa chân chính cho cửa sổ, và nó quan trọng: ** Vẽ cuộc gọi tồn tại bên ngoài
   khu vực mang lên**, phù hợp với ♪2.
3. Dumped real instructions at a site whose ADRP page matched `0x7102fc8000`:
   ```
   0x7100d9b4a0  adrp x8, 0x7102fc8000 ; 0xf9400108 (ldr x8,[x8]) ; ...
   ```
   Vì vậy, truy cập là **ADRP + LLR**, không ARP + ADD — một giả định sai về tôi.
4. Added `LDR (immediate, 64-bit)` decoding. **Still 0 matches.**

Nguyên nhân chưa được giải quyết.
the `PTR_pfnc_nvn*` addresses embedded in symbol *names* may not be the addresses the code
Tính toán; tải có thể đi thông qua một got bổ sung trong định hướng; hoặc tên biểu tượng của Ghidra sử dụng
Một căn cứ khác so với cái tôi nghĩ.

**Những gì điều này có nghĩa là: ** Câu hỏi "HVN sử dụng bao nhiêu trong tổng số" là ** không
Trả lời**, và 27 bình dân phân biệt chủng tộc một chạy trước đó được in là một hiện vật của
broken scan, not a finding. `NVN_BOOT_SUBSET.md`'s **30** stands, because it came from the
Phân hủy cơ thể bằng một phương pháp khác (được tham khảo trên toàn cầu * tên * *), không phải từ bản quét này.

## 4 Giới hạn

- **`nn::gfx`'s NVN subset is NOT established.** Only the two entry points in §1 were
  Chưa kiểm tra 287 chức năng còn lại.
- **The `DeviceImpl` initialisation proper was not located.** Its constructor is 28 bytes, so
  Sự đem lên thực sự là theo một phương pháp khác, không được nêu tên trong thẻ này.
- ** Số lượng tham chiếu nhị phân toàn NVN là không rõ**, vì lý do ở cả lớp 3.
- **Không có mã số nào được chuyển đến.** Người chạy giày vẫn dừng lại ở bước 11.
