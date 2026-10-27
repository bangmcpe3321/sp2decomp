# The SIGSEGV, diagnosed: `nn::os::LockMutex` on uninitialised state

Hiệp 6. Vụ tai nạn vô danh ở hiệp 5 giờ đã được xác định rõ** - địa chỉ lỗi, chức năng khách mời,
đăng ký tình trạng và tiếp tục truy ngược lại.

---

## 1. bản báo cáo

```
=== HOST SIGSEGV ===
  fault address : 0x1b8  1b8
  guest lr      : 0x7140080ddc  sdk+80ddc (_ZN2nn2os9LockMutexEPNS0_9MutexTypeE+48)
  guest sp      : 0x6a00ffff00

  x0  00000071406b41b0 00000071406c6158 000000714068b000 00000071406c5b90
  x4  0000000000000000 00000071406bf5c1 00000071406bf5c0 00000071406bf5c0
  x8  0000000000000000 0000000000000f50 ffffff8ebf93b3c0 000000714032d768
  x12 0000007140311a30 0000006f00000030 0000006f00000000 0000007140311a30
  x20 0000000000000000 0000000000000000 0000000000000000 0000000000000000
  x28 0000000000000000 0000006a00ffff10 0000007140080ddc 0000006a00ffff00
  host backtrace: #0..#22 (generated C++ frames)
```

**The crash is in Splatoon 2's own `nn::os::LockMutex(MutexType*)`, at `+0x48`, dereferencing
address `0x1b8`.**

## 2 nghĩa là gì?

`0x1b8` is a small offset — the signature of **a null (or near-null) base plus a field offset**. The
call is guest code in `sdk`, not an HLE stub: it is Splatoon 2's own mutex implementation reading a
field at `+0x1b8` from a pointer that is not valid.

Khóa im lặng là một trong những điều đầu tiên gần như bất kỳ con đường đầu tiên làm. **Điều kinh tế nhất
explanation is that the state `LockMutex` reads has never been initialised** — because the code that
would initialise it belongs to SDK system start-up, and **this port enters the game at `nnMain`,
Bỏ qua nó.

That is a **direct consequence of the round-3 decision** to enter through `nnMain` rather than
`nn::init::Start`. That decision was correct in motivation — Splatoon 2's SDK predates
`nn::init::Start` and exports no such symbol — but **"no `nn::init::Start`" does not mean "no system
Khởi tạo". Slaptoon 2 của SDK phải có tương đương với của nó, và cổng đã không tìm thấy hoặc chạy
nó.

## 3. Bằng chứng cho việc đọc sách

|Quan sát|Hỗ trợ|
|---|---|
| `x20..x27` are **all zero** |người gọi thông qua không có ngữ cảnh; tình trạng khởi tạo là vắng mặt|
| fault at a **small offset** (`0x1b8`) |@ info/ rich|
| fault inside **`LockMutex`**, very early |imtx sử dụng là hành vi sớm|
| `sdk: _init at +0x24` ran, then this | the module's `_init` ran, but system init did not |

**Đây là một giả thuyết với bằng chứng xác thực, không phải một kết luận đã được chứng minh.**

## 4 cái gì còn thiếu

Splatoon 2's `nn::init` surface is four symbols (`GetAllocator`, `InitializeAllocator`, and two
Trợ lý điều hòa phát triển chỉ. Một bộ phận tạo âm thanh cần một con trỏ chỉ và một bảng khóa —
normally set up by the SDK's `nninitStartup`/`nninitStart`. Candidates the port has not yet tried:

- another exported init symbol in `main` or `sdk` (not yet enumerated);
- the `__rtld_init` hook the runtime already provides, which the `nn::init::Start` path passes as an
  lập luận;
- the runtime's own `kernel_init()`/`memory_init()` being insufficient for what this SDK expects.

**Không có cái nào trong số này được thử nghiệm.** Tìm ra trình tự nhập đúng là tăng dần tiếp theo.

## 5 là lỗi của tôi.

Added to `platform_linux.cpp`: `SIGSEGV`/`SIGBUS`/`SIGILL`/`SIGFPE` with `SA_SIGINFO | SA_ONSTACK`,
báo cáo

- the faulting address, resolved through `nx::describe()`;
- **guest `lr` and `sp`**, also resolved — which is what named `nn::os::LockMutex`;
- the full register file, four per line, as the runtime's own `dump_guest` does;
- a host backtrace (glibc `execinfo`, declared locally since the header is not always present).

It `_exit(70)`s rather than resuming a guest that has already faulted.

** Đây là cùng một kỹ thuật mà bộ khai thác vòng 1 sử dụng**, và nó đã chuyển đổi một vụ tai nạn vô danh thành một
được gọi là chức năng trong một chạy.

## 6, vòng này chứng minh cái gì?

|Mục|Tình trạng|
|---|---|
|Trình quản lý lỗi|_ Thêm vào đó, làm việc|
|Tìm thấy SIGSEGV| ✅ **`nn::os::LockMutex+0x48`, fault address `0x1b8`** |
|Khách đăng ký có lỗi|tôm bắt được (x20–x27 tất cả)|
|@ info: status|(music)|
|Rất có thể là nguyên nhân|sDK đã được điều chỉnh lại — cửa vào sẽ đi qua hệ thống trong nó**|
|Sửa|▪ Không được thiết kế hay thử|

## 7 Những gì điều này không xác minh

- ** Lý do là một giả thuyết.** "System init init was passed" phù hợp với các bằng chứng nhưng chưa được kiểm tra**.
- ** Dãy mục nhập chính xác cho Splatoon 2's SDK không được tìm thấy.** Các ký hiệu init của nó không phải
  Được liệt kê.
- **Không có sự khởi tạo trò chơi nào đã hoàn thành.**
- ** The HLE vẫn chưa được phân loại** — đóng dấu 116 ký hiệu, không ai gọi một cách đầy ý nghĩa.
- **Không NVN, không cửa sổ, không trình bày.**
- ** Máy in có khung vết lùi không được biểu tượng** — chúng là những địa chỉ thô trong 140 MB
  generated binary; resolving them would need the runtime's `describe()` fed with the load base.
- **`x1b8` was not mapped to a specific field** of `MutexType`.

## 8 Thêm vào

Tính toán mục nhập và xuất khẩu SDK của SDK và xác định ai thực hiện sự khởi tạo của hệ thống
for a pre-`nn::init::Start` SDK; then run it before `nnMain`. The fault handler now makes any wrong
Đoán rẻ để đánh giá — nó đặt tên cho chức năng mỗi lần.
