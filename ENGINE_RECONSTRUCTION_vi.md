# Xây dựng lại cơ chế: bắt đầu điểm

Lớp nền đã hoàn thành và kiểm tra chéo cấu trúc
Đây là lớp kỹ thuật ****_BAR_SIZES.md.}* Đây là lớp cơ khí ************ Bản sao của sự tái tạo
Nó là một quy mô khác của vấn đề, vì vậy tài liệu này sửa chữa một ràng buộc, đặt hàng
Mục tiêu không phải là danh sách 113.000 chức năng.

---

## 1. Mục tiêu bị giới hạn: quan hệ phụ thuộc trực tiếp của người chủ khởi động

`Lp::Sys::SysInit::Init` (`0x71011f5b20`, 1308 bytes) is the boot entry. Its decompiled
Cơ thể gọi **13 chức năng động cơ**, theo thứ tự hiển thị đầu tiên.
Cơ thể bị phân hủy, vì vậy công việc có thể bắt đầu ngay lập tức:

| # |Hàm|Địa chỉ|Thân|
|---:|---|---|---|
| 1 | `Lp::Sys::SysInit::Init` (the root itself) | `0x71011f5b20` |1308 B|
| 2 | `Lp::Utl::dumpDateTime` | `0x71012cdbf4` |216 B|
| 3 | `sead::AssertConfig::registerCallback` | `0x7101397fac` | â |
| 4 | `sead::Framework::InitializeArg::InitializeArg` | `0x7100e69894` | â |
| 5 | `sead::GameFrameworkNx::initialize` | `0x7100eb9f1c` | â |
| 6 | `Lp::Utl::dumpMemoryInfo` | `0x71012cdccc` |408 B|
| 7 | `sead::ForegroundBucketMgr::initialize` | `0x7100eb9f1c` | â |
| 8 | `HeapGroup::createInstance` | `0x7100ea1f54` | â |
| 9 | `HeapGroup::createHeap` | `0x71011f5130` | â |
| 10 | `Framework::Framework` | `0x7100e696a4` | â |
| 11 | `sead::GameFrameworkNx::initializeGraphicsSystem` | `0x7100e6738c` | â |
| 12 | `sead::TaskBase::MgrTaskArg::MgrTaskArg` | `0x7100e6b7bc` | â |
| 13 | `sead::Framework::RunArg::RunArg` | `0x7100e698a0` | â |

**13 chức năng, chứ không phải 113.000.** Đó là cột mốc đầu tiên dễ uốn nắn, và đó là nơi mà
Động cơ phải được dựng đứng trước bởi vì người chủ không thể tiếp tục mà không có nó.

> **Collision resolved.** Rows 5 and 7 originally shared the address `0x7100eb9f1c`
> because `tools/static/boot-dep-coverage.mjs` matched on the trailing name `initialize`,
> Mà một số chức năng mang theo một thời Ghidra dải tênspace.
> mang tên không gian đầy đủ với địa chỉ, vì vậy nó bây giờ là nguồn có thẩm quyền và
> Việc so sánh tên chỉ là hậu quả mà **reports mơ hồ thay vì chọn một**.
> Sửa đổi:
>
> |Hàm|Địa chỉ|Cỡ|
> |---|---|---:|
> | `sead::GameFrameworkNx::initialize` | `0x7100e6724c` |20 B|
> | `sead::ForegroundBucketMgr::initialize` | `0x710139fb3c` |4 B|
>
> Tất cả 13 phụ thuộc bây giờ giải quyết dứt khoát.

## 2. The four `Lp::Utl` diagnostics ports are the natural first increment

`dumpDateTime` and `dumpMemoryInfo` are fully readable and small. `dumpDateTime` is the
**Điều đầu tiên rất đầu tiên rễ giày làm**, và cơ thể cho thấy hình dạng phụ thuộc chính xác
Cổng động cơ sẽ có:

