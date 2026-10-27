# Nhận được sự thật mặt đất: gắn GDB để Slatoon 2 chạy trong Ryujinx

Các câu hỏi còn lại của cảng không thể trả lời từ cảng, bởi vì các cảng **skips** mã trong
Vì vậy chúng tôi gắn một máy gỡ lỗi vào trò chơi **real chạy trong Ryujinx** và đọc nó thay vào đó.

Vòng này có kết nối hoạt động và xác nhận địa chỉ số học chống lại khách.

---

## 1, cản trở, và thủ thuật đánh bại nó.

**WL2 không thể tới một dịch vụ Windows.** Xác nhận, không giả định:

- Ryujinx's GDB stub listens on **`0.0.0.0:55555`** and accepts from Windows (`127.0.0.1` connects fine)
- WSL2 connecting to the Windows host (`172.17.144.1:55555`) **times out**
- A firewall rule for port 55555 (`Enabled: True, Action: Allow, Profile: Any`) **did not help**
- ** Mạng lưới WSL đã được cung cấp không sẵn sàng** — nó cần Windows 11 2H2+; máy này là ** Cửa sổ 10 tòa nhà 19044**
- No Windows-side aarch64 `gdb` exists on the machine
- nhưng bảng tuyến của HurP thì không** lấy mạng phụ WSL

** Trò lừa đảo — đảo ngược hướng.** Windows*can* đến WSL. Vậy một cây cầu hai phần làm ** Cửa sổ khởi động
Cả hai kết nối**, và không có gì trên Windows phải chấp nhận mục đích:

```
gdb (WSL)  ->  127.0.0.1:55556   [ WSL bridge ]
                                         |
                                         |  paired, bytes pumped both ways
                                         |
Windows bridge  ->  WSL:55557  (outbound)
                ->  127.0.0.1:55555  (outbound, the Ryujinx stub)
```

**Không có quảng cáo, không có luật tường lửa, không có mạng lưới phản chiếu.** Đây là kết quả có thể tái sử dụng.

Hai ghi chú thực hiện mà tốn thời gian:

- **`wsl -d Ubuntu -- bash -c '... &'` loses its children** when the command exits. The bridge must run as the
  Quá trình trực tiếp của WSL trong việc cầu khẩn.
- **PowerShell `.ps1` files are blocked** by execution policy, and `[Task]::Run([scriptblock], …)` has no such
  overload. Use **`NetworkStream.CopyToAsync`** — it works and removes the threading entirely.
- Các cặp cầu **one** gdb với **one** kết nối Windows, vì vậy nó phải được khởi chạy lại trong mỗi phiên chạy gỡ lỗi.

## Nói chuyện với vị khách thật sự

`gdb` (Ubuntu 17.1) is **x86-64 only** — `set architecture aarch64` fails with "Undefined item". Installed
**`gdb-multiarch`**, which reports `The target architecture is set to "aarch64"` and connects.

**Người phụ trách thành công đầu tiên** đặt chúng tôi vào:

```
pc  0xbe707ac   =>  svc #0x1c
                    ret
                    svc #0x1d
                    ret
                    svc #0x1e ...
```

**That is the SDK's SVC stub table** — the same one found statically. The port had been sitting **`0x14c` bytes
from `svcSetHeapSize`** without knowing it.

## 3 cơ sở Môđun, đã tìm và kiểm tra

Scanning the live guest address space for `MOD0` headers (`main+0x8 == "MOD0"`, so `base = MOD0 - 8`) and then
**verifying each candidate** by reading `*(base + 0x9e660)` and checking for `svc #1` (`0xD4000021`):

```
--- 5 MOD0 module headers found ---
  module base 0x0bb9f000
  module base 0x0bd49000
  module base 0x0bd7b000
  module base 0x0bd8e000
  module base 0x0bdd2000   <== SDK (svc #1 verified at +0x9e660)
```

**`sdk_base = 0x0bdd2000` — confirmed two independent ways:**

