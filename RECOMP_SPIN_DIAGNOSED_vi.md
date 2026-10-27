# Treo là một SPIN, và chỉ công nhân đang ngủ

Đây là chẩn đoán sắc bén nhất mà dự án đã thực hiện.

---

## 1. Thí nghiệm A: kiệt sức do động mạch gây ra —  hội nghị địa phương

Hiệp 10 đánh dấu một đống 64 MB game cố định như là một nguyên nhân thay thế chưa được kiểm tra của vụ treo cổ.

|Heap kích cỡ|Kết quả|
|---:|---|
|64 MB| hang at `main init[1367]` |
|**512 MB (8)**| **hang at `main init[1367]`** |

** 8 lần bộ nhớ không thay đổi gì.** Việc treo cổ không phải là áp lực định vị. đó là giả thuyết
**disproed**, rẻ tiền, và nó là đúng để kiểm tra nó trước.

## Thử nghiệm B: sợi dây treo thực sự là gì?

No debugger is installed (`gdb`, `eu-stack`, `pstack` all missing), so the kernel's own view was used
Trong khi quá trình được treo lên:

```
wchan: 0
threads: 3
  tid 14968  wchan=0                     state=R     <- the main thread
  tid 14970  wchan=hrtimer_nanosleep     state=S
  tid 14971  wchan=hrtimer_nanosleep     state=S
```

**Điều này loại bỏ hai trong ba giả thuyết còn lại và xác nhận điều thứ ba:**

|Sự giả hình|Bằng chứng hạt nhân sẽ là|Quan sát|Lệnh nhập|
|---|---|---|---|
|Quay-chờ trên một khóa| `state=R`, `wchan=0` |**Chính xác là**|Nó là một sự quay cuồng.|
|Tham gia Thread| `state=S`, wchan in `futex`/`wait` |Tình trạng là R|tôm đã bị loại|
|Ngăn cản chờ đợi / ngủ| `state=S` |Tình trạng là R|tôm đã bị loại|

**The main thread is burning CPU in a busy loop** (`wchan=0` means it is not blocked in the kernel at
all), inside `nn::nex::PseudoGlobalVariable<nn::StreamSettings>::PseudoGlobalVariable()+0x3cc`.

## 3. Sự tìm kiếm sau đó

♪ Có ba sợi chỉ. ♪ Sợi chỉ chính xoay vòng, và hai sợi kia đang ngủ ♪
(`hrtimer_nanosleep`) — so the runtime *does* create threads, and they are alive but idle.

**The most economical reading is that `main` is spinning on a condition that the sleeping worker
Các sợi chỉ phải được thỏa mãn, và những sợi này đang ngủ bởi vì công việc mà họ nên được thực hiện là
chưa bao giờ giao cho họ hoặc chưa bao giờ hoàn thành.**

Đó là một *shape * của lỗi cổng này chưa nhìn thấy trước đây: không phải là một hằng số sai, không phải một mất tích
Bộ điều khiển, nhưng **a bắt tay qua đường khi một bên quay và người còn lại ngủ.
HLE provides no real service behind `nex`, so anything waiting on networking activity would spin
Mãi mãi — vừa vặn.

**Đây là giả thuyết với bằng chứng vững chắc, chứ không phải một kết luận được chứng minh.**

## Điều này chứng minh gì?

|Mục|Tình trạng|
|---|---|
|Hết tác động rồi.|**DISPROVED** (512 MB, cùng treo cổ)|
|Treo là rào chắn chờ đợi|**DISPROVED** (S R, không S)|
|Treo là một sợi chỉ kết hợp|**DISPROVED** (S R, không S)|
|Treo là một vòng.| ✅ **CONFIRMED** (`state=R`, `wchan=0`) |
|Số lượng Thread|**3** — quay chính, hai ngủ|
|Địa điểm| ✅ `main+d5a238`, `nn::nex::PseudoGlobalVariable<StreamSettings>+0x3cc` |

## 5 Điều này không xác minh

- Vẫn chưa xác định được tình trạng vòng thời gian.
  Thỏa mãn với bằng chứng nhưng không được chứng minh.
- **Những gì hai sợi chỉ ngủ là** không được xác định — không có tên chỉ, không có chồng (không có gỡ lỗi).
- Nó phải bị giết.
- **`main`'s total constructor count remains unknown.**
- **`nnMain` has still not been reached.**
- **Không NVN, không cửa sổ, không trình bày.** Hiển thị và âm thanh là các chấm.
- **Đây không phải trò chơi khởi động.**

## 6. Tăng dần

Install a debugger (`sudo apt install gdb`, which needs network/root — neither of which this session
đã có) **or** Thêm một con chó SIGALRM *inside* thời gian chạy mà, sau N giây mà không có tiến bộ, in dấu vân tay
the guest `pc`/`lr` through `describe()`. Either names the spinning function precisely — which is what
đã làm cho tất cả những thất bại trước đây dễ uốn nắn.

Con đường vào-saserion là con chó giữ cửa, bởi vì nó không cần gói mới và việc xuất lỗi
Máy móc đã được viết ra rồi.
