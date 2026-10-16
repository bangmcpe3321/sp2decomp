# Danh sách công việc port: boot tới menu chính

[English](PORT_WORKLIST.md)

Sinh ra từ đồ thị lời gọi đã giải mã. Mỗi mục là một hàm platform mà tập đóng
(closure) của quá trình boot **thực sự gọi**, kèm theo mọi điểm gọi từ closure đó,
để việc triển khai được viết dựa trên cách dùng **quan sát được** thay vì một
signature phỏng đoán.

> `open-ead/nnsdk` **không có** thư mục header `include/nn/os/`, nên các hợp đồng
> (contract) của `nn::os` không được ghi lại ở đâu công khai. Các điểm gọi bên dưới
> chính là hợp đồng có thẩm quyền.

Closure: **184** hàm. Số hàm platform được gọi: **51**.

Các bảng đầy đủ theo từng phase nằm trong bản tiếng Anh:
**[PORT_WORKLIST.md](PORT_WORKLIST.md)**. Bảng đó **không dịch**, vì nội dung chủ
yếu là các định danh kỹ thuật phải giữ nguyên.

---

## Tóm tắt theo phase

Thứ tự triển khai được suy ra từ chính closure: nếu một hàm nằm dưới hàm khác trên
đường tới frame đầu tiên, nó phải chạy được trước.

### Phase 1 — nền tảng bộ nhớ và OS (phải chạy được trước tiên)

| Subsystem | Số hàm | Ghi chú |
|---|---:|---|
| `nn::os` | 24 | thread, TLS, mutex, semaphore, message queue, tick |
| `nn::mem` | 5 | `StandardAllocator` và các phương thức của nó |
| `nn::init` | 1 | `InitializeAllocator` |

**Đây là nền móng thật sự.** Stub ở đây sẽ khiến boot **treo im lặng**, vì
`Lp::Sys::RootTask` điều phối việc khởi tạo qua `WorkerThreadMgr` và chạy trên
chính các primitive này. `return 0` là không đủ.

### Phase 2 — vòng đời, thời gian, ghi log

| Subsystem | Số hàm | Ghi chú |
|---|---:|---|
| `nn::time` | 4 | `Initialize`, `StandardUserSystemClock::GetCurrentTime` |
| `nn::oe` | 1 | vòng đời ứng dụng |
| `nn::diag` | 1 | `LogImpl` |
| `nn::util` | 1 | `VSNPrintf` |
| `nn::nifm` | 1 | **hãy stub, đừng viết thật** — xem ghi chú bên dưới |

### Phase 3 — filesystem

| Subsystem | Số hàm | Ghi chú |
|---|---:|---|
| `nn::fs` | 2 | `MountRom`, `QueryMountRomCacheSize` |

`MountRom` là cách `romfs` trở nên nhìn thấy được. **Không có nó thì không nạp
được gì** — nên đây là bức tường thật đầu tiên cần vượt.

### Phase 4 — hiển thị và khởi động NVN

| Subsystem | Số hàm | Ghi chú |
|---|---:|---|
| `nn::vi` | 6 | display, layer, vsync event, scaling |
| `nv` | 2 | `InitializeGraphics`, các allocator |
| `nvn` | 2 | `nvnBootstrapLoader`, `nvnLoadCProcs` |

NVN là API kiểu Vulkan, nên tầng này ánh xạ tương đối trực tiếp sang Vulkan.

### Phase 5 — `nn::gfx`

Chưa có hàm `nn::gfx` nào nằm trong closure của đường boot tới frame đầu tiên, dù
subsystem này có 289 hàm trong binary. Nó được chạm tới sau đó, qua
`sead::GameFrameworkNx::initializeGraphicsSystem`.

### Phase 6 — khác

Không có mục nào.

---

## Ghi chú

- **Địa chỉ là địa chỉ tuyệt đối trong module**, với image base `0x7100000000`.
- **Số điểm gọi chỉ tính trong closure của boot.** Một hàm có thể còn nhiều chỗ gọi
  khác trong binary; những chỗ đó không nằm trên đường boot nên không được tính.
- **Chính sách stub:** `nn::os`, `nn::mem` và `nn::init` **phải là thật**. Stub
  `return 0` ở tầng thread hoặc allocator sẽ khiến boot treo im lặng thay vì lỗi rõ
  ràng, vì `Lp::Sys::RootTask` điều phối việc khởi tạo qua `WorkerThreadMgr` và
  chạy trên các primitive đó.
- **`nn::nifm` nên được stub, không nên viết thật** — đó là trình quản lý giao diện
  mạng, và nó vẫn bị chạm tới ngay cả trên đường boot chỉ offline. Stub nó là đúng;
  viết thật nó là công sức lãng phí cho cột mốc này.
- **Đây là cận dưới, không phải tổng số.** Các lệnh gọi gián tiếp qua thanh ghi
  (`BLR`) không nhìn thấy được bằng phương pháp này, và 60.025 hàm trong binary có
  địa chỉ được lấy (address-taken). Những hàm nào trong số đó mà boot thực sự chạm
  tới thì cần devirtualisation mới trả lời được.

---

## Cách tái lập danh sách này

Bảng đầy đủ được sinh tự động, nên đừng sửa nó bằng tay:

```bash
node tools/static/port-worklist.mjs main.elf inventory.txt PORT_WORKLIST.md
```

Script này BFS đồ thị lời gọi đã giải mã từ sáu root của boot, rồi với mỗi hàm
platform tìm được, nó liệt kê mọi điểm gọi trong closure.

Một chi tiết quan trọng trong cách tính: **`BL` luôn luôn là một lệnh gọi, còn `B`
chỉ được tính là tail call khi đích của nó là điểm bắt đầu của một symbol.** Nếu
tính mọi lệnh `B`, bạn sẽ biến các nhánh nội bộ trong thân hàm thành những "hàm"
không hề tồn tại — chính lỗi này đã từng khiến closure bị báo sai thành 232 thay
vì 184. Chi tiết ở [BOOT_CALLGRAPH.md](BOOT_CALLGRAPH.md).
