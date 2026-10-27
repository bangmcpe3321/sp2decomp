# Đầu đề không phải là mục tiêu tốt hơn: đồ thị tĩnh-init giống hệt nhau

So sánh là chạy. **The March-17 proto và bán lẻ là cùng một thế hệ động cơ với cùng một
Đồ thị trạng thái tĩnh.** việc chuyển đổi các tòa nhà không giúp ích gì.

---

## 1. Những con số

|Metric|**Proto**|**Retail**|
|---|---:|---:|
| Distinct `PseudoGlobalVariable<T>` types in `main` | **202** | **202** |
| Same, in `sdk` / `subsdk*` | 0 | 0 |
| `nnos*` symbols in `sdk` | **121** | **121** |
| `nnosInitialize` present in `sdk` | ✅ 1 | ✅ 1 |
| `nn::init::Start` (`_ZN2nn4init5StartEmmPFvvE`) | ❌ **0** | ❌ **0** |

**Mọi thước đo quan trọng đều giống nhau. ** Bản proto có 202 khác biệt giả có thể thay đổi.
instantiations in `main` — exactly retail's count — and its `sdk` carries the same 121-symbol `nnos*` C API
surface with no `nn::init::Start`.

## 2 nghĩa là gì?

**Con khỉ không mua được gì cho con bọ này cả.**

- It is the **same SDK era** (`nnos*`, no `nn::init::Start`), so the five silent Wonder-vs-Splatoon-2
  Bất hợp pháp tất cả vẫn còn áp dụng.
- It has the **same middleware graph** — the `nn::nex` / `nn::pia` netcode that the hang is stuck inside is
  hiện diện trong cùng một số lượng.
- Its `main` is **2.2 MB larger** (debug build), so there is strictly *more* code to run.

**Its only advantage is the debug menu** — `DbgSetting`, scene redirection, `[+] Load map`, `[-] FreeTest` —
và ** ngồi đằng sau ngăn chặn.** Bạn không thể đạt được cảnh gỡ lỗi- Nhảy nếu không khởi tạo trạng thái tĩnh
Hoàn tất.

## 3. Câu hỏi này trả lời

Hai vòng trước đây câu hỏi là * "Làm thế nào có thể tự hỏi chạy nhưng Slatoon 2 không thể?"
ứng cử viên cho một tòa nhà có thể thoát khỏi vấn đề.

**Nó không phải.** Kẻ chặn đường không phải là một tài sản của *mà Slatoon 2 xây dựng * — nó là một tài sản của
** Thế hệ kỹ thuật và các phần mềm trung gian của nó**, và cả hai xây dựng chia sẻ nó.

**Đó là một kết quả tiêu cực thực sự hữu ích**, bởi vì nó loại bỏ một tùy chọn hợp lý và hấp dẫn
Trước khi có thêm thời gian cho nó.

## 4 Những gì điều này không xác minh

- Chỉ có NSOs của nó bị cắt giảm và kiểm tra dây.
- **`main`'s 202 PGV *types* is not the same as retail's 62 *registrations*.** Types over-count: a
  `PseudoGlobalVariable<T>` type can have several instances, and some types may be linked but unused. **The
  202-vs-202 bình đẳng cho thấy hai tòa nhà có cấu trúc giống nhau; nó không chứng minh thời gian chạy
  Quy trình đăng ký giống hệt nhau** — điều này cần phải chạy một pito có cổng, chưa được làm xong.
- **`subsdk9` was not analysed** beyond decompression; it is 152 KB and its role is unknown.
- ** Trình đơn gỡ lỗi của proto đã không được thực hiện hoặc chạm vào.**
- Việc treo cổ không thay đổi và vẫn chưa giải thích được.
- **`nnMain` still not reached.** No NVN, no window. **This is not a booted game.**

## Năm kết luận trung thực

** Cũng không phải Slatoon 2 xây dựng là một phù hợp cho công cụ này khi nó đứng.** Cổng đạt 1,367 của
`main`'s 1,604 static constructors and hangs in `nn::nex::PseudoGlobalVariableList::AddVariable` — and the
proto cũng có biểu đồ mạng lưới kiểu 202 giống như vậy đặt nó ở đó.

**Các lựa chọn, nói rõ ràng:**

|Tùy chọn|Chi phí|Trò chơi đang chạy giống nhưlihood|
|---|---|---|
| Keep debugging the `AddVariable` hang |nhỏ, giới hạn|Chưa rõ — vẫn còn một câu hỏi mở|
| Build a `nex`/`pia` HLE or offline bypass |lớn|hạ thấp mà không có toàn bộ bề mặt HLE|
|Port a ** Trò chơi khác biệt** — newer SDK, no stil online|trung bình|** cớ vật chất tốt hơn**|
|Dùng một trình giả lập thay vì phục hồi|n/a|cao, nhưng một dự án khác|

**The reusable assets this project produced** — the six-entry silent-mismatch ledger, the `exefs`-is-LZ4
trap, the `call_preserving`-misses-direct-calls trap, and the `nnos`-era entry discovery — **transfer to any
Đó là phần đáng giữ.