|Phương pháp|Kết quả|
|---|---|
| Stub-table arithmetic: PC `0xbe707ac` minus image offset `0x9e7ac` | `0xbdd2000` |
| MOD0 header scan + `svc #1` probe at `+0x9e660` | `0xbdd2000` |

Cả hai đều đồng ý, và kết quả là ** page-ign** — đó là tấm séc làm cho số học đáng tin cậy.

**`svcSetHeapSize` = `0xbe70660`.**

**And a significant secondary confirmation:** the offsets this project derived *statically* (`sdk+0x9e660`,
bố trí xếp chồng, cấu trúc 1 điểm-SVC) ** tương ứng với mô- đun còn sống hte-byte**.
Tính toán trong các vòng trước đó được xác nhận.

## 4 Những gì không bị bắt

**The breakpoint on `svcSetHeapSize` never fired.** The guest was suspended at `0x949ed74` / `0x9783b60` —
**below** the module range found, i.e. in the loader rather than in `game`/`sdk` — and **restarting the title
GDB ngắt kết nối strub**, vì vậy "để lấy điểm ngắt, sau đó khởi động lại" không hoạt động.

**Lấy được cửa sổ cũng cần thiết:**

1. Khởi chạy tiêu đề ** Trong khi gdb đã được kết nối và tiếp tục**, vì vậy khách được bắt giữa
   stb- chấp nhận và cuộc gọi; hoặc
2. determining that **Ryujinx services `SetHeapSize` in its own loader** for the guest — in which case there is
   không có gì để phá vỡ, và **Các khối kích thước là một thiết lập mô phỏng thay vì một cuộc gọi game**. đó sẽ là một
   Điều quan trọng là tìm ra chính nó.

## Điều này chứng minh gì?

|Mục|Tình trạng|
|---|---|
|Ryujinx GDB stb có thể liên lạc từ WSL|Qua cây cầu ngược.|
|Điều luật tường lửa cần thiết|**no — cây cầu tránh được sự tấn công hoàn toàn**|
|Mạng cá nhân đã phản ánh|Không có (cửa sổ 10)|
| `gdb-multiarch` talks to the real guest |_Có|
|Căn cứ Mô- đun đã tìm|♪ Tìm thấy **5|
| **`sdk_base`** | ✅ **`0x0bdd2000`, verified two ways** |
| **`svcSetHeapSize`** | ✅ **`0xbe70660`** |
|Hiệu số tĩnh khớp với mô- đun sống|Xác nhận**|
|Name|♪ Vẫn chưa đâu ♪|
|Điểm ngắt trúng|** Chưa đến — cửa sổ thời gian**|

## 6 Những gì điều này không xác minh

- ** Kích thước chất đống vẫn chưa rõ.** Đây là toàn bộ vấn đề, và nó không được thu thập.
- **Whether `svcSetHeapSize` is ever called in Ryujinx at all is unproven.** If Ryujinx services it in its
  Bộ tải, trò chơi có thể không bao giờ thực hiện nó.
- **`main`'s base was not positively identified** among the five MOD0 hits — `sdk` was identified by its stub,
  những người khác không bị dán nhãn.
- **`rtld`'s base was not located** either.
- Vấn đề thời gian thời gian đã được giải quyết.
- ** Trò chơi không được khởi động ở cổng.** Không có gì được trình bày. ** Đây không phải trò chơi có thể chơi.**

## 7. Văn lệnh tạo (có thể)

|Tập tin|Mục đích|
|---|---|
| `wsl-bridge2.py` |WSL một nửa của cầu đảo ngược (liên kết phụ thuộc theo thứ tự)|
| `gdb-findbase.py` | gdb-Python: scan for `MOD0`, verify the SDK by its `svc #1` stub |
| `gdb-heapsize.cmd` | arm `svcSetHeapSize`, print `x1` (size) and `lr` (caller) |
| `gdb-attach.cmd` |trần kết nối + kho lưu, để xem nhanh|

** Kĩ thuật đảo ngược cầu là phần có thể di chuyển được ở đây** - nó làm cho bất kỳ thanh gỡ lỗi bên Windows
Có thể truy cập từ WSL2 trên Windows 10 mà không có quyền quảng cáo.
