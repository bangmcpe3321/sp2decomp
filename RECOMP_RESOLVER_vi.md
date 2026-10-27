# Câu hỏi người giải quyết — trả lời: Bảng hàm số là SÁNG - THẾ KÝ mỗi trò chơi

`RECOMP_EXTERNALS.md` closed by calling this "the single most important open question": whether
`nx::call`'s indirect-branch resolver is hardcoded to Wonder, or generic enough for a foreign game.
Nếu mã hóa được cứng, đường dẫn phục hồi dừng lại một lớp chạy thiếu.

**Nó là chung. Bảng được tạo ra trên mỗi trò chơi, và Slaptoon 2 đã có một.**

---

## 1. How `nx::call` resolves a target

`runtime/src/loader.cpp`:

```cpp
struct FastModule {
    uint64_t base, text_size;
    const Fn* table;
};
FastModule g_fast[4];

void call(CPU& c, uint64_t t) {
    for (size_t k = 0; k < g_fast_count; k++) {
        const FastModule& m = g_fast[k];
        uint64_t off = t - m.base;
        if (off < m.text_size) [[likely]] {
            Fn fn = m.table[off >> 2];          // <-- indexed by (target - base) / 4
            if (!fn) { ...fatal("call into the middle of a function")... }
            fn(c);
            return;
        }
    }
    // ... falls through to the HLE thunk table (imported nn::* functions)
}
```

`table[]` is a **flat array indexed by `(target - base) / 4`** — one `Fn` per 4-byte slot of the
module's `.text`. No hashing, no symbol names, no per-game special-casing.

## 2. Nơi mà bảng được tạo ra — tạo ra, chứ không phải mã cứng

```cpp
LoadedModule lm{mi, mi->base, size, new Fn[mi->text_size / 4]()};
for (size_t k = 0; k < mi->func_count; k++)
    lm.table[mi->funcs[k].offset / 4] = mi->funcs[k].fn;
g_modules.push_back(lm);
if (g_fast_count < 4) g_fast[g_fast_count++] = {lm.base, mi->text_size, lm.table};
```

The table is filled from `mi->funcs[]` — **the recompiler's generated per-module data.** It is not
Một danh sách tuyệt vời.

## 3. Và Slartoon 2 bảng đã được tạo ra

The recompiler emitted it in the run recorded in `RECOMP_EXPERIMENT.md`:

```
/home/hexa/sp2recomp/gen/table.cpp    26,602,991 bytes    517,370 lines
```

```
#include "funcs.h"
#include <nx/module.h>

static const nx::FuncEntry funcs[] = {
    {0x0, main_00000000},
    {0x24, main_00000024},
    {0x160, main_00000160},
    {0x194, main_00000194},
    ...
```

|Thuộc tính|Giá trị|
|---|---:|
| Entries naming a `main_*` function | **114,928** |
| Distinct `main_*` referenced | **114,928** |
|Số hàm của môđun (rêreport)| **114,928** |

**Các đếm khớp chính xác — một mục nhập bảng mỗi chức năng, không có khoảng trống.** Loại tạo ra là
`nx::FuncEntry` from `nx/module.h`, i.e. the framework's own structure, which is what the loader
Đây không phải là sự trùng hợp ngẫu nhiên mà là thiết kế.

## 4. Kết luận

** Bộ giải quyết bàn mạch gián tiếp là chung và bàn 2 đã hoàn thành.**

Nó loại bỏ những gì được miêu tả là ngăn chặn quyết định. kết hợp với kết quả trước đó:

|Hỏi|Trả lời|
|---|---|
|Bộ sửa chữa có mã số 2 không?|**Có** — 140.899 chức năng, 0 không điều khiển|
|Đầu ra có hợp lệ không?|**Có** — Các đơn vị biên dịch mẫu|
|Bề mặt bên ngoài có nhỏ không?| **Yes** — ~35 helpers + `memcpy` |
|Trò chơi giải quyết có cụ thể không?|**No** — bảng tạo ra mỗi trò chơi|
|Bàn của Slatoon 2 xong chưa?|**Có** — 114.928/114.928 mục|

** Không tìm thấy gì cách đây quá xa Slatoon 2 trên con đường này.**

## 5 cái gì vẫn chưa được biết

Người giải quyết là câu hỏi lớn nhất, giờ đã được trả lời.
Nhân vật — **work, không phải ẩn số**:

- **The HLE layer.** `call()` falls through to a thunk table of imported `nn::*` functions.
  Splatoon 2's imports differ from Wonder's, and its `sdk` module's service set is unexamined.
- **NVN.** `runtime/src/nvn/` is Wonder-shaped; whether it serves Splatoon 2's NVN usage is
  untested. `NVN_BOOT_SUBSET.md` says ~33 functions on the boot path, which is encouraging.
- **Shaders.** Những cái bóng của Maxwell 2 là của riêng nó.
  áp dụng. **Đây là khu vực chưa động đến lớn nhất.**
- **The game glue.** `games/wonder/game.cpp` is per-game; Splatoon 2 would need its own.
- **`nx::CPU` layout** was never compared field-by-field against what the generated code assumes.
- **Không có gì được liên kết hoặc thực hiện.** Những thứ này vẫn còn đang được đo đạc.

## 6 Chú ý phương pháp

Điều này cần **one đọc của một chức năng** để trả lời nó không được trả lời bởi scan, tham khảo chéo
or instrumentation — the same lesson as `NVN_DEVICE_CREATION.md`, and now the **fifth** time in this
dự án quét nhịp đọc.

Câu hỏi cũng được đặt ra rất tốt bởi vì các phép đo trước đây đã thu hẹp nó thành một đơn
symbol: `RECOMP_EXTERNALS.md` did not ask "does the runtime work?" but "is `nx::call`'s table
Đặc biệt đó là những gì làm cho nó là câu trả lời năm phút thay vì một bản scan thất bại khác.

## 7 Giới hạn

- **`nx::FuncEntry`'s exact definition was not read** — only its use. The `offset / 4` indexing is
  confirmed at the consumer side (`loader.cpp`), not the producer side.
- **4 modules maximum** (`g_fast[4]`). Splatoon 2 has **6** (`main`, `sdk`, `subsdk0..3`), which
  vượt quá dãy đó. **Đây là một tính chất cụ thể, có thể kiểm tra tương thích** và điều tiếp theo để
  xem xét.
- **Con đường HLE Thunk không được kiểm tra**, vì vậy làm thế nào các nhập khẩu được giới hạn cho một trò chơi nước ngoài là không rõ.
- **Không liên kết, không chạy.** Mọi thứ ở đây đều tĩnh.