```c
void Lp::Utl::dumpDateTime(char const *)          // 0x71012cdbf4, 216 bytes
{
  sead::DateTime dt;
  sead::DateTime::DateTime(&dt, 0);
  sead::DateTime::setNow(&dt);                    // real clock, via nn::time
  sead::CalendarTime ct(&ct, cDefaultYear, cDefaultMonth, cDefaultDay,
                        cDefaultHour, cDefaultMinute, cDefaultSecond);
  ...
}

void Lp::Utl::dumpMemoryInfo(char const *)        // 0x71012cdccc, 408 bytes
{
  nn::os::QueryMemoryInfo(&memInfo);              // platform layer â already implemented
  ...
}
```

Hai điều này chứng minh:

1. **`dumpMemoryInfo` already reaches into the platform layer** via
   `nn::os::QueryMemoryInfo`, which `port/` implements. The two layers meet here, so this
   Chức năng là điểm tích hợp chính xác đầu tiên.
2. **`dumpDateTime` needs `sead::DateTime` and `sead::CalendarTime`** â the first real
   engine dependency, and both are covered by `open-ead/sead`.

## 3 Tài liệu tham khảo được kiểm tra

`tools/wsl/wsl-clone-refs.sh` clones what the reconstruction needs. All four are present:

|Ủy thác|Cỡ|Độ cao|
|---|---:|---|
| `open-ead/sead` |2.5 MB| **the** reference for the `sead::` layer â framework, heap, thread, gfx |
| `open-ead/agl` |720 KB|Đồ họa/ ánh sáng (sau này)|
| `open-ead/nnware` |620 KB| `g3d`/`ui2d`/`atk` headers |
| `open-ead/eui` |260 KB|UI|

**Licensing remains unresolved.** `sead` ships **no licence file** â the same problem
[GRAPHICS_NVN.md](GRAPHICS_NVN.md) flagged for `nnsdk`. `deko3d` is permissively licensed
and is a counter-example within the same ecosystem. **Do not incorporate `sead` source
Cho đến khi điều này được giải quyết**; sử dụng nó như một tham chiếu đọc * trong khi đó, đó là những gì
"tham khảo" nghĩa là ở đây.

## 4 phương pháp: thất bại lớn tiếng, không stab eub elect* now cài đặt và thực hiện**

Lớp nền đã sử dụng stub-và-doment thành công bởi vì lớp của nó đã bị giới hạn.
Lớp động cơ là quá lớn đối với đó â tôm ngựa im lặng sẽ cho phép các khai thác "qua" trong khi
Bỏ hầu hết công việc.

`port/include/lp/recon.hpp` now provides this. Reconstructed code declares a dependency
Nó không có:

```c
LP_ENGINE_REQUIRE("sead::HeapMgr::createCurrentHeap", 0x7100e6b7bc);
```

which throws `MissingEngineDependency` carrying **the name and the address**.

`port/src/boot_sequence.cpp` walks the boot root's observed order, calling reconstructed
Các báo cáo hiện thời, thực sự:

```
reconstructed steps completed: 3
  [1] Lp::Utl::dumpDateTime(" Application Start Time")
  [2] nn::os::GetSystemTick -> sRunStartTime
  [3] sead::AssertConfig::registerCallback
STOPPED AT: sead::GameFrameworkNx::initializeGraphicsSystem (0x7100e6738c)
```

**Đó là số đo tiến trình.** Nó là một tuyên bố về việc xây dựng lại bao xa
đến, không phải là một thẻ/fail của một khởi động mô phỏng. Khi mỗi chức năng được gửi đi, danh sách sẽ tăng trưởng
Và trạm dừng di chuyển xuống lệnh khởi động.

### Một hệ quả đáng được biết.

`dumpMemoryInfo` **is** ported, but it sits after three unported dependencies in the boot
Lệnh của người chủ. vì vậy nó hiện nay
Không thể tiếp cận thông qua các chuỗi mặc dù nó hoạt động. đó là hành vi chính xác, và nó
được ghi lại ở đây để khoảng cách không phải là đáng ngạc nhiên.

## Sổ cái tiến hành 5.

