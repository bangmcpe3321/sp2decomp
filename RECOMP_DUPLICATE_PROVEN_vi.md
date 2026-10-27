# Duplicate registration PROVEN by observation — and `init_array` is clean

Round 7/12. The gdb breakpoint observed **every** `AddVariable` call. The duplicate is now a
**Sự thật được chứng minh**, không phải là giả thuyết, và lời giải thích rõ ràng cho nó đã bị đánh cắp**.

---

## 1. quan sát

62 `AddVariable` calls were logged. `this` (`x0`) is constant `0x7103650170` and `head` is constant
`0x7103650160` throughout — the list object and its head do not move.

```
AddVariable  x0(this)=0x7103650170   x1(node)=0x710304fb90    head=0x7103650160   <- first
AddVariable  x0(this)=0x7103650170   x1(node)=0x7103650210    head=0x7103650160
AddVariable  x0(this)=0x7103650170   x1(node)=0x7103655b78    head=0x7103650160
... 58 more distinct nodes ...
AddVariable  x0(this)=0x7103650170   x1(node)=0x7103698f48    head=0x7103650160
AddVariable  x0(this)=0x7103650170   x1(node)=0x710304fb90    head=0x7103650160   <- AGAIN
AddVariable  x0(this)=0x7103650170   x1(node)=0x7103650210    head=0x7103650160   <- AGAIN
```

**Duplicate phân tích tất cả 62:**

```
DUP: 0x710304fb90
DUP: 0x7103650210
```

**`0x710304fb90` is registered twice, and its second registration is the second-to-last call.** That is
chính xác các đối tượng đo bản thân mình trong các vòng 2–6.

♪ Giả thuyết giả thuyết về sự lặp đi lặp lại chính là thuyết CONFIRMED.**

## 2. Cơ chế, bây giờ quan sát thay vì vô hiệu hóa

1. `0x710304fb90` is registered **first**; the list becomes a chain headed by it.
2. 60 further nodes are appended; the chain ends at `0x7103698f48`.
3. `0x710304fb90` is registered **again**. The walk runs to the tail (`0x7103698f48`), then
   `tail->SetNext(0x710304fb90)` — **which closes the chain into a cycle back to its own head.**
4. `0x7103650210` is registered **again**. Its walk starts at the head, follows the cycle, and
   **Không bao giờ chấm dứt** — cuộc treo cổ.

Chu trình được tạo ra ở bước 3, và bước 4 là nạn nhân.

## 3, lời giải thích rõ ràng là  Chúa Giê - su bị hủy diệt.

The natural guess is that `main`'s `init_array` lists those constructors twice. **It does not.**

Phân tích toàn bộ hệ thống với một bản regex đa dòng (1605, 1604 khác 0.):

| | |
|---|---|
|Mục đã phân tích| 1605 |
|**Không mục nhập**| **1604** |
| declared `init_count` | **1604** |
|**duplicate phi số không mục**| **0** |

**`init_array` is clean: 1604 entries, zero duplicates, exactly matching the declared count.**

** Vì vậy, đăng ký bản sao không đến từ một mục nhập xây dựng gấp đôi.** Thực hiện
Đến hai nhà máy xây dựng hai lần theo một số tuyến đường khác - cách khởi đầu của khách gọi họ,
hay là thời gian chạy vòng lặp xây dựng nhiều hơn một lần. **Điều đó chưa được xác định.**

## 4 Một sự sửa đổi đến vòng 5

Round 5 concluded the chain "does not walk" because `*(0x7103650160 + 8) == 0x3d`, and briefly treated
cái đầu bị sai dạng.

**That was an off-by-one indirection on my part.** The first node is `*(head)`, not `head` — which is
exactly what `AddVariable` does at `+108: mov (%rax),%rdx; +115: mov %rdx,0xa0(%rdi)`.

**`*(0x7103650160) = 0x710304fb90` is the first node**, and `0x710304fb90` *is* the first thing
Đã đăng ký. **Không có gì sai với chuỗi**, và lần xem xét vòng 5's "tách vỡ" là
**rectted.**

## Vòng này chứng minh gì?

|Mục|Tình trạng|
|---|---|
|Lặp lại đăng ký|♪ Quan sát bằng quan sát ♪|
|Mà nút| ✅ **`0x710304fb90` registered 2×, `0x7103650210` 2×** |
|Nơi đăng ký thứ hai|Kết thúc chuỗi 62 cuộc gọi**|
|Name| ✅ **`tail->SetNext(0x710304fb90)` after the re-registration** |
| `init_array` duplicates |{\cH00C1E5EC} 1604 mục nhập, 0 bản sao**|
|Vòng 5 "cái xích bị đứt"|Tôi không thể đánh lạc hướng được.|
| Total `AddVariable` calls | ✅ **62** |
|Điều gì tái chạy hai người xây dựng|Vẫn mở cửa**|

## 6 Những gì điều này không xác minh

- **Why those two constructors run twice is unknown.** `init_array` is clean, so the second invocation
  đến từ những nơi khác — không ai nhận ra.
- **Sự quan sát không đầy đủ.** Chạy gdb được bao bọc tại 300 s và dừng lại xung quanh
  `main init[1361]`, **before** the hang at `init[1367]`. The 62 calls are those seen up to that point;
  Các mô hình nhân bản là có thật, nhưng trình tự có thể dài hơn 62.
- **Có phải 60 nút còn lại cũng được đăng ký lại sau này** không được biết đến — cuộc đua kết thúc sớm.
- **`0x7103650170` (the list object) and `0x7103650160` (the head) were not resolved to symbols.**
- **Không có sửa chữa nào được thiết kế hoặc thực hiện.**
- **`main`'s total constructor count is now known to be 1604**, but `nnMain` is still not reached.
- **Không NVN, không cửa sổ, không trình bày.** Hiển thị và âm thanh là các chấm.
- **Đây không phải trò chơi khởi động.**

## 7. Tăng dần

Hai ứng cử viên chạy lại những người xây dựng, cả hai đều rẻ tiền để phân biệt:

1. **The runtime drives `init_module` twice.** Verify by logging entry/exit of `init_module` for `main` —
   Không cần phải thay đổi một dòng, không cần phải dùng đến gdb.
2. **The guest calls the constructors again.** If `init_module` provably runs once, the second
   Yêu cầu đăng ký phải đến từ mã khách, và một điểm ngắt với một bộ mã hậu cần ** tại thứ hai
   `AddVariable(0x710304fb90)` names its caller directly.

Dấu vết sau của bước 2 là quyết định hơn, và trước đó chạy được dừng lại các rẻ hơn nó là: phá vỡ trên
`AddVariable` with argument `0x710304fb90` a **second** time and print `bt`.
