# Nguyên nhân gốc: nhân đôi liên kết một nút tới chính nó

Round 3/12. `SetNext`'s offset is confirmed, `AddVariable`'s **non-empty** insertion path is read, and
the two together **explain the observed `m_pNext == this` exactly**. Plus one correction to my own
vòng 2 lo lắng.

---

## 1. `SetNext` writes `*(this + 8)` — confirmed

```asm
SetNext(n)  main_00D181E0:
  +0:  endbr64                 (host preamble)
  +4:  mov (%rdi),%rax         ; rax = c.x[0]  = this
  +7:  mov 0x8(%rdi),%rdx      ; rdx = c.x[1]  = the argument
  +11: mov %rdx,0x8(%rax)      ; *(this + 8) = argument    <-- WRITES +8
  +15: ret
```

**`SetNext` is exactly `this->m_pNext = n`.** So it *is* the writer of the field round 2 measured as
tự đánh giá mình.

## 2. Các vtable đầy đủ, đọc thẳng từ hình ảnh thô

Reading the unrelocated `.data` at the vtable's file offset — no running process:

|Khe|Giá trị|Ký hiệu|
|---|---|---|
| `+0x00` | `0xd0cc20` | `~PseudoGlobalVariable()` (D2) |
| `+0x08` | `0xd17f60` | `~PseudoGlobalVariable()` (D0) |
| `+0x10` | `0xd17fcc` | `AllocateExtraContexts()` |
| `+0x18` | `0xd18108` | `FreeExtraContexts()` |
| `+0x20` | `0xd18198` | `ResetContext(unsigned)` |
| `+0x28` | `0xd181d8` | **`GetNext()`** |
| **`+0x30`** | **`0xd181e0`** | **`SetNext()`** |
| `+0x38` | `0xd181e8` |(một phương pháp khác, không tên)|

## 3. `AddVariable`'s non-empty path is `tail->SetNext(new_node)`

From round 13's dump of `main_00D2F0F4`, the code reached when the walk **exits**:

```asm
+259:  mov 0xa0(%rbx),%rax    ; rax = node  (the tail the walk stopped on)
+266:  mov (%rax),%rdx        ; rdx = node->vptr
+273:  mov 0x30(%rdx),%rsi    ; rsi = vptr[+0x30]  == SetNext
+281:  mov %rax,(%rbx)        ; x0 = node        <- `this`
+284:  mov 0x98(%rbx),%rax    ; rax = the NEW node (AddVariable's argument)
+291:  mov %rax,0x8(%rbx)     ; x1 = the NEW node <- the argument to SetNext
+315:  call nx::call(...)      ; *** tail->SetNext(new_node) ***
```

**That linking is correct in isolation.** `+0x18` of `c` is `x1`, and it is set to the new node right
before the call — so the call is `SetNext(new_node)`, not `SetNext(tail)`.

## Suy luận đó giải thích tất cả

**Nếu một nút được thêm vào danh sách trong khi nó đã sẵn sàng * thành phần duy nhất trong đó:**

1. the walk starts at `head`, which is that node;
2. `GetNext()` returns `m_pNext`, which is **already 0** for a `.bss` static — so the walk stops at once
   with `node == head == the node itself`;
3. the insertion then runs `node->SetNext(new_node)` where **`new_node` is the same object**;
4. **`*(this + 8) = this`** → `m_pNext = this`;
5. bước đi không bao giờ chấm dứt, đó chính là sự treo cổ.

** Mọi sự thật quan sát đều nằm ngoài chuyện này:**

|Quan sát|Giải thích|
|---|---|
| `m_pNext == this` |bước 4|
| `.bss` was zero, so it was written at runtime |bước 4 viết nó|
| The writer is `SetNext` |Xác nhận ở trên|
| The loop advances via `GetNext()` and exits on 0 |vòng 1–2|
|Đi bộ dừng lại ngay lập tức (không có nút khác)|Bước 2|

**So the root cause is a DUPLICATE REGISTRATION: `PseudoGlobalVariable<SendMultiParameter>` had
`AddVariable` called on it twice.**

** Đây là giả thuyết mô phỏng chính xác tình trạng, chứ không phải bằng chứng** — nó không được quan sát thấy.

## Năm, một sự sửa đổi cho lo lắng của riêng tôi vòng hai

In round 2 I flagged that `GetNext` at `0xd181d8` "disassembles to 15 bytes" and therefore **overlapped**
`SetNext` at `0xd181e0`, suggesting an inconsistent symbol table.

**That was my error.** Those 15 bytes are *host* bytes; `endbr64` is a recompiler preamble, and
`mov %rax,(%rdi)` is the write-back of the destination register, not a third guest instruction.
**`GetNext` is 2 guest instructions (`ldr x0,[x0,#8]` / `ret`) = 8 bytes: `0xd181d8..0xd181df`. `SetNext`
at `0xd181e0` follows exactly. There is no overlap and no symbol-table inconsistency.**

## 6, điều này chứng minh gì?

|Mục|Tình trạng|
|---|---|
| `SetNext` writes `+8` |♪ Xác nhận bằng cách tách rời ♪|
| `vtable[+0x30] == SetNext` |♪ Đọc từ hình ảnh thô ♪|
| `AddVariable` links with `tail->SetNext(new_node)` |Đã xác nhận (x1 đặt trước cuộc gọi)|
| `m_pNext == this` requires `tail == new_node` |_Gỡm theo|
|**Duplicate đăng ký tái tạo chính xác bang**|chứ không phải quan sát**|
| `GetNext`/`SetNext` overlap worry |Tôi đã hiểu nhầm|

## 7 Những gì điều này không xác minh

- **The duplicate `AddVariable` call was not observed.** Nothing yet shows the same node being added
  Hai lần; đó là suy ra từ nhà nước nó sẽ sản xuất.
- **Tại sao một bản sao lại xảy ra không rõ** — một mục nhập quay phim lặp đi lặp lại, hoặc trò chơi gọi
  `AddVariable` itself.
- **The `+0x38` vtable slot was not named.**
- **Không có sửa chữa nào được thiết kế hoặc thực hiện.**
- **`main`'s total constructor count is still unknown**; `nnMain` still not reached.
- **Không NVN, không cửa sổ, không trình bày.** Hiển thị và âm thanh là các chấm.
- **Đây không phải trò chơi khởi động.**

## 8 Thêm vào

**Observe the duplicate directly.** Log every `AddVariable` entry with its argument address and the
current head, via a hook on `main+0xd2f0f4`. If the same pointer appears twice, the duplicate is proven;
Nếu không, giả thuyết này chết và tự liên kết phải đến từ một nơi khác.
Công cụ thay đổi và nó giải quyết câu hỏi bằng cách nào đó.
