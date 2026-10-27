# Người xây dựng khởi động lõi — cả hai ứng cử viên vòng 13 giờ bị loại bỏ

Round 15. `PseudoGlobalVariable<StreamSettings>`'s constructor was disassembled. It **does** put the
node into a known state before calling `AddVariable`, which **eliminates the last candidate from round
13** và dùng lực khác để đọc con bọ.

---

## 1. The constructor initialises the node, then calls `AddVariable`

```asm
+135:  movabs 0x7102fc7908,%rax   ; the static PseudoGlobalVariable<StreamSettings> object
+145:  mov    %rax,0x98(%rdi)     ; stash it
+152:  mov    %rax,(%rdi)         ; c.x[0] = it
+172:  call   main_00D2F404       ; a base-class constructor
+177:  movabs 0x7102fc7900,%rax
+191:  mov    0x98(%rbx),%rax     ; rax = the object
+198:  movw   $0x0,0x18(%rax)     ; *** obj+0x18 (u16) = 0 ***
+204:  mov    0x98(%rbx),%rax
+211:  movq   $0x0,0x10(%rax)     ; *** obj+0x10 (u64) = 0 ***
+219:  mov    0x40(%rbx),%rax
+223:  add    $0x10,%rax          ; rax = 0x7102fc7900 + 0x10 = 0x7102fc7910
+231:  mov    0x98(%rbx),%rdx     ; rdx = the object (0x7102fc7908)
+238:  mov    %rax,(%rdx)         ; *** obj->field0 = 0x7102fc7910 = obj + 8 ***
...
+261:  mov    %rax,0x8(%rbx)      ; c.x[1] = the object  -> AddVariable's argument
+285:  call   main_00D2F0F4       ; *** AddVariable(object) ***
```

**The object is explicitly cleared (`+0x18 = 0`, `+0x10 = 0`) and given a `field0` pointer before the
call.** It is *not* passed to `AddVariable` in an uninitialised state.

## 2. Vậy là cả 2 ứng cử viên vòng 13 bị loại.

|Ứng cử viên vòng 13|Lệnh nhập|
|---|---|
|(1) Chưa bao giờ có thông tin về nút| ❌ **eliminated** — `+198`/`+211` clear it explicitly |
| (2) `AddVariable` linked the node to itself | ❌ **eliminated in round 14** — its empty branch writes `head = node` |

**Neither holds. The node that `AddVariable` is handed here is correctly initialised.**

## Ba, việc đọc bằng chứng hiện đang có sức mạnh.

Hai địa chỉ đối tượng khác nhau đã được quan sát:

|Ở đâu|Địa chỉ|
|---|---|
|Vật thể được xây dựng ở đây| `0x7102fc7908` (`field0` → `0x7102fc7910` = itself + 8) |
|Nút đo bản thân trong vòng 12| **`0x710304fb90`** (word at `+8` == itself) |

**These are different objects.** So `AddVariable` is walking a list that **already contained the
self-referential node `0x710304fb90` before this constructor ran** — it was inserted by an *earlier*
`PseudoGlobalVariable<T>` construction, and the walk from the head reaches it and never terminates.

**So the defect predates constructor #1367 and belongs to whichever earlier `PseudoGlobalVariable<T>`
produced `0x710304fb90`.** Round 13 and 14 both examined the *symptom's* call, not the *cause's*.

## Điều này chứng minh gì?

|Mục|Tình trạng|
|---|---|
|Ctor Evolution| ✅ **confirmed** (`+198`, `+211`, `+238`) |
| Ctor calls `AddVariable` | ✅ confirmed (`+285`) |
|Ứng cử (1) nút chưa khởi động|♪ Bị đánh đập ♪|
| Candidate (2) self-link by `AddVariable` |♪ Cả hai đều bị bỏ rơi ♪ (khoảng 14 tuổi)|
|**Cái nút xấu này trước khi gọi là**|♪ Theo dõi những địa chỉ khác nhau ♪|
|Mà bác sĩ đã tạo ra nó|Không xác định được**|

## 5 Điều này không xác minh

- **Which `PseudoGlobalVariable<T>` produced `0x710304fb90`** was not identified. Finding it means
  locating which constructor writes that address — the object at `0x710304fb90` is in `main`'s `.data`
  Vì vậy, nó có thể được vẽ theo một biểu tượng bằng cách tìm địa chỉ của nó trên bảng.
- **The `field0 = obj + 8` pattern was not interpreted.** Whether a vtable pointer pointing 8 bytes into
  Đối tượng của nó là bình thường * đối với SDK này thì không ai biết — nó khác thường, và có thể chính nó là khuyết điểm.
- **The callback at `field0 + 0x28` was still not named.**
- **Không có sửa chữa nào được thiết kế hoặc thực hiện.**
- **`main`'s total constructor count is still unknown**; `nnMain` still not reached.
- **Không NVN, không cửa sổ, không trình bày.** Hiển thị và âm thanh là các chấm.
- **Đây không phải trò chơi khởi động.**

## 6. Tăng dần

**Identify `0x710304fb90`.** It is a static object in `main`'s data region, so:
1. find the symbol or `.data` static whose address is `0x710304fb90`; and
2. find which `PseudoGlobalVariable<T>` constructor writes there.

Đó là đặt tên cho các * vì * nguyên nhân chứ không phải triệu chứng, và nó là một tìm kiếm bàn tĩnh — không có tiến trình chạy.
