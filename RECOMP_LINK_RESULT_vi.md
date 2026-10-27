# Liên kết: 31 ký hiệu từ một hệ nhị phân hoàn chỉnh

`RECOMP_FIRST_EXECUTION.md` proved one guest function runs. This round did steps 2 and 3 of the
Mục tiêu — biên soạn mọi thứ, liên kết, liệt kê những gì còn thiếu — và câu trả lời thật nhỏ bé.

---

## 1. Mọi thứ biên dịch

|Đặt|Số lượng|Kết quả|
|---|---:|---|
| Generated `main` | 433 |teppi82@ gmail. com|
| Generated `sdk` | 60 |teppi82@ gmail. com|
| Generated `subsdk0..3` | 16 + 2 + 1 + 4 = 23 |teppi82@ gmail. com|
|♪ Tổng cộng các dân tộc ♪| **516** |**516 / 516, ZERO thất bại**|
|lõi thời gian chạy (không có nền tảng, không có NVN)| 19 |18 được biên dịch; 1 được sửa|

1 lỗi thời gian chạy là lỗi đầu não thực sự ở MIT
runtime**: `runtime/src/hle_fs.cpp` uses `std::vector` without `#include <vector>`. Patched with a
single line (recorded, with attribution, alongside the `g_fast` patch).

## Phân tích biểu tượng: thiếu 12 người, tất cả thư viện chuẩn

Vượt qua 516 tạo ra + 18 lần chạy đồ vật: **142,562 ký hiệu xác định**, 30, 027 không xác định trong
tạo ra các vật thể, 205 vật thể chạy thời gian, và sau khi trừ đi tất cả mọi thứ được xác định ở đâu đó,
**Chỉ có 12 ký hiệu mới thật sự mất đi**:

```
__cxa_guard_acquire   __cxa_guard_release   __popcountdi2   __stack_chk_fail
fmaf   nearbyint   nearbyintf   round   roundf   sqrt   sqrtf   truncf
```

**Every one is libc / libm / libgcc.** Not one `nn::*`, not one `nx::*`, not one NVN symbol.

**Important and unexpected:** `nn::*` HLE imports **do not appear as link errors at all**. Wonder's
HLE is a **name registry** (`std::unordered_map<std::string, HleFn>`), not symbol linkage. So
mất tích HLE thực hiện sẽ xuất hiện tại *runtime* như tin nhắn một phần tiêu điểm, không phải tại
Thời gian liên kết. bước 3 giả định biểu tượng HLE; giả định là sai và được sửa chữa
Đây.

## 3. Liên kết thật: 31 ký hiệu từ một nhị phân

Linking all 516 generated objects + the runtime core + `-lm -lc -lgcc -lpthread -ldl` produced
**31 ký hiệu không xác định riêng biệt**:

|Loại|Số lượng|
|---|---:|
| **`nx::plat::*` — the platform layer** | **26** |
| Per-game glue (`main`, `nx::game::after_init`, `nx::game::kInfo`, `nx_module_main`, `nx_module_sdk`) | 5 |
| `nn::*` (HLE) | **0** |
| `nvn` / `NVN` | **0** |
|Khác| **0** |

### Các chức năng của nền tảng — danh sách công việc đầy đủ

```
nx::plat::commit / reserve / decommit     memory mapping
nx::plat::start_thread / exit_thread / current_thread_id / set_thread_name / yield
nx::plat::sleep_ns / monotonic_ns          timing
nx::plat::create_window / release_window / window_minimized
nx::plat::read_pad(nx::plat::PadState&)    input
nx::plat::audio_open / audio_submit / audio_queued
nx::plat::fopen_utf8 / fseek64 / ftell64 / read_at   file I/O
nx::plat::log_line / exit_process
nx::plat::data_root / setting / profile
```

**This is the `platform_linux.cpp` the MIT README said was missing** — and it is the *only* layer
giữa cái cây này và một tập tin thực hiện được liên kết.

### Năm ký hiệu keo

- `main` — the entry point
- `nx::game::after_init()` — per-game post-init hook
- `nx::game::kInfo` — the game info struct (title id, module list)
- `nx_module_main`, `nx_module_sdk` — the generated `ModuleInfo` externs

**`nx_module_main` and `nx_module_sdk` almost certainly already exist** in the generated
`table.cpp` files, but as `static const` — TU-local. Exposing them is **wiring, not work**. That
leaves a genuinely small `game.cpp`.

## 4. Tại sao đây là thước đo quan trọng nhất cho đến nay

Trước vòng này, "xa hệ nhị phân bao nhiêu?" là một ước tính.

> **31 ký hiệu 26 là lớp nền 5 là keo 0 là HLE 0 là NVN

Và các chức năng 26 nền tảng là ** chính xác loại bề mặt kho này đã có
verified work for**: the port under `port/` implements `nn::os`, `nn::fs`, `nn::vi` and timing over
vật chủ nguyên thủy, xác định chéo trên x86-64 và arc64. **Đó là hình ảnh tham chiếu cho tất cả 26.**

## 5 Điều này không xác minh

- ** Không có gì được liên kết vào một hệ nhị phân hoạt động.** 31 biểu tượng chính xác là lý do.
- **`nx::plat::*` was not implemented.** Only enumerated.
- **HLE chưa được kiểm tra vào giờ chạy.** Kể từ khi nó kết nối bằng tên, cho dù Slartoon 2's xuất khẩu quyết định
  là một trò chơi chạy * thắc mắc liên kết này không thể trả lời.
- **No NVN** -- và liên kết nói không cần thiết để liên kết*, bởi vì NVN cũng được đăng ký tên.
  Việc vẽ vẫn cần nó, và đèn pha thì không còn nữa.
- **No game glue** — `game.cpp` for Splatoon 2 does not exist.
- **The runtime's `main.cpp` needs the platform layer** (`nx::plat::create_window` etc.), so it
  không thể chạy ngay cả trong hình dạng không đầu.
- **Only the `main` module's real image was not mapped** — guest memory in the earlier harness was
  Không có đầy đủ, không có tải từ NSO, và đó vẫn là sự thật.

## 6. Tăng dần

Write `platform_linux.cpp` implementing the 26 `nx::plat::*` functions — the repository's `port/`
Lớp là tham khảo cho ngữ nghĩa, và hầu hết chúng là các khăn quấn mỏng. sau đó viết a
minimal Splatoon 2 `game.cpp` exposing the generated `ModuleInfo` tables, and the tree links.

** Đó là một công việc có giới hạn, đáng kể — chứ không phải là một câu hỏi nghiên cứu.
