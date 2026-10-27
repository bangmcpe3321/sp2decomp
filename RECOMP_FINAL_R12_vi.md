# Vòng cuối cùng: bộ tổng hợp đã được xóa, và sự so sánh bí ẩn là một bản sao

Hiệp 12/12.
Bị bác bỏ**, bộ so sánh được làm sáng tỏ**, và sự so sánh bí ẩn của người khách hóa ra là một cái gì đó mà
khiến toàn bộ bức tranh trở nên mạch lạc.

---

## Một. đo lường

```
c.x[0]   = 0x710304fb90
c.x[19]  = 0x7103650210     <- the "sentinel" candidate
c.x[20]  = 0x710304fb90     <- the walk cursor
c.x[21]  = 0x0
```

**The cursor (`0x710304fb90`) does NOT equal `x19` (`0x7103650210`).**

**So the guest's `cmp x0, x19; b.eq` would not have fired either — the original code would have looped in
Vòng lặp được sửa chữa đang làm điều tương tự như khách hàng làm.

**Rund 11 giả thuyết (a): bộ biên dịch bỏ một so sánh đăng ký mà có thể kết thúc vòng lặp -
Không có bằng chứng nào cho thấy sự thay đổi.
Khiếm khuyết tại nơi này, và mã tạo ra dự án này không được hiển thị là không chung thủy.**

## 2. What `x19` actually is — and it makes everything cohere

`c.x[19] = 0x7103650210` — **the very object that `AddVariable` is trying to register** (round 6 measured
`c.x[1] = 0x7103650210`, and round 7 showed it being registered).

**So `cmp x0, x19` compares the walk cursor against the object being added.** That is a
**Duplicate kiểm tra**:}Có phải tôi đã đi bộ trở lại các nút tôi chèn?
danh sách."

** Đi dạo của khách là:**

```
for (cursor = head; cursor != 0 && cursor != new_node; cursor = cursor->GetNext()) { ... }
```

**The SDK rõ ràng bảo vệ chống lại việc đăng ký bản sao.**

## 3. Tài khoản hoàn chỉnh, mạch lạc

1. **`0x710304fb90` is registered first**, then **registered again** (round 7, observed).
2. That second registration created the self-link: `0x710304fb90->m_pNext = 0x710304fb90`.
3. **Later**, `AddVariable(0x7103650210)` runs. Its duplicate check (`cmp x0, x19`) is armed and would work —
   **but it can only fire if the walk reaches `0x7103650210`.**
4. The walk instead enters the cycle at `0x710304fb90` and **never reaches `x19`**, so the duplicate check
   Không bao giờ có cơ hội.
5. Cái giày treo.

** Vì vậy, sự bảo vệ nhân bản là có thật và đúng — nó chỉ đơn giản bị đánh bại bởi một chu trình được tạo ra
Trước đó, trước khi nó có thể giúp.**

**Những khuyết điểm là sự liên kết đầu tiên, ở bước 2 ** mọi thứ kể từ vòng 7 đã được điều tra bước 3's
Nạn nhân.

## Vòng cuối cùng này là gì?

|Mục|Tình trạng|
|---|---|
| `x19` at the hang | ✅ **`0x7103650210` — the object being registered** |
|Con trỏ ở chỗ treo| ✅ `0x710304fb90` |
| **Cursor == `x19`** |[Tiếng cười]|
|Khách mời sẽ bỏ đi.|Nó cũng sẽ lặp đi lặp lại|
|** Sự khiếm khuyết trong việc tính toán lại ở nơi này**|[Tiếng cười]|
| Meaning of `cmp x0, x19` |Kiểm tra bản sao sự tồn tại**|
|khuyết tật thật sự|{\cH00C1E5EC}Sự tự liên kết đầu tiên, được tạo ra bởi bản đăng ký kép trước đó {\cH00C1E5EC}|
|Trung thành với máy phục hồi|vội vã không tỏ ra bất trung; được làm sáng tại nơi này**|

## 5 Điều này không xác minh

