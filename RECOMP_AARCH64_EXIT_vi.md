# Bản Arch64 nguyên thủy: sự độc đoán là thiết kế — đọc vòng tròn bị suy yếu

Lần thứ 9/12. và những chỉ dẫn đã được giải mã.
**ans Trả lời câu hỏi vòng 8, ủng hộ việc đăng ký gấp đôi là một con bọ thật sự.**

---

## 1. 1, lỗi giải mã của tôi

Round 8 told me to read `main+0xd2f208` at **file offset `0x100 + 0xd2f208`** in `exefs/main`. Doing so
trở về byte giải mã là vô nghĩa:

```
0x00d2f208:  0x601b0060   .word
0x00d2f20c:  0x98220018   .word
```

**`exefs/main` is an LZ4-compressed NSO.** Raw file offsets do not map to code. Every offset-to-file
Sự chuyển đổi của hình thức đó trong dự án này là sai, và nguồn chính xác là hình ảnh phẳng **decomed
`private/analysis/main.bin` (produced by `tools/nso2bin.py`), where **VA offset == file offset**.

**That is a tooling correction worth keeping: never read `exefs/*` at computed offsets.**

## Mã thật.

```
0xd2f1e0:  f9401508   ldr  x8, [x8, #0x28]     ; x8 = vptr[+0x28]  = GetNext
0xd2f1e4:  aa1303e0   mov  x0, x19             ; x0 = x19
0xd2f1e8:  d63f0100   blr  x8                  ; GetNext(x19)
0xd2f1ec:  f9000280   str  x0, [x20]           ; *x20 = result
0xd2f1f0:  1400000a   b    +0x28
0xd2f1f4:  f9400288   ldr  x8, [x20]           ; x8 = *x20 (vptr)
0xd2f1f8:  f9401915   ldr  x21, [x8, #0x30]    ; x21 = vptr[+0x30] = SetNext
0xd2f1fc:  f9400268   ldr  x8, [x19]
0xd2f200:  f9401508   ldr  x8, [x8, #0x28]     ; GetNext
0xd2f204:  aa1303e0   mov  x0, x19
0xd2f208:  d63f0100   blr  x8                  ; GetNext(x19)
0xd2f20c:  aa0003e1   mov  x1, x0              ; x1 = x19->m_pNext
0xd2f210:  aa1403e0   mov  x0, x20             ; x0 = x20
0xd2f214:  d63f02a0   blr  x21                 ; SetNext(x20, x1)
0xd2f218:  f9400268   ldr  x8, [x19]
0xd2f21c:  f9401908   ldr  x8, [x8, #0x30]     ; SetNext
0xd2f220:  aa1303e0   mov  x0, x19             ; x0 = x19
0xd2f224:  aa1f03e1   mov  x1, xzr             ; *** x1 = 0 ***
0xd2f228:  d63f0100   blr  x8                  ; *** SetNext(x19, nullptr) ***
0xd2f22c:  900114c8   adrp x8, ...
0xd2f230:  f942d908   ldr  x8, [x8, #0x5b0]
0xd2f234:  b9400109   ldr  w9, [x8]
0xd2f238:  51000529   sub  w9, w9, #1
0xd2f23c:  b9000109   str  w9, [x8]           ; decrement a counter
```

## 3. The answer: `SetNext(x19, nullptr)` is explicit

**`0xd2f224: mov x1, xzr` followed by `0xd2f228: blr SetNext` is `node->SetNext(nullptr)`.**

** Danh sách là do đó được thiết kế để NULL-TERMIN.** Một thiết kế vòng tròn sẽ không bao giờ viết rõ ràng
null into `m_pNext` — that instruction would be meaningless or harmful under a circular invariant.

** Vậy là vòng thứ 8 thăng tiến của việc đọc sách vòng tròn là WESED, và giả định sớm hơn là
phục hồi trên bằng chứng tốt hơn:**

> **`m_pNext == self` is corruption, and the double registration is a genuine defect.**

That also re-confirms the exit test: walking to a null terminator is exactly what `cmpq $0x0` checks, and
Nó là ** chính xác** cho danh sách này. **Không có lỗi sửa chữa nào ở đây** — giả thuyết rằng
Recomiler đã làm rớt một bộ phim operand là **disproed**.

## 4. Thêm hai sự kiện từ cùng một cửa sổ

- **`0xd2f1f8`/`0xd2f21c` confirm the vtable layout** used since round 3: `+0x28` is `GetNext`, `+0x30` is
  `SetNext`. The slot table stands on guest evidence, not just on the `.data` read.
- **`0xd2f22c`–`0xd2f23c` decrements a 32-bit counter at `main+0x2fc75b0`.** Round 3 called this global "a
  count" and round 4 retracted that after seeing `56,951,144`. **It *is* a count** — it is decremented
  ở đây - nhưng nó không phải là một số lượng đăng ký**; nhiều khả năng là một số lượng miễn phí hoặc có khả năng đảo ngược. **Rund 4's
  Rút lại là đúng về ý nghĩa và sai lầm của nó không phải là một cái quầy.

## Vòng này chứng minh gì?

|Mục|Tình trạng|
|---|---|
| `exefs/main` readable at computed offsets | ❌ **no — LZ4 compressed; use `main.bin`** |
| `GetNext` = `vptr[+0x28]`, `SetNext` = `vptr[+0x30]` |* Được xác nhận trong mã khách*|
| Guest does `SetNext(node, nullptr)` | ✅ **observed at `0xd2f224`** |
|Danh sách được chấm dứt bởi thiết kế|♪ Đi theo ♪|
|Đọc danh sách hình tròn|*WEDEDED — không còn dẫn**|
|Sửa chữa lỗi trong bài thử ra|**DISPROVED**|
| `main+0x2fc75b0` is decremented |▪ Quan sát thấy — đó là một cái quầy|

## 6 Những gì điều này không xác minh

- ** Tự kiểm tra thoát không nằm trong mã khách.** Cửa sổ đã giải mã là đường dẫn * * *
  after the walk exits. The `cbz`/`cmp` that ends the walk lies elsewhere and was not read, so the claim
  that the exit test is truly null-comparison rests on inference from `SetNext(...,nullptr)` rather than
  trên sự chỉ dẫn của chính nó.
- **`x19` and `x20` were not definitively identified** as "new node" and "tail"; the reading above is
  nhất quán nhưng không được chứng minh.
- **What `main+0x2fc75b0` counts** remains unknown beyond "it is a counter decremented here".
- ** Bản chất chính xác của việc đăng ký kép vẫn chưa giải thích được** — vòng 8 chứng minh * mà* xây dựng
  phải không, không phải tại sao cả hai người xây dựng lại chạm đến cùng một vật.
- **Không có sửa chữa nào được thiết kế hoặc thực hiện.**
- **`nnMain` is still not reached.** No NVN, no window. **This is not a booted game.**

## 7. Tăng dần

**Find and decode the walk's actual exit test.** Scan `main`'s decompressed image for the `cbz`/`cbnz`/`cmp`
that follows the `blr GetNext` in the loop — it should be within ~0x40 bytes of `0xd2f1e8`. Reading that
một trong những hướng dẫn giải quyết cho dù thử nghiệm là chống lại zero (nuell- chi phối, như bây giờ tin tưởng) hoặc chống lại các
Đầu.

Nếu nó chống lại zero, sau đó ** Bản sao dữ liệu của cổng là lỗi** và câu hỏi tiếp theo trở thành
Tại sao hai người xây dựng lại ghi nhận cùng một vật thể * — đó là nơi sửa chữa thực sự.
