# Looking for the caller of `DeviceImpl<4,8>::Initialize` — and not finding it

`DEVICE_IMPL_INITIALIZE.md` established that
`nn::gfx::detail::DeviceImpl<ApiVariation<ApiType<4>,ApiVersion<8>>>::Initialize`
(`0x710135d8d8`, 192 bytes) is **where the NVN device is created**, and closed with its caller
Chưa phân loại. Tài liệu này ghi lại việc tìm kiếm, mà **không tìm thấy người gọi**, và tại sao.

Recorded rather than dropped for the same reason as the `NVN_BOOT_SUBSET` correction and the
lỗi quét ARP: **a lỗi tìm kiếm mà không được ghi lại sẽ được lặp lại.**

---

## 1. Direct `BL` callers: none

A `BL` instruction encodes its target directly as a signed 26-bit word offset, so this scan has
no page/GOT indirection to get wrong — unlike the ADRP scan in `NNGFX_LAYER.md` §3.

```
=== callers of 0x135d8d8 ===
found 0
```

**Zero direct callers in the whole 21 MB `.text` range.** So `Initialize` is reached through a
Con trỏ chức năng, bàn xoay hoặc bàn nhảy — chứ không phải gọi.

## 2. Tham khảo như dữ liệu: chính xác là một.

Đang tìm kiếm toàn bộ nhị phân cho địa chỉ được cất giữ như là một giá trị 8 byte, trong cả hai tuyệt đối
(`0x710135d8d8`) and image-base-relative (`0x135d8d8`) forms:

```
pointer occurrences of 0x135d8d8: 1
  at file 0x1cf1810 = mem 0x7101cf1710  (RELATIVE)
```

**Exactly one.** And dumping the words around `0x7101cf1710` shows it is **not a vtable** — the
Hàng xóm là một hỗn hợp các địa chỉ mã và số nguyên nhỏ:

```
+0x00  0x000135d8d8  -> 0x710135d8d8   <- our target
+0x08  0x00000000c0  -> 0x71000000c0   <- 0xc0, an integer, not a pointer
+0x10  0x100220002a103                 <- not an address at all
+0x18  0x0000055cb0  -> 0x7100055cb0
+0x20  0x0000000010  -> 0x10, an integer
+0x28  0x10012005f6597                 <- not an address
+0x30  0x0000dc0e08  -> 0x7100dc0e08
+0x38  0x000000004c  -> 0x4c, an integer
```

Hình lập lại là * (địa chỉ mã số nhỏ, số nguyên nhỏ, giá trị đóng gói, địa chỉ mã, số nguyên nhỏ,
đã đóng gói giá trị *. Đó là một bảng siêu dữ liệu ** — có thể là một bảng định vị hoặc
Thông tin ngoại lệ/unwind — ** không phải là một bảng thông tin**.
địa chỉ là *ở đó, không giống như được gọi từ đó.

## 3. Kết quả tiêu cực là gì?

Kết hợp ♪1 và ♪ ♪ 2:

- `DeviceImpl<4,8>::Initialize` is **not called by name anywhere**.
- Địa chỉ của nó xuất hiện như dữ liệu chính xác ở một nơi**, và nơi đó là **metadata, không phải mã**.

**Vì vậy, người gọi được tiếp cận bởi một cơ chế kho này chưa được xác định.**
Các ứng cử viên, tôi không xác nhận điều đó:

1. ** Cuộc gọi được mẫu và ngay lập tức ở nơi khác**, vì vậy địa chỉ của chúng tôi bảng biểu tượng cho là
   Một sự tức khắc giữa một số người và cuộc gọi thật sự đến với một người anh em.
2. **`nn::gfx`'s public `Device::Initialize` is a different function** that this private
   `detail::` method is reached from indirectly through a pointer stored in the `0x3018`-byte
   Đối tượng chính nó - đó là phù hợp với trường đầu tiên của đối tượng là NVNdevice
   và bố trí của nó mang theo các con trỏ chức năng.
3. **The `BL` target is computed**, e.g. loaded from the object and called via `BLR`, which the
   `BL` scan cannot see by construction.

Option 3 is the most likely and the least satisfying: it means **the `BL`-scan method is
Có cấu trúc mù quáng với cuộc gọi** này, và nó sẽ không giúp gì được.

## 4 sẽ trả lời thế nào?

Not another scan. **Decompiling the `nn::gfx` device-creation entry points and reading them** —
the same method that worked for the platform layer, the NVN subset, and `initializeImpl` itself.
Specifically, the functions around `nn::gfx::Device`'s public surface, which were not enumerated
trong cái đèo này.

Đó là một bước bị ràng buộc tiếp theo, và nó là một trung thực: cách tiếp cận đối chiếu tự động có
now failed twice on this layer (the ADRP scan in `NNGFX_LAYER.md` §3 and the `BL` scan here), for
** Lý do khác nhau mỗi lần** — chính là điều tìm ra.

## Giới hạn 5.

- **The caller of `DeviceImpl::Initialize` remains NOT located.**
- **The table at `0x7101cf1710` was not identified.** I read its shape and concluded "metadata,
  Không gửi; tôi đã không xác minh nó thực sự là gì.
- **No attempt was made to decompile `nn::gfx::Device`'s public entry points**, which is §4's
  giới thiệu.
- **`UseMiddleWare()` and `Nvn::GetDeviceFeature` were not decompiled.**
- **Không có mã số nào được chuyển đến.** Người chạy giày vẫn dừng lại ở bước 11.