- **The first self-link was never observed being created.** Rounds 7–8 proved *that* `0x710304fb90` is
  Đã đăng ký hai lần và qua đó xây dựng* (#1364), nhưng **không** những gì tiểu bang mà danh sách đã có tại thời điểm này
  Đó vẫn là câu hỏi mở đầu.
- **`x21` was `0`, and the guest's second comparison `cmp x21, x19` was not interpreted.** With `x21 == 0`
  Nó trông giống như một bản kiểm tra vô giá viết khác nhau, nhưng đó là suy luận.
- **Người tái phối hợp chỉ được rõ ràng ở nơi này**, không tỏ ra trung thành ở khắp mọi nơi.
- ** Không có sửa chữa nào được thiết kế hay thực hiện.** lỗi này đã được định vị chính xác nhưng chưa được sửa chữa.
- **`nnMain` was never reached.** No NVN, no window, no render. **This is not a booted game.**

---

# Nơi mục tiêu này kết thúc

## Tiến hành qua 12 vòng.

|Tròn|Tìm|
|---:|---|
| 1 | the unknown comparison is `GetNext`; the node is in `.bss`, so its self-pointer was written at runtime |
| 2 | vtable resolved: `+0x28` = `GetNext`, and `GetNext()` is literally `return *(this+8)` |
| 3 | `SetNext` writes `+8`; duplicate registration would produce exactly the observed state |
| 4 | corrections: `call_preserving` hooks miss direct calls; head ≠ node |
| 5 |đi bộ dây xích thất bại... **của tôi là lỗi của riêng tôi off-một trong hướng**, rút lại trong vòng 7|
| 6 | the cursor is guest `x20` = `0x710304fb90`; **round 2 confirmed**, round 5 retracted |
| 7 | **duplicate registration PROVEN** — `0x710304fb90` twice, second one at the end; `init_array` clean |
| 8 | the second registration comes from a **legitimate** `init_array` constructor (#1364) |
| 9 | real AArch64 read: `exefs/main` is **LZ4**, so offset math was wrong; `SetNext(node,nullptr)` is explicit |
| 10 | the guest has **two** exit tests; the recompiled loop shows one `. . . hypothesis formed` |
| 11 |sự mâu thuẫn là **Đã được khai sáng**: 2 so sánh, cả hai chống lại zero, không có bộ nhớ so sánh|
| 12 | **that hypothesis is REFUTED** — the cursor ≠ `x19`, so the guest would loop too. `cmp x0, x19` is a **duplicate check** |

## Những gì đã được giải quyết

- **The boot reaches 1,367 of `main`'s 1,604 static constructors** and hangs there.
- **The hang is a CPU-bound spin** (`state=R`, `wchan=0`) in
  `nn::nex::PseudoGlobalVariableList::AddVariable`, walking a `PseudoGlobalVariable` chain.
- **The chain contains a node whose `m_pNext` is itself** — `0x710304fb90`, in `.bss`, so written at runtime.
- **That node is registered twice**, and the second registration is a legitimate `init_array` constructor.
- ** Bản kiểm tra sao của SDK tồn tại và đúng** - Nó không thể bắn từ bên trong chu trình.
- **Người điều phối lại không liên quan ] ở trang bị lỗi.

## Điều gì không được giải quyết — câu hỏi duy nhất còn lại

**What was the list's state when `0x710304fb90`'s self-link was first written?** If at that moment the node
đã là đuôi, viết là đường dẫn sao chép không phát hiện được; nếu nút là
head, `AddVariable`'s insertion is wrong for the head case. **One breakpoint on the first registration,
In đầu và con trỏ ở mục nhập sẽ trả lời nó.**

## Thành thật đánh giá

**This goal did real, verifiable work and did not reach `nnMain`.** Along the way it corrected itself
**5 lần**, và mỗi sự sửa phạt được ghi chép thay vì bị chôn vùi. Kết quả có giá trị nhất là tiêu cực
hay cấu trúc, không chiến thắng:

- the **`exefs` is LZ4** trap, which would silently corrupt any offset-based analysis;
- **`call_preserving` hooks miss direct recompiled calls**, which invalidated one whole instrumentation
  cố gắng;
- **Wander-vs-Splatoon-2 im lặng-misversist**, bây giờ sáu mục, mỗi một trong số đó tốn một lỗi
  tròn;
- a **precise, still-unfixed defect** at `nn::nex::PseudoGlobalVariableList::AddVariable`, one breakpoint
  tránh xa nguyên nhân của nó.

** Trò chơi không khởi động, và không có gì ở đây nên được đọc như gợi ý rằng nó gần để làm điều đó.** Hơn nữa
this hang lie the rest of the constructor list, `nnMain`, the entire HLE surface, NVN, and — out of scope
Trong suốt thời gian đó, máy làm bóng Maxwell 2 của Slatoon 2.
