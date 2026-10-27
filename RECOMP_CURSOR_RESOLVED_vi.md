# Resolved: the cursor is `x20`, round 2 stands, and the self-link pre-existed this call

Vòng 6/12. 1 đọc của CPU struct tại spin **settles vòng 5 nghi ngờ nghiêng về vòng 2** và
tạo ra một sự thật mới mà thay đổi những gì cần tìm tiếp theo.

---

## Một. đo lường

```
pc                = 0x5dd60e07ef05        (inside nx::call)
c.x[20] (cursor)  = 0x710304fb90
c.x[0]            = 0x710304fb90
c.x[1]            = 0x7103650210
c.x[30] (lr)      = 0x7100d2f130           (AddVariable + 0x3c)
cursor +0 (vptr)  = 0x7102ef98a8
cursor +8 (next)  = 0x710304fb90           (itself)
```

## 2. `0xa0(%rbx)` is `c.x[20]` — a guest register, not a "slot"

The CPU struct begins with `x[0]` at offset 0 (`(%rbx)` is `c.x[0]`, `0x8(%rbx)` is `c.x[1]`, …). So
`0xa0(%rbx)` is **`c.x[20]`** — the guest's **`x20` register**, which the compiler chose as the loop's
Con trỏ. Các đạn trước đó gọi nó là "một khe cắm", nó là một bộ nhớ khách thường được lưu.

## 3 vòng 2 là CONFIRED; vòng "đầu" yêu cầu được rút lại

The loop computes its call target as `*(*(cursor) + 0x28)`, and **the cursor is `0x710304fb90`**:

```
cursor            = 0x710304fb90
*(cursor)         = 0x7102ef98a8      (a .data vtable)
*(0x7102ef98a8+0x28) = 0x7100d181d8   = GetNext()
```

**So round 2's pointer path was right and its slot table stands.** `GetNext()` really is the callee.

**And round 5's doubt is resolved the other way:** `0x7103650160` (the value in `main+0x2fc7520`) is
**not the loop's cursor at the spin** — `x20` had already advanced to `0x710304fb90`. Round 5's `next=0x3d`
đọc là một cấu trúc mà các vòng thời gian hiện không đi qua.

## 4. Sự thật mới mà quan trọng: đối tượng được thêm vào là một sự khác biệt

```
c.x[1] = 0x7103650210
```

`c.x[1]` is `x1`, which `AddVariable`'s insertion path sets to **the node being registered**. And
`0x7103650210` is *not* `0x710304fb90`.

**So at the moment of the hang, `AddVariable` is trying to register `0x7103650210` — while the list it is
walking contains a node (`0x710304fb90`) whose `m_pNext` already points to itself.**

**The self-link therefore PRE-EXISTED this call.** The current `AddVariable` call is a **victim**, not the
Hung thủ: nó không thể chạm tới đuôi vì dây xích đã hình tròn, nên nó quay.

**Đây là quyết định cho những gì cần tìm kiếm.** Vòng 3–5 là mỗi lý do về điều này * cuộc gọi như thể nó
Sự tham nhũng được tạo ra bởi sự đăng ký của **earlier**
`0x710304fb90`.

## 5 Lời tường thuật đã được chỉnh sửa

1. At some **earlier** point, `AddVariable(0x710304fb90)` ran and left that node's `m_pNext == itself`
   ( vẫn chưa giải thích được — đó là câu hỏi mới duy nhất)
2. some time later, `AddVariable(0x7103650210)` runs;
3. đi bộ của nó bắt đầu ở đầu và không bao giờ có thể chấm dứt, bởi vì dây xích nó đi vào đã có chứa
   nút liên kết tự;
4. Chiếc giày treo — tại nhà máy chế tạo #1367, nhưng nguyên nhân là sớm hơn.

## 6, vòng này chứng minh cái gì?

|Mục|Tình trạng|
|---|---|
| `0xa0(%rbx)` is `c.x[20]`, the guest `x20` |Đã thiết lập|
|Con trỏ ở chỗ quay| ✅ **`0x710304fb90`** |
| **Round 2's `GetNext` resolution** |**CONFIRED — đứng**|
| Round 5's "head is `0x7103650160`" |♪ Bị trục xuất như con trỏ biết đi ♪|
| `GetNext` returns the cursor ⇒ infinite loop |Xác nhận**|
|Nó được đăng ký ở chỗ treo cổ.| ✅ **`0x7103650210`** |
|**Sự tự kết nối trước đã tồn tại của tiếng gọi này**|* Theo đuổi nhất thiết phải**|
|Ai đã tạo ra sự tự kết nối|♪ Vẫn mở cửa và giờ là câu hỏi duy nhất ♪|

## 7 Những gì điều này không xác minh

- **The earlier `AddVariable(0x710304fb90)` call was not observed.** Its existence is inferred from the
  không thấy.
- **Tại sao nó tự liên kết là không rõ.** Cơ chế giả lập từ vòng 3 vẫn còn là một
  Giả thuyết; nó không được thử nghiệm.
- **What `0x7103650210` is** (which `PseudoGlobalVariable<T>`) was not resolved to a symbol.
- **What the structure at `0x7103650160` is** was not identified.
- **`main`'s total constructor count is still unknown**; `nnMain` still not reached.
- **Không có sửa chữa nào được thiết kế hoặc thực hiện.**
- **Không NVN, không cửa sổ, không trình bày.** Hiển thị và âm thanh là các chấm.
- **Đây không phải trò chơi khởi động.**

## 8 Thêm vào

**Observe every `AddVariable` call with a gdb breakpoint**, which is now the natural tool because the
recompiler emits direct calls that `call_preserving` hooks cannot see:

```
break main_00D2F0F4
commands
  silent
  printf "AddVariable(x1=0x%lx) head=0x%lx\n", *(unsigned long long*)($rdi+8), <head>
  continue
end
run
```

**Every registration is then logged in order.** The first call whose argument is `0x710304fb90`, and the
Đó là quan sát, chứ không phải suy luận, và nó
Kết thúc câu hỏi mở cuối cùng trong chuỗi này.
