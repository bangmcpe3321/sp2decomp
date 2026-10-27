# Nó liên kết, nó chạy, và nó đến cửa trước của trò chơi

Vòng 2 và 2 trong 3 lớp còn lại bây giờ được hoàn thành và thứ 3 sẽ được kết nối với 1
khoảng cách chính xác, chính xác.

---

## 1. `platform_linux.cpp` — written

The 26 `nx::plat::*` functions the link identified, implemented against the host:

|Nhóm|Hàm|Chất lượng|
|---|---|---|
|Bộ nhớ| `reserve`, `commit`, `decommit` | **real** — `mmap`/`mprotect` at fixed guest addresses |
|Sợi| `start_thread`, `exit_thread`, `exit_process`, `set_thread_name`, `current_thread_id`, `yield` |**real**|
|Thời gian| `sleep_ns`, `monotonic_ns`, `profile` | real (`profile` returns false) |
|Tập tin| `fopen_utf8`, `ftell64`, `fseek64`, `read_at`, `make_dirs` | **real** (`read_at` uses `pread`) |
|Xuất| `log_line`, `data_root`, `setting` |**real**|
|Hiển thị/ nhập| `create_window`, `window_size`, `read_pad`, `touch_overlay`, … |**Cấp cao nhất** — không có GPU, không có cửa sổ, thiết kế|
|Âm thanh| `audio_open/submit/queued/pause` |**Hoirest stubs** - trả lại có nghĩa là "không có thiết bị", đó là hành vi không đầu được ghi lại|
|Điểm mục| `main()` | **real** — calls `nx::boot()`, mirroring `platform_win.cpp` |

`write_watch_*` was **deliberately not** stubbed: `runtime/src/write_watch.cpp` already implements it
with POSIX page protection, and duplicating it produced three `multiple definition` errors.

## 2. Liên kết thành công

```
generated objects: 522      (516 code_*.cpp + 6 table.cpp)
runtime objects  : 21
link exit: 0

***  LINK SUCCEEDED -- a Splatoon 2 executable exists  ***
140 MB   ELF 64-bit LSB pie executable, x86-64, dynamically linked, not stripped
```

Hai con bọ phải được sửa chữa để đến đó, cả hai đều chạy thay vì đọc:

**`table.cpp` was never compiled.** The build globbed `code_*.cpp`, missing the six `table.cpp`
files that define `nx_module_main` / `nx_module_sdk` / `nx_module_subsdk*`. That is what made those
Các biểu tượng không xác định được.

**`commit()` was too weak.** The first run printed `FATAL: cannot commit module main`: a bare
`mprotect` fails with `ENOMEM` when nothing is mapped at the address, and the loader commits module
memory without a preceding `reserve` on this path. `commit()` now falls back to `mmap(MAP_FIXED)`
để cài đặt bản đồ.

## Ba, nó chạy — và đi xa một cách đáng kể

```
loaded main at 7100000000 (114928 functions, 255796 relocs)
loaded sdk  at 7101000000 ( 19322 functions,  16121 relocs)
linked: 101 to HLE, 16802 across modules, 41 unresolved
FATAL: nn::init::Start not found
```

Đọc cẩn thận đường giữa.

1. Bản đồ cả hai mô-đun ở đáy bên phải,
2. áp dụng **271,917 tái định cư**,
3. liên kết **101 biểu tượng đến HLE và 16,802 trên các mô-đun**,
4. Chỉ còn **41 chưa được giải quyết**,
5. và sau đó dừng lại ở **one mất tích điểm nhập**.

** Đây là lần đầu tiên Slatoon 2 của mã đã được tải, di chuyển, liên kết và nhập vào một
host process.** Nothing before this round had got past a hand-built `CPU` with zeroed memory.

## 4. còn lại một khoảng trống, nhân vật chính xác

The runtime looks for `nn::init::Start` under two manglings:

```cpp
find_symbol("_ZN2nn4init5StartEmmPFvvES2_")        // SDK 9,  4 args
find_symbol("_ZN2nn4init5StartEmmPFvvES2_S2_")     // SDK 16, 5 args
else fatal("nn::init::Start not found");
```

**Splatoon 2 exports neither.** Its entire `nn::init` surface is four symbols:

```
_ZN2nn4init12GetAllocatorEv
_ZN2nn4init19InitializeAllocatorEPvm
_ZN2nn4init6detail30DefaultAllocatorForThreadLocalEmm
_ZN2nn4init6detail32DefaultDeallocatorForThreadLocalEPvm
```

**Splatoon 2's SDK predates `nn::init::Start`.** Wonder (SDK 9+) and Splatoon 2 (2017, much older)
enter the game by different means. The runtime already has an `nnMain` HLE hook
(`NX_HLE("nnMain", nn_main)`), and Splatoon 2's modern-looking path would be to call **`nnMain`
directly** rather than through `nn::init::Start`.

**So the remaining work is a boot-path decision, not an unknown:** teach `nx::boot()` the older SDK's
Đó là một thay đổi nhỏ, cụ thể trong một chức năng.

## 5 Điều này chứng minh điều gì và điều gì không

**Establish:**
- và **links** vào máy tính xách tay 140 MB;
- tập tin thực hiện **runs**, bản đồ cả hai mô-đun, áp dụng 271.917 định vị, giải quyết 16,903 ký hiệu;
- Lớp nền cần thiết là **26 chức năng**, và chúng đã được viết;
- việc chỉ có ** giữa việc này và việc nhập vào trò chơi là một quy ước về điểm vào.

**Không có thiết lập:**
- **The game has NOT executed its first instruction yet.** `nn::init::Start` was never entered, so
  chưa có mã khách nào từ ảnh thật đã chạy — bộ yên cương trước đó thực hiện một chức năng
  CPU được xây dựng bằng tay và trí nhớ bằng tay không, đó là một điều khác.
- **41 biểu tượng vẫn chưa được giải quyết** sau khi mô-đun liên kết; chúng không được liệt kê vòng này.
- **The HLE không được chứng minh. ** 101 biểu tượng gắn liền với nó, nhưng không có cái nào được gọi là *.
- **`nn::init::Start` / `nnMain` for Splatoon 2's SDK was not implemented** — only diagnosed.
- **Không NVN, không cửa sổ, không bóng râm, không trình bày.** Hiển thị và âm thanh là do thiết kế.
- **The `subsdk` modules are not loaded by the boot path** — `main.cpp` hardcodes
  `mods[] = {&nx_module_main, &nx_module_sdk}`. Splatoon 2 has six; the other four are compiled and
  linked but not registered. This is the `g_fast` issue's sibling and was not addressed.

## 6. Tăng dần

Teach `nx::boot()` Splatoon 2's older entry convention — most likely call **`nnMain` directly**
instead of `nn::init::Start`, since that HLE hook already exists — and register the four missing
`subsdk` modules in the module list. Then re-run and report how far the guest gets.

Both changes are in `runtime/src/main.cpp`, are small, and are now precisely specified.
