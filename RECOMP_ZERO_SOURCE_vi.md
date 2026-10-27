# The zero is a load: `Framework::initialize` receives an `InitializeArg` with both size fields zero

The `HeapMgr::initialize(0)` call has been traced to the exact instruction that produces the zero.

---

## 1, vết lùi

```
#0  main_00E7C4E0   sead::HeapMgr::initialize(size_t)          <- x0 = 0x0
#1  main_00E698AC   sead::Framework::initialize(InitializeArg const&)
#2  main_00E69FE4   sead::GameFramework::initialize(...)
#3  main_00E6724C   sead::GameFrameworkNx::initialize(...)
#4  main_011F5B20   Lp::Sys::SysInit::Init()
#5  main_0019A3E0   nnMain
```

**The caller is `sead::Framework::initialize`** — the same frame that later faults in
`ExpHeap::tryCreate`. So it asks for a heap it never sets up, then fails to find one: **one defect, two
Triệu chứng.

## 2. Các hướng dẫn mà sản xuất các zero

Disassembling just before the call (`main_00E698AC` = `Framework::initialize`):

```asm
+102:  mov   0x8(%rax),%rdx      ; rdx = *(arg + 8)
+106:  mov   %rdx,(%rdi)         ; x0 = rdx
+109:  test  %rdx,%rdx
+112:  jne   +555                ; if non-zero, take another path
+118:  mov   (%rax),%rax         ; rax = *(arg + 0)      <- the zero path
+121:  mov   %rax,(%rdi)         ; x0 = *arg
+124:  movabs $0x7100e698d8,%rax
+134:  mov   %rax,0xf0(%rdi)     ; return address
+141:  call  main_00E7C4E0       ; HeapMgr::initialize(x0)
```

** Đây là một hậu quả hai mặt:**

```
size = arg->[+8];
if (size == 0) size = arg->[+0];      // fallback
HeapMgr::initialize(size);
```

**Both fields are zero**, so the fallback yields zero, and `HeapMgr::initialize(0)` follows.

## 3. Điều đó có nghĩa gì?

**The defect is upstream of the heap manager entirely.** `sead::Framework::initialize` is handed an
`InitializeArg` whose two size-ish fields are **both zero** — it is not computing a size wrongly, it is
Không nhận ra kích cỡ nào cả.

The `InitializeArg` is constructed by the game's own startup:
`nnMain` → `Lp::Sys::SysInit::Init` → `GameFrameworkNx::initialize` → `GameFramework::initialize` →
`Framework::initialize`.

**So the missing input is a value the game's `SysInit` was supposed to fill in and did not** — most likely
bởi vì nó có được giá trị từ thứ mà cổng không cung cấp.

## Điều này chứng minh gì?

|Mục|Tình trạng|
|---|---|
| Caller of `HeapMgr::initialize` | ✅ **`sead::Framework::initialize`** |
|Nguồn gốc của số 0| ✅ **`*(arg+8)==0` and `*(arg+0)==0`, a two-field fallback** |
|Chuẩn hoá hướng dẫn| ✅ **`main_00E698AC+102` … `+141`** |
| `get_info` involvement |**none — loại trừ dần dần *|
| `system_resource_size` |tôm đã bị loại|
|Nguyên nhân căn bản của kích cỡ còn thiếu|Không xác định được**|

## 5 Điều này không xác minh

- **What `rax` points to was not confirmed.** It is *consistent with* being the `InitializeArg` passed to
  `Framework::initialize`, but the preceding instructions that set `rax` were not disassembled.
- ** Nhân dạng của hai lĩnh vực không là không rõ** - chúng được mô tả là "se-ish" từ sử dụng của họ, không phải
  từ một đầu trang.
- **Ai lẽ ra phải lấp đầy chúng, và từ đâu mà chúng ta không biết.**
- **`HeapMgr::initialize` with a non-zero size was still not tried** — so it remains unconfirmed that a real
  Kích thước sẽ làm sáng tỏ lỗi lầm.
- **The game is not booted** — it faults in `GameFrameworkNx::initialize`.
- **Không có gì được trình bày.** Không có NVN, không có cửa sổ, không có đèn pha. ** Đây không phải là một trò chơi có thể chơi.**

## 6. Tăng dần

Hai lựa chọn, theo thứ tự chi phí:

1. **Disassemble `Framework::initialize` from its start** to see where `rax` comes from and which fields it
   Điều này cho thấy giá trị của công cụ và cả hai lĩnh vực, và cho thấy giá trị của nó là một tham số hoặc một số toàn cầu.
2. **Try `HeapMgr::initialize` with a non-zero size** from the port, as a diagnostic — if the fault clears,
   toàn bộ đọc đã được xác nhận và các tác phẩm còn lại là hoàn toàn "puply số đúng", nếu nó không,
   Nhiều hơn nữa là sai trong các đường khuôn khổ hơn là một đối số.

**Step 2 là một dòng và trả lời câu hỏi chiến lược**: cho dù đây là một vấn đề nhập hoặc a
Vấn đề đầu tư khuôn khổ, đáng để biết trước khi đầu tư.
