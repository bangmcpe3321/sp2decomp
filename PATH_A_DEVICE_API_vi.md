# `nn::gfx::Device`'s public entry points â what Path A found

`DEVICE_INIT_CALLER_SEARCH.md` recommended reading `nn::gfx::Device`'s public entry points to
find what calls `DeviceImpl<4,8>::Initialize` (`0x710135d8d8`). This is the result, and it is
** Xây dựng thay vì gọi ai đó**.

---

> **RESOLVED.** Đường dẫn sự sáng tạo thiết bị đã được định vị ở
> [NVN_DEVICE_CREATION.md](NVN_DEVICE_CREATION.md): it is **inside `initializeGraphicsSystem`
> itself**, via `nvnBootstrapLoader("nvnDeviceInitialize")`. NVN is resolved **by name at
> Chạy đi**, vì vậy không bao giờ có một biểu tượng cho bất kỳ bản quét nào để tìm _BAR_ Đó là lý do tại sao tìm kiếm trong này
> tài liệu và trong tập tin_BAR_SARCH.M đã được trả lại tất cả các kết cấu tìm kiếm bên dưới
> (the template family, the absent `TDevice` symbols) remain correct and are part of the
> giải thích đi.

## 1. There is no `nn::gfx::Device`

Searching the symbol table for `_ZN2nn3gfx6Device` returns **zero results**. The public device
Loại là ** sttlated**:

```
_ZN2nn3gfx37NvnGetMaxRecommendedScratchMemorySizeINS0_12ApiVariationINS0_7ApiTypeILi4EEENS0_10ApiVersionILi8EEEEEEEmPNS0_7TDeviceIT_EEPKPKNS0_13ResShaderFileEi
_ZN2nn3gfx15TInteroperationINS0_12ApiVariationINS0_7ApiTypeILi4EEENS0_10ApiVersionILi8EEEEEE17ConvertToGfxQueueEPNS0_6TQueueIS7_EEP8NVNqueuePNS0_7TDeviceIS7_EE
_ZN2nn3gfx15TInteroperationINS0_12ApiVariationINS0_7ApiTypeILi4EEENS0_10ApiVersionILi8EEEEEE25ConvertToGfxCommandBufferEPNS0_14TCommandBufferIS7_EEPNS0_7TDeviceIS7_EEP16NVNcommandBuffer
```

The device type is `nn::gfx::TDevice<ApiVariation<ApiType<4>, ApiVersion<8>>>`, and the same
pattern holds for `TQueue<...>` and `TCommandBuffer<...>`. The `nn::gfx` public API is a
**Phlate gia đình tham số trên type và phiên bản**, với các cụ thể hóa tại
`ApiVariation<ApiType<4>, ApiVersion<8>>` â which is the same specialisation `GraphicsNvn::
initializeImpl` allocates (`DeviceImpl<4,8>`, `NNGFX_LAYER.md` Â§1). The pieces agree.

## 2. But `TDevice<4,8>` has no symbols either

Searching for a mangled `_ZN2nn3gfx<len>TDevice` finds **nothing**, and the `Device`-matching
results are all `detail::`:

```
0x7100de0bac  nn::gfx::detail::Nvn::GetDeviceFeature(NVNdevice const*)
0x710135d8d8  nn::gfx::detail::DeviceImpl<...>::Initialize(DeviceInfo const&)
0x710135de1c  NvnGetMaxRecommendedScratchMemorySize<...>(TDevice<...>*, ResShaderFile const* const*, int)
```

**`TDevice` appears only as a parameter type in other functions' signatures, never as a symbol
itself.** That is consistent with `TDevice<ApiVariation<...>>` being a thin **non-virtual
wrapper**_BAR_Các loại phương pháp đủ nhỏ để được chỉ định tại mỗi địa điểm cuộc gọi, để lại không
out-of-line symbol. If so, `TDevice::Initialize` **has no address to find**, and my search for it
đang tìm kiếm một thứ không tồn tại như một biểu tượng.

That would also explain Â§3 of `DEVICE_INIT_CALLER_SEARCH.md`: if the caller is an inlined
wrapper, there is no `BL` to it, which is exactly what that scan found.

## 3. What `initializeImpl` actually does â re-read

Returning to the body (`0x7100e70e1c`, 484 bytes), it:

