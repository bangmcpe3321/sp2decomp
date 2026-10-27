# `AddVariable` *is* the spinning function — and its empty-list branch is correct

Round 14. A useful correction first: `gdb` refused the symbol lookup because **`0xd2f0f4` resolves to
`AddVariable` itself** — the function already disassembled in round 13. **The loop and the insertion
logic là cùng một chức năng.** Nó loại bỏ một bước ra khỏi kế hoạch, và các kết nối đã có câu trả lời
câu hỏi.

---

## 1. chi nhánh rỗng, từ bãi rác vòng 13

```
+105:  movabs 0x7102fc7520,%rax    ; rax = address of the head global
+108:  mov    (%rax),%rdx          ; rdx = head value
+115:  mov    0x8(%rdi),%rcx       ; rcx = c.x[1]  = the NEW NODE (AddVariable's argument)
+119:  mov    %rcx,0x98(%rdi)      ; stash it
+126:  test   %rdx,%rdx            ; is head NULL?
+129:  je     +249                 ; YES -> the EMPTY-LIST branch
...
+249:  mov    %rcx,(%rax)          ; *head = node      <-- head = node  (CORRECT)
+252:  mov    $0x1,%edx            ; edx = 1
+257:  jmp    +339
...
+339:  mov    %rdx,0x40(%rbx)      ; set the guest register
+353:  movabs 0x7102fc75b0,%rax
+357:  mov    %edx,(%rax)          ; *(0x7102fc75b0) = 1   (a count / flag)
```

**The empty-list path is correct: it writes `head = node` and sets a count-or-flag to 1.** There is no
`head = node` fault and no self-link here.

## 2. Vì vậy, các lỗi không phải là trong chèn vào danh sách rỗng

**This is the decisive result of the round.** Round 13 asked whether `AddVariable` writes
`node->next = node` on the empty path. **It does not.** Which means:

1. **The list was not empty when the spin happened.** `+126`/`+129` did not take the empty branch — and
   vòng 13 đã chứng minh cái đầu là không có đầu, bởi vì một đầu vô giá trị sẽ đã bỏ qua vòng lặp
   Hoàn toàn không quay.
2. **Sự tham chiếu bản thân nằm trong một nút đã được liên kết trước đó**, không phải được tạo ra bởi cuộc gọi này.
3. **The defect is therefore in the new node's own initialisation** — the `PseudoGlobalVariable<T>`
   constructor that runs *before* `AddVariable` — or in an earlier insertion.

** Đây chính xác là cơ chế ứng cử viên (1) từ vòng 13, bây giờ là cơ chế duy nhất còn lại:**

> *The node was never fully initialised — `PseudoGlobalVariable<T>`'s constructor ran before its
> `next`-equivalent field was cleared, so it holds a stale or self address.*

Candidate (2) — "`AddVariable` linked the node to itself" — is **eliminated** by reading its own empty
Chi nhánh.

## 3. Những gì đi bộ thực sự đi qua

Từ vòng lặp cơ thể:

```
+151:  mov 0xa0(%rbx),%rax    ; rax = current node
+158:  mov (%rax),%rdx        ; rdx = node->field0
+165:  mov 0x28(%rdx),%rsi    ; rsi = *(field0 + 0x28)   <- a FUNCTION POINTER
+169:  mov %rsi,0x40(%rbx)
+173:  mov %rax,(%rbx)        ; c.x[0] = node
+186:  call nx::call(...)     ; call it
```

So the traversal is **`node->field0` is a vtable-like object, and `+0x28` in it is the callback that
yields the next node.** The node does not hold `next` directly at `+8` for this purpose — the `+8`
từ được đo trong vòng 12 là lĩnh vực xảy ra để bằng địa chỉ của chính nút.

**So the self-reference is in `node->field0`'s chain, or in the callback's return.** Round 12 measured
`*(node+8) == node`; round 13 showed the exit test is `x0 == 0` after the call. **The two are consistent
Chỉ khi nào bản thân cái lõi gọi lại.

**I should be careful here:** I have not proven that the `+8` word is the same field the callback
Liên kết đó bị vô hiệu hóa, không phải đo lường.

## 4 hiệp này là gì?

|Mục|Tình trạng|
|---|---|
| `AddVariable` **is** `main_00D2F0F4` |▪ Xác nhận (gdb giải quyết việc bù đắp cho biểu tượng)|
| Empty-list branch writes `head = node` |Chính xác.|
| `AddVariable` self-links on empty insert |♪ Bị đánh đập ♪|
|Danh sách là không rỗng tại quay| ✅ follows from `+126` not being taken |
|& Ngắt là khởi tạo|♪ Chỉ còn lại ứng cử viên**|
|Mở rộng / chính xác tác giả|Không xác định được**|

## 5 Điều này không xác minh

- **`PseudoGlobalVariable<T>`'s constructor was not disassembled.** That is now the prime suspect and it
  vẫn chưa được đọc.
- **The claim that the `+8` word is the field the callback returns is inferred, not measured.**
- **The callback at `field0 + 0x28` was not named.**
- **Không có sửa chữa nào được thiết kế hoặc thực hiện.**
- **`main`'s total constructor count is still unknown**; `nnMain` still not reached.
- **Không NVN, không cửa sổ, không trình bày.** Hiển thị và âm thanh là các chấm.
- **Đây không phải trò chơi khởi động.**

## 6. Tăng dần

**Disassemble `nn::nex::PseudoGlobalVariable<nn::nex::StreamSettings>::PseudoGlobalVariable()`
(`main_00D5A238`), statically.** It is the only remaining suspect: it runs immediately before
`AddVariable` and is responsible for putting the new node into a known state. Look for whether it
writes the `next`/`field0` word at all, and what it writes.

tĩnh lặng, rẻ tiền, và nó hoặc đặt tên các khiếm khuyết hoặc loại bỏ các ứng cử viên cuối cùng và di chuyển nghi ngờ
into `PseudoGlobalVariableRoot`'s constructor.
