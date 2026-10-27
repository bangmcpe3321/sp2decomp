# 74 máy xây dựng SDK đã bị bỏ qua — cố định

Vòng 8. Cả hai ứng cử viên vòng 7 đã được kiểm tra cùng một lúc, và một trong số họ đã tìm thấy một nguyên nhân **root đó là
unblocked 74 SDK constructors. The `nn::nex::WaterMark` fault persists but has moved *inside* `main`'s
`_init`.

---

## 1, nguyên nhân gốc

Công cụ tạo ra từ ngữ địa vị, ngay lập tức:

```
sdk: init_status @ sdk+6bf678 = 2, init_count = 74
sdk constructors: 0
```

**`init_count = 74`, but the status word is `2`.** The stock runtime runs constructors only when
`status == 1`:

```cpp
if (status == 1)
    for (size_t k = 0; k < m.init_count; k++) call_preserving(c, m.base + m.init_array[k]);
```

**Splatoon 2's SDK writes `2`.** Wonder's writes `1`. So **all 74 of `sdk`'s constructors were silently
đã bỏ qua** — toàn bộ sự khởi tạo của dịch vụ SDK: hipc, fs, htc, ổ cắm, tài khoản, tiểu dụng
codec, nfc, pwm, `std::ios_base::Init`, and more.

## 2. Sửa chữa, và kết quả

Chấp nhận bất kỳ trạng thái không phải số:

```cpp
if (status != 0)
```

và chạy bây giờ thực hiện chúng:

```
sdk init[0]  +0x40a6c  _ZN2nn2sf4hipc6detail17HipcMessageReader10InitializeEPKv
sdk init[1]  +0x4adf0  _ZN2nn2fs6detail10UnregisterEPKc
sdk init[2]  +0x56dc8  nn::sf::cmif::client::...DomainProxyClientCoreProcessor::Process
sdk init[3]  +0x5f698  _ZN2nn3htc35BindHostDisconnectionEventForSystemEPNS_2os11SystemEventE
...
sdk init[70] +0x1e8da8  _ZN2nn3pwm10GetEnabledEPNS0_14ChannelSessionE
sdk init[73] +0x2024f4  _ZNSt3__18ios_base4InitD1Ev
sdk constructors: 74 (status 2)
```

**All 74 ran, and the run reports `74 (status 2)`.** That is the SDK's entire service layer
Khởi đầu — cảng sâu nhất từ trước đến nay.

## 3. Đây là hằng số Siêu sao-vs-Slatoon-2 thứ tư

| # |Tiêu thụ|Sự kết hợp|
|---|---|---|
| 1 | `g_fast[4]` |6 mô- đun, 2 ô âm thầm rơi|
| 2 |16 MB bước mô- đun| `sdk` mapped over `main` |
| 3 | `kDtInit = 0x30` | called `_init+0xc` |
| 4 | **`init_status == 1`** |**74 xây dựng máy SDK âm thầm bỏ qua**|

** Mô hình bây giờ không thể nhầm lẫn được**: thời gian chạy này mã hóa một số sự thật đó là sự thật của Wonder's SDK
Đó là cái hay nhất.
Điều hữu ích mà dự án này đã học được về việc thích ứng thời gian chạy với trò chơi khác.

## 4. Lỗi vẫn tiếp tục, nhưng nó đã thay đổi

```
sdk constructors: 74 (status 2)
main: _init at +0x24
=== HOST SIGSEGV ===
  fault address : 0x10
  guest lr      : main+d08790 (_ZN2nn3nex9WaterMarkC2EPKcbj+84)
  x0  0000000000000000     <- this == NULL
```

Hai điều đã thay đổi:

1. **`main init[N] lines: 0`** — `main`'s constructors never ran, because the fault happens **inside
   `main`'s `_init`**: the log shows `main: _init at +0x24` and then the crash, with no `main:
   init_status` line after it.
2. **The fault is unchanged in identity** — still `nn::nex::WaterMark`, still `this == NULL`, still
   `+0x10`.

**So the skipped `sdk` constructors were NOT the cause of the null `this`** — that hypothesis is
disproved. The fault is in `main`'s own static initialisation.

## 5. The remaining hypothesis: a null `new`

`this == NULL` in a static constructor most directly means **`operator new` returned null**. Splatoon 2
exports `nn::init::InitializeAllocator` and `nn::init::GetAllocator` — the game's allocator entry
points — and if the allocator was never installed, every `new` in `main`'s static init returns null,
and `WaterMark` is simply the first one to dereference it.

**Đây là giả thuyết hàng đầu và chưa được kiểm tra.** Nó cũng có thể thử nghiệm rẻ: kiểm tra xem
`nn::init::InitializeAllocator` is called before the fault, or log the first `operator new` result.

## 6, vòng này chứng minh cái gì?

|Mục|Tình trạng|
|---|---|
| Round-7 candidate (a): `sdk constructors: 0` |♪root-dod and FIXED**|
|Nguyên nhân gốc| ✅ `init_status == 1` vs Splatoon 2's `2` |
| `sdk` constructors running | ✅ **74 / 74** |
| Round-7 candidate (b): null `new` |♪ Giả thuyết hàng đầu, **un tested**|
|Lỗi di chuyển| ✅ now **inside `main`'s `_init`** |
|Lỗi được sửa| ❌ still `nn::nex::WaterMark`, `this == NULL` |

## 7 Những gì điều này không xác minh

- **No game initialisation has completed.** `main`'s static constructors are still failing.
- **`main`'s `init_count` and status were never printed** — the crash happens before the diagnostic
  line, so `main`'s constructor list is unknown.
- **The null-`new` hypothesis was not tested.**
- ** HLE vẫn chưa thực hành được** — một thông tin nhập khẩu được gọi qua toàn bộ cuộc chạy.
- **Không NVN, không cửa sổ, không trình bày.**
- **`nnosInitialize`'s return value is still unchecked.**
- ** 74 người xây dựng đã được điều hành nhưng hành vi trở về cá nhân của họ không được kiểm tra** — a
  Xây dựng mà âm thầm thất bại sẽ không được hiển thị ở đây.

## 8 Thêm vào

Test the null-`new` hypothesis: instrument the runtime's allocator path and log the first
`operator new` result in `main`'s static init, and whether `nn::init::InitializeAllocator` ran. That
either explains `WaterMark` or names the next real cause.
