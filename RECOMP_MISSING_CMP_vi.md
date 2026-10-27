# Chức năng phục hồi không có sự so sánh không đăng ký — khách có hai

Round 11/12. The full function was read. **`main_00D2F0F4` contains exactly two compare instructions, and
không có gì so sánh hai bộ nhớ.** Hàm khách chứa hai bộ so sánh. Đây là một
**Nhà vệ sinh, sự mâu thuẫn không thể thay đổi** và nó cần được báo cáo chính xác.

---

## Một. đo lường

`main_00D2F0F4` (`nn::nex::PseudoGlobalVariableList::AddVariable`), **90 instructions total**:

```
EVERY compare in the whole function:
  0x031e6a7a <+126>:  test   %rdx,%rdx        <- head == NULL ?
  0x031e6abb <+191>:  cmpq   $0x0,(%rbx)      <- x0 == 0 ?
```

**Hai lần so sánh cả hai đều chống lại số không.

## 2. hàm số khách chứa

From the decompressed image (`main.bin`), inside the same function:

```
0xd2f1a4:  eb13001f   cmp  x0, x19       <- register vs register
0xd2f1a8:  540001a0   b.eq +0x34
0xd2f1ac:  b40004a0   cbz  x0, +0x94     <- register vs zero
0xd2f1b8:  eb1302bf   cmp  x21, x19      <- register vs register
0xd2f1bc:  540001c0   b.eq +0x38
```

**The guest performs two register-vs-register comparisons (`cmp x0, x19` and `cmp x21, x19`). The
Chức năng phục hồi không thực hiện được gì.**

## 3. Hai lần đọc — và tôi phải nói cả hai

**(a) A recompilation OPTIMISATION.** If the recompiler could prove `x19 == 0` at those points, then
`cmp x0, x19` is simply `cmp x0, #0` and folding it is correct. That would be a *legitimate* translation and
sẽ không có khuyết điểm.

**(b) A recompilation DEFECT.** If `x19` is not provably zero, then the register comparison has been
** giọt**, và mã được mã hóa âm thầm thử nghiệm một trạng thái yếu hơn so với bản gốc. **Điều đó sẽ làm cho
mật mã sinh ra sai theo một cách nào đó không có gì trong dự án này đã phát hiện**, và nó sẽ giải thích việc treo cổ
exactly: the guest stops the walk when the cursor returns to the sentinel in `x19`; the recompiled walk only
nên nó quay mãi mãi.

♪ Cả hai đều có thể tồn tại. ♪ Sự tàn bạo ♪ của một cuộc so sánh là một sự thật đã được chứng minh**
*reason* vì nó không phải.

## 4 Bằng chứng liên quan đến điều đó

|Quan sát|Lề|
|---|---|
| The recompiled function never mentions any guest register other than `x0`/`x1` | (b) — nothing tracks `x19` |
| `x19` is a callee-saved register, so a value in it survives the calls in this function |( b) Đó là một giá trị sống chứ không phải đã chết|
| The guest tests **both** `x19` and zero, one after the other | (b) — if `x19` were zero, the first test would be redundant and a compiler would not emit both |
|Những người tái phối hợp có thể gấp những so sánh có thể chứng minh|(a) Có thể theo nguyên tắc|

**The third row is the strongest single argument for (b): a compiler that emitted `cmp x0, x19; b.eq`
followed by `cbz x0` in the original binary would not do so if `x19` were a known zero — the second test
would then be unreachable-and-redundant.** Since the original toolchain emitted both, `x19` is evidently
**Không** một con số không đã biết, có nghĩa là mã được sửa chữa đang thử nghiệm một điều kiện ** khác biệt** so với điều kiện gốc.

Tuy nhiên, đó là ứng cử viên mạnh nhất giải thích cho dự án này
được tạo ra cho treo cổ, và nó là giả mạo trong một bước.**

## 5. Làm thế nào để làm giả nó trong một bước

**Run the same guest function's semantics by hand at the hang.** The cursor at the hang is `0x710304fb90`;
read `x19` at that moment:

- **if `x19 == 0x710304fb90`** → the cursor *equals the sentinel*, the guest would have exited, and the
  Mã đã được mã hóa không được xác nhận; **(b) đã xác nhận**;
- **if `x19` is something else** → the cursor did not match the sentinel, the guest would also have looped,
  và **(b) bị bác bỏ** cho vụ treo cổ này.

**This was not run.** It is one `gdb` read of one guest register and it settles the question.

## 6, vòng này chứng minh cái gì?

|Mục|Tình trạng|
|---|---|
| Compares in `main_00D2F0F4` |Chính xác là 2, cả hai chống lại zero**|
|Đăng ký so sánh trong chức năng khách| ✅ **exactly 2 (`cmp x0,x19`, `cmp x21,x19`)** |
|**Một sự khác biệt tồn tại**|♪ Phát triển ♪|
| Recompiler folded `x19` as provably zero |Không thể tin được, không thể chứng minh được.|
|Bộ tháo gỡ lỗi so sánh|Có khả năng hơn, chưa được chứng minh.|
|Mà nó là|** Chưa xác định**|

## 7 Những gì điều này không xác minh

- Không chứng minh được khuyết tật sửa đổi.** Sự mâu thuẫn được chứng minh; nguyên nhân là không.
- **`x19`'s value at the hang was not read** — the single decisive measurement was not taken.
- **Whether `0xd2f1a4` belongs to `AddVariable` or to an inlined callee inside it** was not checked against
  ranh giới biểu tượng.
- **Rears 7–10 phát hiện dữ liệu không phải là vô hiệu hóa** — đăng ký bản sao vẫn là một sự thật được quan sát;
  Nó có thể đơn giản chỉ là một phép so sánh bị thiếu so sánh là một khuyết điểm thực sự.
- **Không có sửa chữa nào được thiết kế hoặc thực hiện.**
- **`nnMain` is still not reached.** No NVN, no window. **This is not a booted game.**

## 8 lý do tại sao vấn đề này vượt ra ngoài Slaptoon 2

Nếu (b) giữ lại, sau đó ** Mã tái tạo của bộ mã không trung thành** - và không có gì trong dự án này
Thử nghiệm sẽ nắm bắt được điều đó, bởi vì chính kiểm tra 382 của cảng này đã được viết bằng tay, không phải mã.
tạo ra mã. **A im lặng chuyển đổi sai sẽ ảnh hưởng đến mọi trò chơi được xây dựng bằng công cụ này, không chỉ
Cái này.

Đó là một tuyên bố xứng đáng được rất cẩn thận về, và đó là lý do tại sao các bước tiếp theo là một đăng ký riêng hơn
hơn là một thông báo.

## 9. Tăng dần

**Read guest `x19` at the hang and compare it to the cursor `0x710304fb90`.** One `gdb` read. It either
Xác nhận lỗi sửa chữa đầu tiên dự án này đã tìm thấy, hoặc bác bỏ nó và trả lại việc tìm kiếm
dữ liệu.
