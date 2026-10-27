# Root cause of the `sdk+30` fault found and fixed

Round 5. The `init_array` hypothesis from round 4 was **wrong**, and testing it found the real cause
Ngay lập tức, nó được sửa chữa, chiếc giày tiến về phía trước, và bây giờ nó rơi xuống sâu hơn.

---

## 1. Giả thuyết đó là sai — và điều đó rẻ để học

Round 4 proposed that `init_module()` was calling a bad `init_array` entry. **It was not.**
Instrumenting each entry produced **no `init[...]` log lines at all**, which localised the fault to
dòng trước khi vòng lặp:

```cpp
static void init_module(CPU& c, const ModuleInfo& m) {
    call_preserving(c, m.base + kDtInit);      // <-- HERE
    uint32_t status = ld<uint32_t>(init_status_addr(m));
    if (status == 1)
        for (size_t k = 0; k < m.init_count; k++) call_preserving(c, m.base + m.init_array[k]);
```

**Một chẩn đoán rằng không có dấu vân tay nào vẫn là kết quả** — nó loại bỏ giả thuyết chỉ trong một lần chạy.

## 2. Nguyên nhân gốc thực sự

```cpp
constexpr uint64_t kDtInit = 0x30;   // main.cpp:58
```

**`_init` was assumed to live at `+0x30` in *every* module.** That holds for Wonder's modules. In
Splatoon 2's `sdk`, `_init` is at **`+0x24`** — so `init_module(sdk)` called `sdk+0x30`, which is
`_init+0xc`, and the runtime correctly reported:

```
FATAL: call into the middle of a function: sdk+30 (_init+c)
```

** Đây là biểu hiện thứ ba của cùng một lớp khuyết tật trong dự án này:** một hằng số có giá trị
cho kỳ quan chứ không phải cho Slaptoon 2.

| # |Hằng số|Ở đâu|Sự kết hợp cho Slaptoon 2|
|---|---|---|---|
| 1 | `g_fast[4]` |Cỡ bảng mô- đun|6 mô- đun, 2 ô âm thầm rơi|
| 2 |16 MB bước mô- đun|Căn cứ thế hệ| `sdk` mapped over `main` |
| 3 | **`kDtInit = 0x30`** | `_init` offset | called `_init+0xc` |

## 3. Sửa chữa.

`_init` is now resolved **from each module's own symbol table**, with `0x30` kept only as a
Hậu phương cuối cùng:

```cpp
static bool find_func_offset(const ModuleInfo& m, const char* want, uint64_t& out) {
    for (size_t k = 0; k < m.symbol_count; k++) {
        const Symbol& s = m.symbols[k];
        if (s.imported || !s.name[0]) continue;
        if (std::string(s.name) == want) { out = s.value; return true; }
    }
    return false;
}
```

Và bản ghi xác nhận nó đã có hiệu quả:

```
sdk: _init at +0x24
```

**The `sdk+30` fault is gone.** The boot advanced past module initialisation for the first time.

## 4. Lỗi mới: lỗi phân đoạn máy

With `_init` resolving correctly, the run proceeds further and then dies with a **SIGSEGV** — a host
lỗi, không phải kiểm tra thời gian chạy thất bại.

Đó là một khác biệt của thất bại từ tất cả mọi thứ cho đến nay: những người trước đây là tất cả
`FATAL: <named condition>` from the runtime's own guards, which name what went wrong. A bare SIGSEGV
có nghĩa là lỗi xảy ra ở nơi nào đó thời gian chạy mà không kiểm tra lại — rất có thể là bên trong khách mời tái chế
Mã đã bỏ tham chiếu vào con trỏ máy, mà không được vẽ bản đồ.

**Tại sao điều này là tiến bộ:** mỗi điểm dừng trước đó là thời gian chạy từ chối không tiếp tục.
Mật mã thực sự chạy đủ xa để hoạt động với một con trỏ không tốt.

**Tại sao nó chưa được chẩn đoán:** không địa chỉ, không máy tính khách, không biểu tượng nào bị bắt.
signal handler in `platform_linux.cpp` that reports `si_addr` plus the current guest `pc`/`lr` — the
Cùng một kỹ thuật mà bộ giáp vòng 1 sử dụng thành công.

## Vòng này chứng minh gì?

|Mục|Tình trạng|
|---|---|
| `init_array` hypothesis |vội vã không tìm thấy mục nhập nào|
| Real root cause of `sdk+30` | ✅ **found**: hardcoded `kDtInit = 0x30` |
|Sửa| ✅ `_init` resolved from the symbol table; `sdk: _init at +0x24` confirmed |
| `sdk+30` fault |♪ Biến mất ♪|
|Khởi động trong mô- đun trước|{\cH00C1E5EC}Lần đầu tiên {\cH00C1E5EC}|
|Lỗi tiếp theo|♪ Máy chủ SIGSEGV, **undiagoughd**|

## 6 Những gì điều này không xác minh

- **Các SIGSEGV không được chẩn đoán. không biểu tượng.
- **No game initialisation has completed.** The boot has advanced past `_init` but not to a running
  Trò chơi lặp lại.
- **`main`'s and the subsdks' `_init` offsets were logged but not verified** to be function starts —
  only `sdk`'s was reached.
- **HLE vẫn chưa bị phát hiện.**
- **No NVN, không cửa sổ, không trình diễn** — màn hình và âm thanh là những chấm, bóng mát ngoài tầm ngắm.
- **The fallback path (`kDtInit`) was not exercised**, so it is untested.

## 7. Tăng dần

Add a SIGSEGV/SIGILL/SIGBUS handler to `platform_linux.cpp` that reports **`si_addr` plus the guest
`pc` and `lr`**, resolved through the runtime's `describe()` so the faulting function is named. That
là cùng một kỹ thuật mà bộ phận kết nối vòng 1 sử dụng, và nó biến một vụ va chạm vô danh thành một vụ nổ đã được định vị.
