# Who re-registers the node: a legitimate `init_array` constructor

Hiệp 8/ 12 vòng tròn. Máy này gọi lại tên người gọi của đăng ký ** giây **. Kết quả **re khung
còn lại một câu hỏi** và **spromate danh sách vòng tròn đọc từ không có khả năng dẫn đầu**.

---

## 1, vết lùi

```
#0  main_00D2F0F4   (AddVariable)
#1  main_00D0CB08
#2  main_00D1A3E8            <- a main init_array entry
#3  nx::call
#4  nx::call_preserving
#5  nx::init_module
#6  nx::nn_main
#7  nx::call
#8  nx::boot()
```

**The second registration comes from `init_module` → a constructor in `main`'s `init_array`.**

And `main+d1a3e8` is a constructor the earlier log already named:

```
main init[1364] +0xd1a3e8 -> main+d1a3e8
```

**So constructor #1364 is what re-registers `0x710304fb90`.**

## 2. Những gì nó loại trừ và những gì nó ép

Round 7 established that `init_array` has **1604 entries, zero duplicates.** Combined with this backtrace:

> **Two *different* `init_array` constructors both end up calling `AddVariable` on the same
> `PseudoGlobalVariable` object.**

Đó là hành vi chơi trò chơi hợp pháp **, không phải là trùng hợp nhập dãy và không phải chạy hai lần một lần.
** Cổng không phải là lái xe những người xây dựng hai lần** — trò chơi chính nó đạt đến mức đăng ký từ hai
Những công trình xây dựng riêng biệt.

## 3. Điều này thay đổi giả thuyết hàng đầu

Rounds 2–7 carried the assumption that `m_pNext == self` is **corruption**. That assumption now looks
** chứng thiếu khả năng**, và cách khác cần được xem xét một cách nghiêm túc:

**`PseudoGlobalVariableList` may be an intentionally CIRCULAR list**, in which the tail's `m_pNext`
chỉ vào đầu **. bên dưới câu đó:

- `0x710304fb90` is registered **first**, so it **is the head**;
- dây xích kết nối lại với nó là thiết kế danh sách vòng tròn bình thường**, không phải lỗi;
- `GetNext()` returning the head is **correct behaviour**;
- và khuyết tật là bài kiểm tra kết thúc của ** Walking**.

And here is the sharp part: **`AddVariable`'s exit test compares against 0:**

```asm
+191:  cmpq   $0x0,(%rbx)      ; x0 == 0 ?  -> exit
+195:  je     +259
```

**Một danh sách hình tròn không bao giờ có kết quả 0, để thử nghiệm đó không bao giờ bắn — nhưng một thử nghiệm đúng sẽ so sánh với
cái đầu.

- **(a) * Danh sách sẽ được dùng để kiểm tra** và giấy đăng ký kép là một lỗi trò chơi; hoặc
- **(b)** the list is **circular**, and the exit test comparing to `0` is wrong — **in the guest code, or
  trong sự thay đổi.**

** Trên các bằng chứng hiện nay trong tay, (b) là ít nhất có khả năng (a) và đó là lần đầu tiên đã được
sự thật.**

## 4 quyết định thế nào?

If the list is circular, the walk's true termination condition is `next == head`. The guest code would
Vì vậy, giữ đầu trong một đăng ký và so sánh với nó. **Rund 1 không thể tách ra cho thấy một so sánh
against the literal `0`, not against a register.** If the original AArch64 instruction compared two
registers (`cmp x0, xHead`), and the recompiled C++ compares `x0` to `0`, that is a **recompilation
khuyết tật** — và là một vấn đề nghiêm trọng, bởi vì nó sẽ là im lặng.

** Đây chưa được kiểm tra.** Nó là thứ giá trị nhất để kiểm tra tiếp theo, và nó rẻ:
disassemble the **original AArch64** at `main+0xd2f208` (the instruction just after the call at `+186`,
which the recompiler rendered as `+191: cmpq $0x0,(%rbx)`) and see what it actually compares.

## Vòng này chứng minh gì?

|Mục|Tình trạng|
|---|---|
|Người gọi thứ hai| ✅ **`main_00D1A3E8` = `main init[1364]`** |
|Đường| ✅ **init_module → call_preserving → nx::call → ctor → `main_00D0CB08` → AddVariable** |
|Ổ đĩa xây dựng hai lần|♪ Bị đánh đập ♪|
|Hai tor khác nhau đăng ký cùng một PGV| ✅ **follows** (with round 7's clean `init_array`) |
|Tự liên kết chính là tham nhũng.|♪ Không còn là người dẫn đầu ♪|
|Thiết kế danh sách hình tròn| 🟡 **now at least as likely**, and would make `GetNext` correct |
| Exit test compares to literal `0` |teppi82@ gmail. com|

## 6 Những gì điều này không xác minh

- **Có nên xác định danh sách này không.** Không có tài liệu hướng dẫn, không thực hiện thứ hai
  SDK's `PseudoGlobalVariableList` was consulted.
- **Sự so sánh nguyên bản của Aarch64 đã không được kiểm tra.** Đó là sự kiểm tra quyết định và nó đã không chạy.
- **`main_00D0CB08` was not resolved to a symbol** — the frame between the constructor and `AddVariable`.
- **`init[1364]`'s identity is uncertain**: the symbol lookup resolved `0xd1a3e8` to
  `nn::nex::SharedCounter<...>::DeletePointer+70`, which is implausible for a constructor and suggests the
  Độ lệch nằm bên trong một chức năng lớn hơn thay vì ở một biểu tượng bắt đầu.
- **Không có sửa chữa nào được thiết kế hoặc thực hiện.**
- **`nnMain` is still not reached.** No NVN, no window. **This is not a booted game.**

## 7. Tăng dần

**Disassemble the ORIGINAL AArch64 at `main+0xd2f208`** — the instruction the recompiler turned into
`cmpq $0x0,(%rbx)` at `+191`. Convert the NSO offset (`0x100 + (0x7100d2f208 - 0x7100000000)` =
file `0xd2f308`) and read 4 bytes.

- **`cmp xN, xM`** → the exit test compares two **registers**, the recompiled version dropped one, and this
  là một khiếm khuyết, nó giải thích hoàn toàn sự treo cổ.
- **`cmp xN, #0`** → the test really is against zero, the list really is null-terminated, and the double
  Đăng ký là lỗi chính đáng trong trò chơi hoặc trong cách cổng đã tới.

** Đọc 4-byte đó quyết định toàn bộ câu hỏi còn lại**, và nó chẳng tốn gì cả.