|Phụ thuộc khởi động|Tình trạng|
|---|---|
| `Lp::Utl::dumpDateTime` | **ported** (`port/src/utl.cpp`) |
| `nn::os::GetSystemTick` |** xuất khẩu** (tách khổ hình)|
| `sead::AssertConfig::registerCallback` | **ported** (`port/src/delegate_event.cpp`) |
| `sead::Framework::InitializeArg::InitializeArg` | **ported** (`port/src/framework_args.cpp`) â step 4 |
| `sead::GameFrameworkNx::initialize` |**next ********* (Tiếng gọi)|
| `Lp::Utl::dumpMemoryInfo` |** xuất khẩu**, nhưng không thể liên lạc cho đến những vùng đất phía trên|
| `sead::ForegroundBucketMgr::initialize` |** xuất khẩu** (4-byte no-op)|
| `HeapGroup::createInstance` / `createHeap` | **ported** (`port/src/heap_group.cpp`) |
| `Framework::Framework` | **ported** (`port/src/framework_args.cpp`) |
| `sead::GameFrameworkNx::initializeGraphicsSystem` |chưa được gửi|
| `sead::TaskBase::MgrTaskArg::MgrTaskArg` | **ported** (`port/src/task_base.cpp`)  but it sits AFTER initializeGraphicsSystem, so porting it does NOT advance the runner |
| `sead::Framework::RunArg::RunArg` | **ported** (`port/src/framework_args.cpp`) |

**Supporting primitives ported:** `sead::ListNode` (`insertFront_`, `insertBack_`,
`erase_`), `sead::DateTime`/`CalendarTime`, `sead::DelegateEvent`/`Slot`, and
`sead::Framework::InitializeArg`/`RunArg`.

### Tại sao bước tiếp theo là một bước nhảy trong khó khăn, không phải là một bước nhỏ

`sead::GameFrameworkNx::initialize` (`0x7100e6724c`) decompiles to just:

```c
void sead::GameFrameworkNx::initialize(InitializeArg const& arg) {
    GameFramework::initialize(arg);      // NOT ported
    PerformanceMgrNx::initialize();      // NOT ported
}
```

** Mở nút gói này sẽ không được nhìn thấy.** Người chạy sẽ đi trước một dòng
and stop at `GameFramework::initialize`, which is a large subsystem â heap, task manager
và thiết lập đồ họa đằng sau nó không phải là một chức năng.

Đó là một sự thay đổi thực sự. bốn phụ thuộc đầu tiên là nhỏ và tự bảo vệ;
Cái này mở ra một cây con, ghi âm để vòng tiếp theo bắt đầu với kỳ vọng đúng đắn
Thay vì giả sử tỷ lệ tương tự vẫn tiếp tục.

## 6 Một tuyên bố chân thật

- **13 chức năng** trên đường dẫn trực tiếp của người chủ khởi động, và tài liệu này tồn tại
  Giữ cho công việc neo ở đó.
- **126** trong việc đóng cửa khởi động rộng hơn [ENGINE_REFERCE.md].
- **~113,000** total in `main`. This is community-decompilation scale â years, not
  các buổi điều trị.

Khởi động đối vớimenu là mục tiêu duy nhất có thể biện hộ, và ngay cả điều đó yêu cầu hệ thống đồ họa để
come up: row 11 is `initializeGraphicsSystem`, and `sead::GameFrameworkNx::initialize`
(throw 5) chạy ** trước** nhóm chồng chất được tạo ra (ngày 8 tháng 8. thứ tự không phải là
tiến trình chuyển đổi đồ họa cuối cùng đó
Được rồi, được rồi.

## 6. Tăng dần, theo thứ tự

1. Port `Lp::Utl::dumpDateTime` and `Lp::Utl::dumpMemoryInfo` against `open-ead/sead` as a
   reading reference, with `dumpMemoryInfo` exercising the platform layer through
   `nn::os::QueryMemoryInfo` for the first time.
2. Resolve the `ForegroundBucketMgr::initialize` address collision (Â§1 caveat).
3. Add a `reconstructed/` target to the CMake build and have the boot harness call
   Mã động cơ được xây dựng lại thay vì lặp lại các mô hình.
4. Cài đặt các báo cáo phụ thuộc thất bại được mô tả trong  vội vàng.
