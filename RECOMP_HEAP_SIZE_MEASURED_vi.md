# Kích thước thật sự chất đống: 3218 MB — và tại sao cảng không bao giờ có được

Caught `svcSetHeapSize` in the running game with the breakpoint armed before start-up. **The number this
Dự án dự đoán cho năm vòng bây giờ được đo.

---

## Một, bắt giữ

```
Breakpoint 1, 0x000000000be70660   (sdk_base 0x0bdd2000 + 0x9e660)
=== svcSetHeapSize CALLED ===
  x0 (out pointer) = 0x100c703f58
  x1 (SIZE)        = 0xc9200000   3374317568 bytes = 3218.0 MB
  lr (caller)      = 0xbe58868    sdk+0x86868
  sp               = 0x100c703f20
```

|Tìm kiếm|Giá trị|
|---|---|
|**Hap kích cỡ yêu cầu**| **`0xC9200000` = 3,374,317,568 bytes ≈ 3218 MB ≈ 3.14 GiB** |
|** Caller**| **`sdk+0x86868`** |
|Điểm ngoài| `0x100c703f58` — a **stack** address (`sp + 0x38`), so the caller stores the returned base locally |

Khuyến mãi cho phép chúng ta chơi game 512 MB. Yêu cầu thật sự là 3218 MB — 6.3× lớn hơn.**

## 2. Con số đến từ đâu — và đoán đúng

`0xC9200000` sits just below our own `get_info` **case 6** value:

```
get_info type 6 (TotalMemoryAvailable)  returns  0xCD500000   = 3442 MB
game asks for                                    0xC9200000   = 3218 MB
difference                                       0x04300000   =   67 MB
```

**The game computes `size = TotalMemoryAvailable − 67 MB` and asks for that.** Our `get_info` case 6 value of
`0xCD500000` (~3.2 GiB) — which was chosen as "like an application" — turned out to be **very close to
đúng**, và định mệnh là nhất quán.

**Vì vậy, mô hình bộ nhớ ở cảng là âm thanh.** Sự thất bại không bao giờ là con số — đó là cuộc gọi
Không bao giờ làm được.**

## Ba, tại sao cảng không bao giờ thành công.

The caller is **`sdk+0x86868`**. Context from earlier rounds:

|Địa chỉ|Ký hiệu/ Nghĩa|
|---|---|
| **`sdk+0x86868`** | **the caller of `svcSetHeapSize`** |
| `sdk+0x86bd8` | `nnosInitialize` — **the port calls this** |
| `sdk+0x86d6c` | inside `nnosInitialize`, where it calls `nnosGetDefaultUserExceptionStackForApplication` |

**The caller sits `0x370` bytes before `nnosInitialize`.** So it is either a separate function immediately
Trước đó, hoặc một phần trước đó của cùng một vùng khởi đầu.

**The port calls `nnosInitialize` but evidently never reaches `sdk+0x86868`.** Two candidate reasons, neither
thử ra:

1. **`sdk+0x86868` is a different function that the port simply never calls** — i.e. the port starts one step
   Quá muộn rồi.
2. **Nó đã được chạm tới, nhưng một lính gác gửi nó xuống một con đường mà bỏ qua cuộc gọi** — hợp lý, đã đưa ra
   `nnosGetDefaultUserExceptionStackForApplication` (a **missing import**) returned 0 inside this same region.

## Điều này chứng minh gì?

|Mục|Tình trạng|
|---|---|
| `svcSetHeapSize` breakpoint |**HIT** — trình mô phỏng không phục vụ nó cho khách; ** Trò chơi gọi nó là**|
|**Một đống hỗn độn **| ✅ **`0xC9200000` = 3218 MB** |
|** Địa chỉ caller**| ✅ **`sdk+0x86868`** |
|Văn bản ngoài tiêu đề| ✅ **stack local (`sp+0x38`)**, matches the disassembly |
|Cỡ| ✅ **`TotalMemoryAvailable − 67 MB`**, using our own case-6 value |
|Mô hình bộ nhớ cổng|♪ sound** — con số không bao giờ là vấn đề|
|Name|Đây là khoảng cách.|

## 5 Điều này không xác minh

- **`sdk+0x86868` was not resolved to a symbol name.** Whether it is a distinct function or part of another is
  không rõ.
- **Tại sao cổng không đến được nó không được xác định** - 2 ứng cử viên ở trên không được thử nghiệm
- ** Dù nó được gọi một lần hay nhiều hơn nữa — chỉ có cú đánh đầu tiên được nhìn thấy; điểm ngắt tiếp tục và không xa hơn
  đã được báo cáo, nhưng thời gian chạy rất ngắn.
- **`InitializeAllocator` was not caught** to confirm it receives `0xC9200000`.
- ** Cổng không thay đổi và vẫn chưa khởi động.** Không có gì được mở. ** Đây không phải trò chơi có thể chơi.**

## 6. Tăng dần

**Resolve `sdk+0x86868` and disassemble around it** in the retail `sdk` image:

- Nếu nó là một chức năng với phần mở đầu của riêng nó nó là khởi đầu mục nhập các cổng nên gọi thay vì (hoặc
  before) `nnosInitialize`**;
- Nếu nó nằm bên trong một chức năng lớn hơn * chức năng nào đó *, và những gì bảo vệ trước khi gọi.

Hoặc là trả lời cho cổng chính xác phải gọi, với kích thước nó bây giờ biết chính xác.

---

## Tại sao vòng này lại quan trọng hơn một vài vòng trước đây

Đối với năm vòng khối bên trái là một dự đoán: 64 MB, sau đó 512 MB, được chọn bởi vì không có cơ sở. **Nó bây giờ là một
measured value from the shipping game** (`0xC9200000`), with a **verified derivation** from a value the port
Đã trở lại, và một **single tên địa chỉ** chịu trách nhiệm yêu cầu nó.

Tác phẩm còn lại không còn là "giải phóng cái bẫy" — nó là ** Gọi đúng chức năng, mà là cảng
Đã có số điện thoại rồi.
