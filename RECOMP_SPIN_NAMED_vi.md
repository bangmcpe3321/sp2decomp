# The spin is named: `PseudoGlobalVariableList::AddVariable` looping on a list

With `gdb` installed, the spinning function is identified in one attach. This is the answer to the
câu hỏi mà đạn 10 và 11 chỉ có thể thu hẹp lại.

---

## Một.

```
#0  main_00D2F0F4(nx::CPU&)
#1  main_00D5A238(nx::CPU&)
#2  nx::call(nx::CPU&, unsigned long)
#3  nx::call_preserving(nx::CPU&, unsigned long)
#4  nx::init_module(nx::CPU&, nx::ModuleInfo const&)
#5  nx::nn_main(nx::CPU&)
#6  nx::call(nx::CPU&, unsigned long)
#7  nx::boot()
#8  main
```

Resolving the two guest offsets against `main`'s symbol table:

|Hiệu|Ký hiệu|
|---|---|
| `0xd2f0f4` | **`nn::nex::PseudoGlobalVariableList::AddVariable(nn::nex::PseudoGlobalVariableRoot*)`** |
| `0xd5a238` | `nn::nex::PseudoGlobalVariable<nn::nex::StreamSettings>::PseudoGlobalVariable()` |

**So the hang is `PseudoGlobalVariable<T>`'s constructor calling
`PseudoGlobalVariableList::AddVariable(this)`, which never returns.**

## 2. Điều đó có nghĩa gì — và tại sao nó phù hợp với bằng chứng nhân

`AddVariable` walks a **linked list** of pseudo-global variables and inserts a node. A function that
đi theo một danh sách và **không bao giờ trở lại** hầu như luôn luôn là một trong số:

1. **The list terminator is wrong** — a `next` pointer that is not null where a null is expected, so
   Đường vòng chạy ra khỏi đầu hoặc vòng quanh một chu kỳ mãi mãi.
2. **Người gác đầu không bao giờ được khởi động** — danh sách chưa bao giờ được xây dựng, vì vậy đầu của nó là zero
   hoặc tự đánh giá bản thân và đi bộ không bao giờ kết thúc.
3. **A chu kỳ tồn tại** — nút đã được chèn trở lại các điểm trong danh sách.

**This matches the kernel evidence exactly.** Round 11 established the main thread is in state `R`
with `wchan=0` — a pure CPU-bound spin, not a lock wait and not a join. **A list traversal that never
Tới tận cùng của nó là: CPU tinh khiết, không điện thoại, không chặn lại.** Hai sợi chỉ công nhân
ngủ là một sự che đậy — không liên quan đến họ, và không có gì đang chờ đợi họ cả.

** Vì vậy, vòng 11 của "một bên quay và những giấc ngủ khác, chờ đợi trên một bắt tay" đọc là sai trong nó
Giả thuyết nhưng ngay trong quan sát của nó.** Sự quay không phải là chờ đợi của các công nhân; nó đang đi bộ một danh sách
không bao giờ kết thúc.

## 3. Nguyên nhân gốc có khả năng nhất

`PseudoGlobalVariableList`'s construction is itself a static constructor
(`_ZN2nn3nex24PseudoGlobalVariableListC1Ev` / `C2Ev` at `0xd2f118`, `0xd2f118`). If that constructor
**has not run** — or ran but was skipped — then `AddVariable` is walking an uninitialised list head.

**That is the same failure shape as the `init_status == 1` bug from round 8**: a static initialisation
that should have happened and silently did not. `PseudoGlobalVariableList`'s ctor is one of the
constructors in `main`'s `init_array`, and the run reached `init[1367]` — so the list's own constructor
hoặc trong một mô-đun khác, hoặc không chạy.

** Đây là giả thuyết phù hợp với mọi bằng chứng, chứ không phải một kết luận đã được chứng minh.**

## Điều này chứng minh gì?

|Mục|Tình trạng|
|---|---|
|Bộ gỡ lỗi sẵn sàng| ✅ `gdb` 17.1 + `eu-stack` installed |
| `ptrace_scope` |_Gỡ bỏ mục 0 (attach bị chặn)|
|Hàm xoay| ✅ **`nn::nex::PseudoGlobalVariableList::AddVariable`** |
|Dây chuyền gọi đầy đủ| ✅ from `main` down to the spin, through `init_module` |
|Quay nhân vật| ✅ CPU-bound list traversal (matches `state=R`, `wchan=0`) |
|Nguyên nhân gốc|Không thể khởi động lại danh sách người đứng đầu hoặc thư mục danh sách — rất có thể là**, chưa kiểm tra|

## 5 Điều này không xác minh

- **The list state was not inspected.** Reading the list head and the node's `next` pointer at the hang
  sẽ xác nhận nó trong thêm một đính kèm, và đã không được thực hiện.
- **Whether `PseudoGlobalVariableList`'s own constructor ran** was not checked against the
  Nhật ký xây dựng.
- ** Vòng thời gian không bị hỏng** — việc sửa chữa không được thiết kế hoặc thử nghiệm.
- **`main`'s total constructor count is still unknown.**
- **`nnMain` has still not been reached.**
- **Không NVN, không cửa sổ, không trình bày.** Hiển thị và âm thanh là các chấm.
- **Đây không phải trò chơi khởi động.**

## 6. Tăng dần

One more `gdb` attach, this time reading memory: `AddVariable`'s list head and the `next` field of the
nút nó đang đi bộ. Nếu danh sách là vòng tròn hoặc đầu của nó là zero, đó là lỗi và sửa chữa là để
ensure `PseudoGlobalVariableList` is constructed before any `PseudoGlobalVariable<T>`. Cheap, and the
Bộ gỡ lỗi đã được cài đặt.

## Ghi chú công cụ 7

`gdb` and `eu-stack` were installed this round with `sudo`, and
`/proc/sys/kernel/yama/ptrace_scope` was set to `0` to permit attach. **Both were previously missing,
và sự vắng mặt của họ là lý do tại sao đạn 10 và 11 chỉ có thể thu hẹp treo cổ đến một chức năng thay vì tên
Vòng bên trong nó.
