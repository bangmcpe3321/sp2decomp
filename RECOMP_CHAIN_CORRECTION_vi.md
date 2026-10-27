# Correction: the list is not one element, and `call_preserving` hooks miss direct calls

Hiệp 4/12 đã tạo ra **2 sự sửa đổi cho công việc trước đây của tôi** và một phát hiện quan trọng.
hình tròn 3 giả thuyết đã được biến đổi như đã nói, mặc dù lõi của nó vẫn còn tồn tại dưới dạng thay đổi.

---

## 1. dụng cụ của tôi là sai chỗ.

I hooked `AddVariable` in `call_preserving`. **No log line ever appeared.**

Lý do là do các công trình của riêng mình tách ra từ vòng 3:

```asm
+285:  call   0x31e69fc <_Z13main_00D2F0F4RN2nx3CPUE>    ; DIRECT host call
```

**The recompiler emitted `AddVariable` as a direct C++ call, not through `nx::call`.** So:

> **Any runtime hook placed on `call_preserving` or `nx::call` misses every direct recompiled call.**

Đó là một sự ép buộc cơ bản cho dự án này**, không phải một trong những: công cụ phải được gắn kết
cho chức năng đích, hoặc cho mã tạo ra, không phải cho người trợ giúp gửi.

## 2. Đầu danh sách không phải là lõi - vòng 3 khung là sai

Reading the head global (`main+0x2fc7520`) at the hang:

|Mục|Giá trị|
|---|---|
|**Người đứng đầu danh sách**| **`0x7103650160`** |
|Cái lõi dưới chân ta.| `0x710304fb90` |
| node `+0` (vptr) | `0x7102ef98a8` |
| node `+8` (m_pNext) | `0x710304fb90` (itself) |

**`head ≠ node`.** Round 3 argued the failure as *"a node added while it was the only element: the walk
stops at it immediately, then `SetNext` links it to itself."* **That reasoning is wrong** — the list is
**Không** một yếu tố duy nhất, và đi bộ không bắt đầu từ nút xấu.

**So the corrected picture:** the self-linked node `0x710304fb90` sits **somewhere inside a longer
chain**. The walk starts at `0x7103650160`, advances through the chain, reaches `0x710304fb90`, and
there `GetNext()` returns the node itself and never advances again.

## 3. Giả thuyết cốt lõi tồn tại, trong một hình thức thay đổi

Bang này vẫn được giải thích bởi một bản sao đăng ký — nhưng bởi một cơ chế ** khác biệt** so với vòng 3
được mô tả:

1. `0x710304fb90` is first added and becomes the **tail** of the chain (`m_pNext == 0`);
2. nó được thêm ** một lần nữa**;
3. the walk runs from the head all the way to the **tail, which is `0x710304fb90` itself** — `GetNext()`
   returns `0` there, so the walk stops **on that very node**;
4. the insertion then runs **`0x710304fb90->SetNext(new_node)` where `new_node` is `0x710304fb90`**;
5. → `m_pNext = this`, and every later walk hangs.

** Tương tự kết luận — đăng ký gấp đôi — nhưng bước 3 là cái đuôi, không phải cái vali duy nhất.**
The hypothesis is **not proven**; nothing has yet observed the second `AddVariable` call.

## 4. A third correction: `+0x2fc75b0` is not a count

Round 3's dump of the empty-list branch set `*(0x7102fc75b0) = 1`, and I described that global as "a
count / flag". **At the hang it reads `56,951,144`.** Whatever that global is, **it is not a
Số lần đăng ký**, và mô tả sơ bộ của tôi về nó là sai.

## Vòng này chứng minh gì?

|Mục|Tình trạng|
|---|---|
| `call_preserving` hook on `AddVariable` |♪ Chưa bao giờ bắn, gọi trực tiếp ♪|
|Trực tiếp tương ứng các cuộc gọi qua các thư mục trợ giúp|Phát hiện, tổng lực.|
|Name| ✅ **`0x7103650160`** |
| `head == node` |♪ Tis — vòng 3 đã được rút lại ♪|
| `m_pNext == this` on `0x710304fb90` |Xác nhận lại|
|Lặp lại đăng ký|*Survives hình dạng đã thay đổi, vẫn chưa được chứng minh**|
| `+0x2fc75b0` is a registration count |**Đã bị trục xuất**|

## 6 Những gì điều này không xác minh

- ** Bản sao vẫn chưa được quan sát.** Giả thuyết tồn tại; nó không được chứng minh.
- **The chain from `head` to `0x710304fb90` was not traced** — its length and members are unknown.
- **Whether `0x710304fb90` is actually the tail is inferred**, not measured.
- **What `+0x2fc75b0` really is, is unknown.**
- **Không có sửa chữa nào được thiết kế hoặc thực hiện.**
- **`main`'s total constructor count is still unknown**; `nnMain` still not reached.
- **Không NVN, không cửa sổ, không trình bày.** Hiển thị và âm thanh là các chấm.
- **Đây không phải trò chơi khởi động.**

## 7. Tăng dần

**Trace the chain.** Walk `m_pNext` from `head = 0x7103650160` in gdb, printing each node and its type,
until the walk reaches `0x710304fb90` or cycles. That gives:

- the chain length (is `0x710304fb90` the tail?),
- Cho dù bất kỳ nút xuất hiện **twice** — mà sẽ chứng minh bản sao trực tiếp, và
- Cho dù dây xích có được cải tạo tốt hay không.

Đó là một phiên họp gdb với một vòng lặp, không cần xây dựng lại, và trả lời câu hỏi nhân bản bằng cách
quan sát chứ không phải suy luận.
