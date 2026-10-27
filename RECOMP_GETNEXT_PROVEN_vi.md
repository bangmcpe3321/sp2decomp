# Mechanism fully proven: `GetNext()` is `return *(this+8)`, and that field is the node itself

Hiệp 2/12.
từ bộ nhớ và ký ức, và danh tính của khuyết điểm được đặt tên.

---

## 1. The vtable slot is `GetNext` — resolved

The loop computes its call target as `*(node->field0 + 0x28)`. Reading that memory at the hang:

```
node->field0 = 0x7102ef98a8
*(0x7102ef98a8 + 0x28) = 0x7100d181d8
```

Resolving every slot of that vtable against `main`'s 146,622 symbol entries:

|Khe|Ký hiệu|
|---|---|
| `+0x00` | `PseudoGlobalVariable<SendMultiParameter>::~PseudoGlobalVariable()` (D2) |
| `+0x08` | `PseudoGlobalVariable<SendMultiParameter>::~PseudoGlobalVariable()` (D0) |
| `+0x10` | `AllocateExtraContexts()` |
| `+0x18` | `FreeExtraContexts()` |
| `+0x20` | `ResetContext(unsigned)` |
| **`+0x28`** | **`GetNext()`** ← **the slot the loop calls** |

**This also names the object:** the bad node is **`PseudoGlobalVariable<nn::nex::SendMultiParameter>`**,
not `<StreamSettings>` as earlier rounds assumed when looking at the *symptom's* call.

## 2. `GetNext()` reads offset +8 — and that field is the node

```asm
GetNext()  main_00D181D8:
  +4:  mov (%rdi),%rax      ; rax = c.x[0]   (the ABI `this`)
  +7:  mov 0x8(%rax),%rax   ; rax = *(this + 8)     <-- READS OFFSET +8
  +11: mov %rax,(%rdi)      ; c.x[0] = rax          (return value)
  +14: ret
```

**`GetNext()` is exactly `return *(this + 8)`.** So `+8` is `PseudoGlobalVariableRoot::m_pNext`.

Và bộ nhớ được đo ở phần treo cổ:

```
0x710304fb90 + 0x00:  0x0000007102ef98a8   (vptr -> the table above)
0x710304fb90 + 0x08:  0x000000710304fb90   (m_pNext -> THE NODE ITSELF)
```

## 3, chuỗi hoàn chỉnh, được chứng minh.

1. `AddVariable` walks: `for (node = head; node; node = node->GetNext())` — **verified in round 1's
   disassembly**, with the `this`-register pattern and the `x0 == 0` exit test at `+191`.
2. `GetNext()` returns `*(this + 8)` — **verified above by disassembly**.
3. The node's `+8` holds **the node's own address** — **verified by memory read**.
4. **Therefore `node = node->GetNext()` is a no-op, the exit test can never fire, and the loop spins.**
5. **The node is in `.bss`**, which is zero-initialised at load — **so `m_pNext` was zero and something
   viết địa chỉ của nút vào lúc chạy.

**Không có sự suy luận nào còn lại trong bước 1–5.** Mỗi liên kết là một sự phân tách hoặc một bộ nhớ đọc.

## 4 là những gì bây giờ được thiết lập chống lại vẫn còn mở

|Mục|Tình trạng|
|---|---|
|Người gọi vòng thời gian| ✅ **`GetNext()`** — resolved through the vtable |
| `GetNext`'s implementation | ✅ **`return *(this + 8)`** |
| `+8` is `m_pNext` |Đã xác nhận|
|Kiểu nút xấu| ✅ **`PseudoGlobalVariable<SendMultiParameter>`** |
| `m_pNext == this` |Con số|
| `.bss` ⇒ written at runtime |Số học phân số  hội nghị|
|**Loop không thể chấm dứt**|* Theo đuổi nhất thiết phải**|
| **Who wrote `m_pNext = this`** |Vẫn mở cửa**|

## Năm điều mà điều này không chứng minh — và một điều khác tôi không nên chôn cất

- **The writer was not found.** `SetNext(this)` is the likely form; `SetNext` exists in the symbol
  Tìm kiếm một cuộc gọi nơi nhận và lập luận là cùng một bộ nhớ là một tìm kiếm tĩnh và đã
  Chưa xong đâu.
- **`ResetContext(unsigned)` at `+0x20` was not examined** — it is a plausible alternative writer of
  trạng thái đối tượng, và nó được gọi bằng tên trong danh sách biểu tượng.
- ** Khả năng danh sách vòng tròn không hoàn toàn bị loại bỏ.** Nếu SDK này đã bao giờ tạo ra một mục đích
  circular `PseudoGlobalVariable` chain, then `GetNext()` returning `this` would be *legal data* and
  the defect would instead be in the **walk's termination test** (`x0 == 0`, which is wrong for a
  Bản danh sách vòng tròn. **Tôi không có bằng chứng nào cả**, và tôi cũng đánh dấu nó ở vòng 1
- **`AddVariable`'s correctness was not proven** — only that its empty branch looks right.
- **Không có sửa chữa nào được thiết kế hoặc thực hiện.**
- **`main`'s total constructor count is still unknown**; `nnMain` still not reached.
- **Không NVN, không cửa sổ, không trình bày.** Hiển thị và âm thanh là các chấm.
- **Đây không phải trò chơi khởi động.**

## 6. Tăng dần

Hai cuộc tìm kiếm bất động, hoặc quyết định:

1. **Find a `SetNext` call whose argument is its receiver** (`x1 == x0` at the call site) in `main`'s
   855 functions' worth of `PseudoGlobalVariable` code. That is the writer.
2. **Read `SetNext`'s own implementation** — if it writes `*(this + 0x10)` rather than `+8`, then
   `m_pNext` at `+8` is written by something else entirely and the suspect list changes.

Bước 2 là rẻ hơn và là bước tiếp theo: nó kẹp bù đắp của setter và có thể ngay lập tức hiển thị rằng
`+8` is not set by `SetNext` at all.
