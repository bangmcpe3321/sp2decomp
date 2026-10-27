# Khách có hai lần thử ra; vòng lặp được sửa chữa cho thấy chỉ có một

Vòng 10/12. quét dòng kiểm soát xung quanh đi bộ tìm thấy một cái gì đó mà ** thay đổi kết luận
một lần nữa** - và lần này nó chỉ vào bộ đếm, không phải trò chơi.

---

## 1. kiểm soát của khách dòng chảy xung quanh đi bộ

```
0xd2f1a4:  eb13001f   cmp  x0, x19      <== REGISTER compare
0xd2f1a8:  540001a0   b.eq +0x34
0xd2f1ac:  b40004a0   cbz  x0, +0x94    <== ZERO test
...
0xd2f1b8:  eb1302bf   cmp  x21, x19     <== REGISTER compare
0xd2f1bc:  540001c0   b.eq +0x38
0xd2f1d4:  b5ffff00   cbnz x0, +0x1fffe0
0xd2f1d8:  1400001a   b    +0x68
```

Có hai điều kiện để thoát ra, không phải một.

1. **`cmp x0, x19; b.eq`** — stop when the cursor equals **`x19`**
2. **`cbz x0`** — stop when the cursor is **null**

And the same pair appears again with `x21` at `0xd2f1b8`/`0xd2f1bc`.

## 2. Những gì các mã tái sử dụng thực hiện

Round 1's disassembly of `main_00D2F0F4` shows the loop's exit as:

```asm
+191:  cmpq   $0x0,(%rbx)      ; x0 == 0 ?
+195:  je     +259             ; exit
```

**Only the zero test.** The `cmp x0, x19` comparison — a comparison against **a saved guest register** —
**does not appear at `+191`.**

## 3 Kết quả, và tại sao nó giải thích vụ treo cổ

If the guest's walk is `while (x0 != x19 && x0 != 0)`, then **`x19` acts as a sentinel**, and the walk is
được thiết kế để **Dừng lại khi nó trở về chỗ lính canh**.

Dưới sự thiết kế đó, trạng thái "tiểu thức" được tìm thấy ở vòng 7–9 không phải là sự tham nhũng ở tất cả** — cái đuôi chỉ
back to the sentinel is **the intended structure**, and `cmp x0, x19` is exactly the test that handles it.

**But the recompiled loop only tests for zero.** A cursor equal to `x19` is non-zero, so the test never
Những đám cháy và những vòng thời gian quay, chính xác là cái treo lơ lửng.

** Trong phần này:**

|Tròn|Kết luận|Trạng thái|
|---|---|---|
| 7 |Bản sao đăng ký đã chứng minh|♪ Vẫn đúng như một sự quan sát ♪|
| 8 |Cổng không thể quay hai lần|♪ Vẫn đúng ♪|
| 9 |Danh sách là vô hiệu hóa, vì vậy tự liên kết là tham nhũng| ❌ **weakened** — `x19` sentinel complicates it |
| **10** |**Người đi bộ có đăng ký vòng thời gian không có**|nhưng chưa chứng minh được.|

## Tại sao tôi không gọi nó là chứng minh

** Bản đồ từ hướng dẫn khách truy cập để phục hồi máy bù đắp đã được thực hiện bằng tay và đã được sai trước khi
in this project** (the `GetNext`/`SetNext` "overlap" in round 2, the off-by-one indirection in round 5).
Có hai lời giải thích sống động và tôi vẫn chưa thể tách chúng ra:

**(a)** The recompiler **dropped** the `cmp x0, x19` exit test. That would be a serious recompilation defect
Và sẽ giải thích hoàn toàn về vụ treo cổ.

**(b)** My mapping is incomplete — the comparison **is** emitted somewhere in `main_00D2F0F4` and I have not
looked at enough of the function to see it. Round 1's dump covered `+0` to about `+399`, which is less than
Toàn bộ chức năng.

**Hãy phân biệt chúng là rẻ và phải được thực hiện trước khi có bất kỳ yêu cầu nào.**

## Vòng này chứng minh gì?

|Mục|Tình trạng|
|---|---|
| Guest walk has a **register** exit test (`cmp x0, x19`) |** Đọc từ hình ảnh **|
| Guest walk also has a **zero** exit test (`cbz x0`) |▪ Đọc từ ảnh|
| Recompiled `+191` tests only zero |Quan sát thấy ở bãi rác vòng 1|
| A second register compare exists (`cmp x21, x19`) |Phát âm thanh:|
|Bộ tháo gỡ lại đã làm rớt bài kiểm tra bộ nhớ|Không thể thay đổi được, không thể chứng minh được**|
|Bản đồ của tôi không đầy đủ|♪ hợp lý một cách bình thường**|
|Tự liên kết chính là tham nhũng.|♪ Không còn chắc chắn ♪|

## 6 Những gì điều này không xác minh

- ** Giải thích (a) hoặc (b) không được xác định.** Đây là toàn bộ câu hỏi bây giờ.
- **What `x19` holds was not determined.** It is *presumed* to be a sentinel/head pointer, because it is
  so sánh với con chạy; đó là suy luận.
- ** Chức năng phục hồi chưa được đọc đầy đủ**, do đó (b) không thể loại trừ.
- **Round 9's null-termination reading is not retracted, only weakened** — `SetNext(node, nullptr)` is real,
  Và cả một Kẻ hủy diệt vô sinh và một so sánh lính canh có thể tồn tại cùng một thời gian.
- **Không có sửa chữa nào được thiết kế hoặc thực hiện.**
- **`nnMain` is still not reached.** No NVN, no window. **This is not a booted game.**

## 7. Tăng dần

**Read `main_00D2F0F4` in full and look for a guest-register comparison.** Specifically: does the recompiled
function ever load a saved guest register and `cmp` it against the cursor (`0xa0(%rbx)`), in the way the
guest's `cmp x0, x19` requires?

- **Nếu nó không**, giải thích (b) giữ, recomiler là tốt, và tìm kiếm trở lại dữ liệu.
- **Nếu nó không**, lời giải thích (a) giữ lại và đây là một lỗi chính tả** — cho đến nay là nhiều nhất
  Kết quả của việc tìm kiếm toàn bộ dự án, bởi vì nó có nghĩa là các mã tạo ra là âm thầm sai
  theo một cách nào đó thì chưa có bài kiểm tra nào.

`objdump -d --start-address` over the host function, grep for `0xa0(` loads paired with `cmp`, is enough.