```c
this_00 = operator_new(0x3018, heap, 8);
DeviceImpl<4,8>::DeviceImpl(this_00);      // the 28-byte CONSTRUCTOR, not Initialize
*(this + 0x48) = this_00;
*this_00 = *(this + 0x30);                 // the NVNdevice
*(*(this + 0x48) + 0x3008) = 1;
uVar2 = Nvn::GetDeviceFeature(...);
...
```

**It calls the constructor and never calls `Initialize`.** So `DeviceImpl::Initialize` â the
function that actually creates the NVN device â is **not on the `initializeImpl` path at all**.
The device must already exist by the time `initializeImpl` runs, which fits the boot order:
`initializeGraphicsSystem` (which calls `nvnLoadCProcs` and `nvnDeviceInitialize` per
`DEVICE_IMPL_INITIALIZE.md`) runs **before** `GameFrameworkNx::initialize` reaches this point.

**So `DeviceImpl::Initialize` is reached from a DIFFERENT device-creation path**, not from
`GraphicsNvn`. Candidates:
- the engine's own `nn::gfx` device set-up, reached from the game rather than from sead;
- an `agl` graphics-device wrapper;
- một con đường mà kho này chưa hề đụng tới.

## 4. Con đường nào đã định trước, và nó đã làm gì?

**Establish:**
- The public type is `TDevice<ApiVariation<ApiType<4>, ApiVersion<8>>>`, a **template family**,
  and `TQueue`/`TCommandBuffer` follow the same shape. The API's structure is now known.
- `TDevice` has **no out-of-line symbols**, so `TDevice::Initialize` may be inlined and
  Không thể tìm ra bằng cách tìm kiếm biểu tượng** (Tiếng cười) Một lời giải thích hợp lý cho hai lần scan thất bại.
- `GraphicsNvn::initializeImpl` calls `DeviceImpl`'s **constructor**, not `Initialize`, so the
  NVN-Device-crace chức năng là **tắt đường đồ họa bị biển**.

**Không có thiết lập:**
- **The caller of `DeviceImpl::Initialize` is still not located.** Path A narrowed the search
  không gian và tạo ra một giả thuyết (được nối liền) nhưng không phải là câu trả lời.
- **`TDevice`'s method surface is unknown** â it has no symbols, so the enumeration Path A set
  không thể thực hiện được.
- **`UseMiddleWare()`, `Nvn::GetDeviceFeature` and `NvnGetMaxRecommendedScratchMemorySize` were
  không bị phân hủy.**

## Máy quét đề nghị 5 đã được thử và FAILED

§2's hypothesis is testable: if `TDevice::Initialize` is inlined, find functions that allocate a
**`0x3018`-byte object**  the unmistakable signature of `DeviceImpl<4,8>` creation  by scanning
cho hằng số.

**The scan found ZERO sites, and I do not trust that result.** My `MOVZ` encoding check was
Hầu như chắc chắn sai một lần nữa: đây là bộ giải mã thứ ba ** viết tay Aarch64 trong nỗ lực này
to produce a null result, following the `ADRP+ADD` scan (`NNGFX_LAYER.md` §3, wrong instruction
form) and the `BL` scan (`DEVICE_INIT_CALLER_SEARCH.md` §1, blind to computed targets).

** Ba người giải mã bằng tay, ba kết quả vô giá trị.** Tại thời điểm này, kết luận thành thật không phải là
"không định là vắng mặt" nhưng **" hướng dẫn giải mã của tôi là không đủ đáng tin để kết luận
Bất cứ điều gì từ một kết quả vô giá.** Ghi âm đó là hữu ích hơn một lần thử thứ tư:
Kiểm tra một người giải mã chống lại những chỉ dẫn chính xác phải đến trước khi tin vào đầu ra của nó,
Và tôi không làm điều đó cho bất cứ ai trong ba người đó.

Vậy giả thuyết của ♪2 vẫn chưa được kiểm tra**, và lời khuyên vẫn còn nhưng nên được thực hiện
với một bộ giải mã xác nhận chống lại những chỉ dẫn mà ý nghĩa đã được biết đến.

## 6 Giới hạn

- **Only the symbol table and two bodies were examined.** No `nn::gfx` method body beyond
  `initializeImpl` and `DeviceImpl::Initialize` was decompiled in this pass.
- **The `TDevice`-is-inlined hypothesis is UNCONFIRMED.** It is consistent with two failed scans,
  Đó là gợi ý, không phải bằng chứng.
- **Không có mã số nào được chuyển đến.** Người chạy giày vẫn dừng lại ở bước 11.
