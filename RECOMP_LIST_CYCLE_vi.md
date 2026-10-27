# The cycle, confirmed by memory: a list node whose `next` points to itself

Vòng 12 đọc được bộ nhớ thật tại vòng quay.
Kiểm tra**, không phải suy luận.

---

## Một, nút là tự suy luận

At the hang, from `gdb`:

```
rax  0x710304fb90
x/2gx 0x710304fb90:
  0x710304fb90:  0x0000007102ef98a8   0x000000710304fb90
```

**The word at `0x710304fb90 + 8` is `0x710304fb90` — the node's `next` field points to the node
bản thân.**

Any traversal that follows `next` from this node returns to it, forever. **That is the loop.** No
yêu cầu suy luận.

## Vòng thời gian, từ sự bế tắc

```
+151:  mov    0xa0(%rbx),%rax     ; rax = c.x[N]  (the list node)
       mov    (%rax),%rdx         ; rdx = node->field0
       mov    %rdx,0x40(%rbx)
       mov    0x28(%rdx),%rsi
       mov    %rsi,0x40(%rbx)
       mov    %rax,(%rbx)         ; c.x[0] = node
+222:  mov    %r12,0xf0(%rbx)
       mov    %rbx,%rdi
       call   nx::call(CPU&, ...) ; <-- calls guest code each iteration
       mov    (%rbx),%rax
       mov    %rax,0xa0(%rbx)     ; node = c.x[0]  -> UNCHANGED, still the same node
       jmp    +151                ; LOOP FOREVER
```

`rbx` is the `CPU&` (host address `0x567bda9b0fc0`); the internal offsets `0xa0`, `0x40`, `0xf0` are
**guest register slots inside the CPU struct**, and `r12 = 0x7100d2f130` is a **guest text address** in
`main`. So this is a recompiled guest `while` loop that calls a guest function each iteration and
Đọc lại một con trỏ không bao giờ thay đổi.

## 3. Nguyên nhân căn bản gây ra hiện tại là gì — và không phải là gì

Dự đoán hàng đầu của vòng 11 là * "đầu của lính canh không bao giờ được khởi động, vì vậy danh sách là zero hoặc
tự đánh giá bản thân."

**The self-referential part is confirmed; the "never initialised" part is not.** A node whose `next`
bản thân nó cũng là dạng thức lính canh bình thường của một danh sách vòng tròn trống.
Đọc và ký ức chưa phân biệt chúng:

1. **Các danh sách là hợp pháp trống rỗng và vòng tròn** (đầu_BAR_) và kết thúc *raversal
   kiểm tra * là những gì thất bại — nó nên dừng lại khi nó trở về đầu, và không.
2. **The list is corrupt** — insertion wrote `next = self` on a node that should have been linked
   Nơi khác hoặc bị kết thúc với vô giá trị.

** Đọc 1 ít nhất cũng giống như đọc 2**, và tôi muốn nói rõ rằng vòng trước
khung quá khó khăn cho tham nhũng câu hỏi quyết định bây giờ là hẹp:
điều kiện, và tại sao nó không bao giờ thỏa mãn?

## Điều này chứng minh gì?

|Mục|Tình trạng|
|---|---|
| `next` points to itself |♪ Được xác nhận bởi trí nhớ**|
|Vòng lặp đọc lại một con trỏ chưa thay đổi|♪ Xác nhận bằng cách tách rời ♪|
|Một cuộc gọi khách được thực hiện mỗi lặp lại| ✅ confirmed (so the spin is not a bare `jmp`; it burns more than a tight loop) |
|Nguyên nhân gốc là "danh sách chưa được kích hoạt"|**Không có thiết lập** - vòng tròn là một đọc có giá trị ngang nhau|
|Điều kiện thoát Vòng lặp|_Không xác định được|

## 5 Điều này không xác minh

- Tình trạng kết thúc của vòng thời gian chưa được đọc.** Đó là sự thật còn thiếu.
- **Cho dù danh sách là hoàn toàn trống rỗng hay thối nát không được giải quyết.** Cả hai đều phù hợp với bộ nhớ.
- **`PseudoGlobalVariableList`'s own constructor was not checked** against the constructor log.
- ** Vòng thời gian không bị hỏng**; không có sửa chữa nào được thiết kế hoặc thử nghiệm.
- **`main`'s total constructor count is still unknown**; `nnMain` still not reached.
- **The `nx::call` target each iteration was not identified** — it may be the guest function whose
  Phản ứng phụ lẽ ra phải nâng cao danh sách.
- **Không NVN, không cửa sổ, không trình bày.** Hiển thị và âm thanh là các chấm.

## 6. Tăng dần

Read the **exit condition**: disassemble `main_00D2F0F4` from its start (not from `+151`), so the
So sánh kết thúc vòng lặp là thấy được, và xác định vòng lặp đang so sánh với cái gì.
So sánh với một con trỏ đầu chưa bao giờ được thiết lập, đó là con bọ; nếu nó so sánh với một máy đếm
Hay một đáp ứng dịch vụ, sự quay vòng là một * chờ đợi trên một cái gì đó HLE không bao giờ cung cấp — mà sẽ đặt nó
back in the "no real service behind `nex`" category.

Hoặc trả lời là một gắn vào, và máy gỡ lỗi đã được cài đặt.
