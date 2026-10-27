# Điều kiện thoát ra, đọc: các vòng quay chờ đợi cho một vô giá trị không bao giờ đến

Round 13 disassembled `main_00D2F0F4` from its **start**. The exit condition is now known, and it
Giải quyết cái nĩa vòng 12 còn mở.

---

## 1, hình vòng thời gian

```asm
+105:  movabs 0x7102fc7520,%rax     ; rax = address of the LIST HEAD global
+108:  mov    (%rax),%rdx           ; rdx = *head        <- the list head value
+115:  ...
+126:  test   %rdx,%rdx             ; is the head NULL?
+129:  je     +249                  ; YES -> skip the loop entirely
+131:  movabs $0x7100d2f144,%rbp    ; (guest text address)
+141:  movabs $0x7100d2f130,%r12    ; (guest text address)
+151:  <--- LOOP HEAD
       mov    0xa0(%rbx),%rax       ; rax = the current node
       mov    (%rax),%rdx           ; rdx = node->field0
       mov    %rdx,0x40(%rbx)       ; set the guest call-target register
       mov    0x28(%rdx),%rsi
       mov    %rsi,0x40(%rbx)
       mov    %rax,(%rbx)           ; c.x[0] = node      (the call's argument)
       mov    %rbp,0xf0(%rbx)       ; return address
       call   nx::call(CPU&, ...)   ; --- guest call #1
+191:  cmpq   $0x0,(%rbx)           ; *** EXIT TEST: is c.x[0] == 0 ? ***
+195:  je     +259                  ; YES -> leave the loop
+197:  mov    0xa0(%rbx),%rax       ; no -> reload the node
       ...                          ; (same two-step target computation)
+219:  mov    %rax,(%rbx)           ; c.x[0] = node
+222:  mov    %r12,0xf0(%rbx)
+232:  call   nx::call(CPU&, ...)   ; --- guest call #2
+237:  mov    (%rbx),%rax           ; rax = c.x[0]  <- WHAT THE CALLEE RETURNED
+240:  mov    %rax,0xa0(%rbx)       ; node = that return value   <- ADVANCE
+247:  jmp    +151                  ; LOOP
```

## 2 nghĩa là gì?

**The loop is a list walk whose termination condition is `callee returned 0`:**

- the node is advanced **from the callee's return value in `x0`** (`+237`/`+240`), and
- the loop exits only when that return value is **null** (`+191`/`+195`).

**And the callee returns the node's `next`.** Round 12 measured that field directly:

```
0x710304fb90 + 8  ==  0x710304fb90        <- next points to itself
```

**So the walk is: `node → next → next → …`, and `next` is the node itself. It can never be null, so
the exit test at `+191` can never fire.**

## Ba, cái này giải quyết vòng 12

Hiệp 12 đưa ra hai bài đọc và không thể lựa chọn:

|Đang đọc|Lệnh nhập|
|---|---|
|**(1) Danh sách là hoàn toàn trống rỗng/ chu vi và chỉ kiểm tra quyết định * là sai|♪ Phát triển ♪|
| **(2)** The list is corrupt — a tail node's `next` should be null but is not |Xác nhận**|

**Reading (1) is disproved by `+126`/`+129`:** the code **already handles a null head correctly** — it
tests `test %rdx,%rdx; je +249` and skips the loop entirely. So the "empty list" case is implemented
và sẽ không quay. **Cái đầu không vô giá trị**, vì vậy danh sách không rỗng.

**Reading (2) is confirmed:** the list contains a node whose `next` points to itself instead of to
null. **Đó là một con bọ thực sự trong cách mà danh sách được xây dựng hay liên kết-- Kẻ hủy diệt đuôi là sai.**

## 4 là gì, về cơ khí

`nn::nex::PseudoGlobalVariableList::AddVariable` walks this list to insert a new
`PseudoGlobalVariableRoot`. For its walk to terminate, the list's last node must have `next == nullptr`.
**One node's `next` was written as itself.**

Hai cơ chế ứng cử viên, không được thử nghiệm:

1. **The node was never fully initialised** — `PseudoGlobalVariable<T>`'s constructor ran before its
   `next` field was cleared, so it holds a stale or self address.
2. **`AddVariable` linked the node to itself** — an off-by-one or a wrong base in the insertion path.

**Cái đầu tiên có khả năng hơn so với lịch sử của dự án này**: năm trong sáu con bọ được tìm thấy cho đến nay
Gặp lỗi khi tạo ra lỗi, không phải lỗi logic.

## Điều này chứng minh gì?

|Mục|Tình trạng|
|---|---|
|Điều kiện thoát| ✅ **`c.x[0] == 0` after the guest call** |
|Trả trước nút| ✅ **from the callee's return value in `x0`** |
|Xử lý sổ tay rỗng| ✅ **correct** (`test/je` at `+126`) |
|Đọc "Danh sách hình tròn tròn"|♪ Phát triển ♪|
| "Node's `next` should be null but isn't" |Xác nhận**|
|Mà nút / Tại sao|Không xác định được**|

## 6 Những gì điều này không xác minh

- **Which node is the bad one, and how it got a self-`next`, is unknown.** Only the node at
  `0x710304fb90` was inspected.
- **The guest function called at `+186`/`+232` was not identified by name** — it is the one returning
  `next`, and naming it would confirm the mechanism.
- ** Cũng không có cơ chế ứng cử viên nào được kiểm tra.**
- **Không có sửa chữa nào được thiết kế hoặc thực hiện.**
- **`main`'s total constructor count is still unknown**; `nnMain` still not reached.
- **Không NVN, không cửa sổ, không trình bày.** Hiển thị và âm thanh là các chấm.

## 7. Tăng dần

Hai bước rẻ tiền, một trong hai bước xác nhận cơ chế:

1. **Name the callee**: resolve the `0x40(%rbx)` target computation at `+158`/`+165` (`node->field0`,
   then `+0x28`) to a symbol — it should be a virtual `PseudoGlobalVariableRoot` method, likely
   `GetNext`/`GetVariableList`.
2. **Check `AddVariable`'s insertion**: disassemble it and see whether the "list empty" branch writes
   `head = node; node->next = nullptr` or mistakenly writes `node->next = node`.

Bước 2 là con đường trực tiếp hơn đến những khuyết điểm thực sự và không cần quá trình chạy.
