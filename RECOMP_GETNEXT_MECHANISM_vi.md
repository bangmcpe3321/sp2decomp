# Mechanism identified: `GetNext()` returns `this`, and `.bss` proves it was written at runtime

Vòng 1/12 của mục tiêu mới đã tạo ra kết quả mạnh nhất: chủ nghĩa cơ khí **
and the `.bss` evidence proves it was **written at runtime** rather than being a static-initialiser
Đồ cổ.

---

## 1. 2 sự kiện chỉnh lại lỗi

**Fact 1 — the node lives in `.bss`.** `main`'s section layout:

|Phần|Phạm vi|
|---|---|
|chữ| `0x0000000 .. 0x1415068` |
|tubeta| `0x1416000 .. 0x2d5a063` |
|dữ liệu| `0x2d63000 .. 0x2fdb1b0` |
|**bss**| **`0x2fdb1b0 ..`** |

**`0x304fb90` is in `.bss`, which is zero-initialised at load.**

**Fact 2 — at the hang, its `+8` word is its own address.**

```
0x710304fb90 + 0x00:  0x0000007102ef98a8
0x710304fb90 + 0x08:  0x000000710304fb90   <- the node's OWN address
```

**`.bss` starts as all zeros, so `0x710304fb90` at `+8` did not come from the image. Something wrote it
lúc chạy.**

**That is the defect, stated precisely: a constructor or a setter wrote a node's `next` pointer to the
bản thân cái nút.

## 2. `GetNext` / `SetNext` exist — and name the mechanism

`main`'s symbol table contains, per instantiation:

```
_ZN2nn3nex20PseudoGlobalVariableI18SendMultiParameterE7GetNextEv
_ZN2nn3nex20PseudoGlobalVariableI18SendMultiParameterE7SetNextEPNS0_24PseudoGlobalVariableRootE
```

**`PseudoGlobalVariable<T>` has `GetNext()` and `SetNext(PseudoGlobalVariableRoot*)`.**

Now re-read `AddVariable`'s loop with that knowledge:

```asm
+151:  mov 0xa0(%rbx),%rax    ; rax = current node
+158:  mov (%rax),%rdx        ; rdx = node->field0        (the vtable-like object)
+165:  mov 0x28(%rdx),%rsi    ; rsi = *(field0 + 0x28)    <- A VIRTUAL SLOT
+173:  mov %rax,(%rbx)        ; c.x[0] = node             <- `this` for the call
+186:  call nx::call(...)     ; call slot: returns the LOOP CONDITION
+191:  cmpq $0x0,(%rbx)       ; x0 == 0 ?  -> exit
+197:  mov 0xa0(%rbx),%rax    ; reload the node
+219:  mov %rax,(%rbx)        ; c.x[0] = node             <- `this` again
+232:  call nx::call(...)     ; call slot: returns THE NEXT NODE
+237:  mov (%rbx),%rax        ; rax = return value
+240:  mov %rax,0xa0(%rbx)    ; node = next
+247:  jmp +151
```

**`c.x[0]` is the AArch64 `this` register.** Both calls are `node->method()`. The second call's return
value becomes the new node — **that is `GetNext()`.**

**So the loop is `for (node = head; node; node = node->GetNext())` — and it never terminates because
`GetNext()` returns the node itself.**

**Which means a prior `SetNext(this)` wrote the self-reference.** `SetNext` is exactly the setter that
sẽ làm điều đó, và nó tồn tại trên bảng biểu tượng.

## 3. Điều này chứng minh gì?

|Mục|Tình trạng|
|---|---|
| The node is in `.bss` |♪ Được xác nhận bởi một phần số học**|
| `.bss` is zero at load |Tuỳ chọn|
| So `+8 = self` was **written at runtime** |* Theo đuổi nhất thiết phải**|
| `GetNext()`/`SetNext()` exist |hạ cả hai trên bảng biểu tượng|
| The loop calls `GetNext()` and advances on its return | ✅ from the `this`-register pattern |
| **Mechanism: `GetNext()` returns `this` because a prior `SetNext(this)` wrote it** |♪ Xem xét mọi bằng chứng ♪|
| Which code called `SetNext(this)` |Không xác định được**|

## 4 Những gì điều này không xác minh

- **Which `SetNext(this)` call produced it was not found.** `SetNext` has many call sites; locating the
  Một người vượt qua được chính người nhận là nhiệm vụ còn lại, và đó là một cuộc tìm kiếm tĩnh.
- **The first call's slot (`+0x28`) was not named** — it decides the loop condition, and it is a
  different virtual slot from `GetNext`.
- **The `+0` word (`0x7102ef98a8`) was not interpreted** — it may be the vtable-like object, and
  `field0 + 0x28` being a real vtable slot is inferred, not proven.
- **Không có sửa chữa nào được thiết kế hoặc thực hiện.**
- **`main`'s total constructor count is still unknown**; `nnMain` still not reached.
- **Không NVN, không cửa sổ, không trình bày.** Hiển thị và âm thanh là các chấm.
- **Đây không phải trò chơi khởi động.**

## 5. Tăng dần

**Find the `SetNext` call whose argument is its own receiver.** Static search over `main`'s functions for
calls to a `SetNext` symbol where `x0 == x1` at the call. That is the writer, and naming it turns this
từ cơ chế đến nguyên nhân gốc.

Second, cheaper check: **re-read the node's `+0` word.** If `field0 + 0x28` is `GetNext`, the mechanism
đã được chứng minh đầy đủ; nếu nó là một vị trí khác, vòng lặp đang làm một cái gì đó khác và phân tích này cần
chỉnh sửa.
