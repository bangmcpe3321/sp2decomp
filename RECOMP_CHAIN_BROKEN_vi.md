# Dây xích không đi được và cần phải nối lại con đường trỏ số 2

Vòng 5/12.
path round 2 used to resolve `GetNext`. Recording the raw measurements and the open doubt rather than
Xây thêm trên chúng.

---

## Những gì các dấu vết thực sự đã trở lại

```
head = 0x7103650160
  [ 0] node=0x7103650160   vptr=0x710304fb90   next=0x3d
  [ 1] node=0x3d           -> Cannot access memory at address 0x3d
```

Đọc là bộ nhớ thô:

|Địa chỉ|Giá trị|
|---|---|
| `0x7102fc7520` (the "head" global) | `0x7103650160` |
| `0x7103650160 + 0x00` | `0x710304fb90` |
| `0x7103650160 + 0x08` | **`0x3d`** |
| `0x710304fb90 + 0x00` | `0x7102ef98a8` (a `.data` vtable) |
| `0x710304fb90 + 0x08` | `0x710304fb90` (itself) |

**`0x3d` is not a pointer.** So whatever `0x7103650160` is, treating it as a list node with
`{vptr, next}` gives a nonsense `next` at the very first step.

## 2. Điều đó có nghĩa gì — hai khả năng, chưa được thiết lập

**(a) `0x7103650160` is not the list head.** I assumed `*(main+0x2fc7520)` is the PseudoGlobalVariable
list head because `AddVariable` loads it at `+105`/`+108`. It may be a different structure, or the global
Có thể giữ một cái gì đó khác (một Alloctor, một khóa, một bảng) và đầu thật được đạt thông qua một nữa
theo hướng lạc hướng.

**(b) The chain is corrupt from the first node.** Less likely, because `0x3d` looks like a small integer
(a đếm, một trạng thái) chứ không phải một con trỏ bị hỏng — mà chỉ ngược lại (a) về (a).

**Trên bằng chứng, (a) là đọc kinh tế nhiều hơn.**

## 3. Điều này đặt vòng 2 của độ phân giải vtable trong nghi ngờ

`AddVariable`'s loop computes its call target as:

```asm
+151:  mov 0xa0(%rbx),%rax    ; rax = the current walk cursor
+158:  mov (%rax),%rdx        ; rdx = *(cursor)
+165:  mov 0x28(%rdx),%rsi    ; rsi = *(rdx + 0x28)   <- the call target
```

**Round 2 resolved the slot as `*(*(0x710304fb90) + 0x28)` = `*(0x7102ef98a8 + 0x28)` = `GetNext`.**

**But that is only correct if the walk cursor was `0x710304fb90` at that moment.** If the cursor was
`0x7103650160`, the code computes `*(*(0x7103650160) + 0x28)` = `*(0x710304fb90 + 0x28)` — **a different
address, and one in `.bss` which was zero at load.**

**Both are consistent with the gdb stack**: the spin is at `+222`/`+232`, and by then the cursor has been
overwritten at `+240` from the previous iteration's return value. So round 2's reading may have been of
địa điểm gọi trong khi cuộc gọi đầu tiên được sử dụng.

**I cannot tell, from what has been measured, which pointer path produced `0x7102ef98a8`.**
`*(0x710304fb90) = 0x7102ef98a8` is a fact; that the loop read *through* it is an inference.

## 4 hiệp này là gì?

|Mục|Tình trạng|
|---|---|
|Bộ nhớ thô ở đầu và lõi|teppi82@ gmail. com|
| `head`'s `+8` is `0x3d`, not a pointer |♪ Phát triển ♪|
|Đối xử với cái đầu như một cái nút danh sách là sai|♪ Đi theo ♪|
| The PGV list head is `0x7102ef98a8`-style node at `0x710304fb90`? |Không thể thành lập**|
| Round 2's `GetNext` resolution |**vald là một sự thật về địa chỉ đó, nhưng con đường con trỏ không được sửa chữa**|
|Lặp lại đăng ký|Không được thử nghiệm vòng này; không bị ảnh hưởng nhưng chưa được chứng minh|

## 5 Điều này không xác minh

- *Cái đầu danh sách thực sự của PseudoGlobalvariable không được xác định.** Đó là cái chắn chưa biết.
- **The structure at `0x7103650160` was not identified** — its `+0` is a pointer to the node and `+8` is
  `0x3d`, which does not match `{vptr, next}`.
- **Whether `0x710304fb90` is a list node at all is not independently confirmed** — its `+0` looks like a
  `.data` vtable and its `+8` is self, which *is* node-shaped, but that is shape-matching, not proof.
- **Rund 2's vtable board đã không được sửa lại theo con đường con trỏ chính xác.**
- **Không có sửa chữa nào được thiết kế hoặc thực hiện.**
- **`main`'s total constructor count is still unknown**; `nnMain` still not reached.
- **Không NVN, không cửa sổ, không trình bày.** Hiển thị và âm thanh là các chấm.
- **Đây không phải trò chơi khởi động.**

## 6. Tăng dần

**Establish con trỏ thật tại spin.** Tại treo, đọc giá trị của con trỏ đi bộ — khách
register slot the code uses at `0xa0(%rbx)`, i.e. `c.x[N]` — rather than recomputing the pointer path by
Sau đó:

- if the cursor is `0x710304fb90`, round 2's resolution is **valid** and `GetNext` stands;
- Nếu là cái gì khác, bàn chơi trò chơi của ** Quanh 2 phải được rút lại** cho vòng lặp này và tái định cư.

That is one gdb read of `c` at the suspended PC and it removes the remaining inference from the whole
Một chuỗi lý luận.
