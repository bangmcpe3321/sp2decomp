# Phương pháp điều chỉnh: 1,368 bộ tạo tĩnh và vẫn đang chạy

Round 9. The round-8 hypothesis — *"a null `new` because the game's allocator was never installed"* —
là ** xác nhận và cố định**, và nó tạo ra sự tiến bộ lớn nhất trong toàn bộ dự án.

---

## 1, bằng chứng.

Instrumenting `call_preserving` to log any call to `nn::init::InitializeAllocator`
(`main+0xdda018`) produced **no log line at all** across a full run:

> **`nn::init::InitializeAllocator` is never called by any path this port takes.**

The game defines its own `operator new` (14 references in `main`'s table), so with no allocator
installed, **every `new` in `main`'s static initialisation returned null** — and `nn::nex::WaterMark`
was simply the first one to dereference it. That was the entire `this == NULL` fault.

## 2.

`nn::init::InitializeAllocator(void* buf, size_t size)` over a **64 MB host buffer**, called in
`nn_main` **after `sdk`'s constructors and before `main`'s** — which is where real SDK start-up would
làm đi:

```
installing game allocator: buf=0x7c6fd8262010 size=0x4000000 via main+dda018 (_ZN2nn4init19InitializeAllocatorEPvm+0)
game allocator installed
```

## 3 Kết quả

|Metric|Vòng 8|**Rund 9**|
|---|---:|---:|
| `sdk` constructors | 74 | **74** |
| `main` constructors | **0** | **1,368** |
|Kết quả| SIGSEGV in `nn::nex::WaterMark` |** vẫn còn chạy ở thời điểm 180 s**|

```
=== exit: 124 (124 = still running at 180s timeout) ===
=== total output lines: 1495 ===
  sdk  init[N]: 74
  main init[N]: 1368
```

The run executes **1,368 of `main`'s static constructors** — `nn::pia` (P2P networking), `nn::nex`
(Nintendo networking), `pead` (the heap layer), `std::vector` allocations, `pexp` string handling —
và ** không rơi**.

**Nó vẫn còn bên trong vòng xây dựng khi thời gian ra chạm**, có nghĩa là phần còn lại
Đơn giản là nhiều người xây cất, chứ không phải bị mắc kẹt.

## 4 chuỗi hoàn chỉnh, xuyên suốt 9 vòng.

Mỗi bước đều là thất bại * Wonder-vs-Slatoon-2, mỗi bước đều được phát hiện bằng cách chạy:

| # |Sử dụng thời gian chạy của MIT|Cái giá phải trả|Tròn|
|---|---|---|---|
| 1 | `g_fast[4]` module table |Hạ 2 trong 6 mô- đun| 1 |
| 2 |16 MB bước mô- đun| `sdk` mapped over `main` | 4 |
| 3 | `kDtInit = 0x30` | called `_init+0xc` | 5 |
| 4 | `init_status == 1` |Những người xây dựng SDK đã bỏ qua| 8 |
| 5 |**Alloctor đã cài xong**| **every `new` returned null** | **9** |

**Không phải là một trong những sản xuất một thông điệp lỗi đặt tên giả định.** Bốn đã bị bắt bởi
Lính canh thất bại (ít nhất đặt tên cho chức năng), và thứ năm là một SIGSEGV trần mà chỉ có một
Người quản lý lỗi viết tay có thể xác định vị trí.

## Vòng này chứng minh gì?

|Mục|Tình trạng|
|---|---|
| Null-`new` hypothesis |♪ **CONFIRRED**|
| `InitializeAllocator` never called |♪ Được chế tạo bởi các dụng cụ**|
|Alloctor được cài đặt trên bộ đệm máy|teppi82 làm việc|
| `nn::nex::WaterMark` fault |♪ Biến mất ♪|
| `main`'s static constructors |{\cH00C1E5EC}Ba68 tử hình**|
|Quá trình sống sót vượt qua chúng.|Vẫn đang chạy ở 180 s**|

## 6 Những gì điều này không xác minh

- **`nnMain` has still not been reached.** The run is inside `main`'s *static constructors*, which run
  before `nnMain`. "Still running" is not "the game started".
- ** Thời hạn 180 s chưa hoàn tất.** Cho dù nó hoàn thành danh sách xây dựng, và bao lâu đó
  Lấy, là không biết.
- **`main`'s total `init_count` was never printed** — the loop is still going, so 1,368 is a lower
  Bị ràng buộc, không phải toàn bộ.
- **Không có hành vi cá nhân nào của người xây dựng được kiểm tra.**Một người có thể âm thầm thất bại hoặc lặp lại.
- ** Bộ đệm tổng hợp là 64 MB cố định.** Nếu trò chơi cần nhiều hơn, nó sẽ thất bại sau này và
  thất bại sẽ có vẻ không liên quan.
- ** Người HLE hầu như không thể thực hành** — một thông tin nhập khẩu được gọi là suốt quãng đường.
- **Không NVN, không cửa sổ, không bóng râm, không trình bày.** Hiển thị và âm thanh là do thiết kế.
- ** Đây không phải là một trò chơi có thể chơi mà không phải là một trò chơi khởi động.** Đó là một quá trình tồn tại tĩnh
  Sự khởi đầu.

## 7. Tăng dần

Let the run continue past 180 s and find whether the constructor list completes and `nnMain` is
Nếu nó trì hoãn, số người ở quầy tính tên người xây dựng chịu trách nhiệm.
