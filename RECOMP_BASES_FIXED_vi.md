# Cơ sở dữ liệu của môđun cố định; 34 nhập khẩu chưa được giải quyết tên

Vòng 4. Vụ va chạm cơ bản ở vòng 3 là **fixed**, thất bại chuyển động, và 34 chưa được giải quyết
nhập khẩu bây giờ là **enumerated**.

---

## 1. sự va chạm đã được cố định

Regenerated all six modules with a **64 MB stride** instead of 16 MB, which is larger than `main`'s
Chính 57 MB khoảng cách:

|Module|Cơ sở cũ|** Căn cứ mới**|Bảng mã|
|---|---|---|---|
| `main` | `0x7100000000` | `0x7100000000` | `NX_BASE + 0x3100000000` |
| `sdk` | `0x7101000000` | `0x7140000000` | `NX_BASE + 0x3140000000` |
| `subsdk0` | `0x7102000000` | `0x7180000000` | `NX_BASE + 0x3180000000` |
| `subsdk1` | `0x7104000000` | `0x71c0000000` | `NX_BASE + 0x31c0000000` |
| `subsdk2` | `0x7106000000` | `0x7200000000` | `NX_BASE + 0x3200000000` |
| `subsdk3` | `0x7108000000` | `0x7240000000` | `NX_BASE + 0x3240000000` |

Tất cả sáu chức năng được phối hợp với ** Zero hướng dẫn chưa điều khiển** một lần nữa (140,899 chức năng, tất cả 522
Vật thể được xây dựng lại từ đầu với **0 thất bại**, được liên kết lại đến 140 MB, và lần chạy bây giờ cho thấy:

```
loaded main    at 7100000000
loaded sdk     at 7140000000
loaded subsdk0 at 7180000000
loaded subsdk1 at 71c0000000
loaded subsdk2 at 7200000000
loaded subsdk3 at 7240000000
linked: 116 to HLE, 23913 across modules, 34 unresolved
```

**No overlap.** The round-3 fault (`main+1000030`, which was inside `sdk`) is gone.

## 2. Sự thất bại chuyển động — và nó di chuyển dần dần

```
FATAL: call into the middle of a function: sdk+30 (_init+c) (lr hle:__process_return)
```

Round 3 got as far as `gsys::ModelUnit::calcDrawArray_`. Now it stops at `sdk+0x30`, described as
`_init+0xc`.

** Đây là sự tiến bộ, chứ không phải hồi quy, và nó đáng được chính xác về lý do. ** Trong vòng 3 các mô-đun
*overlapped*, so `sdk` was mapped **over** `main`'s text. The code that ran "successfully" up to
`calcDrawArray_` was running against a corrupted address space; the first bad indirect call happened
to land inside `sdk`'s overlapping range. With correct bases the address space is sound, and the run
chết trong cuộc gọi gián tiếp đầu tiên thực sự tồi tệ** — đó là một lỗi được phơi bày thay vì
Hơn là đeo mặt nạ.

## 3. Những thông tin chưa được giải đáp — liệt kê

The runtime reported a count but not names. Patched `loader.cpp` to record and print them. **All 34:**

|Tử tế|Số lượng|Tên|
|---|---:|---|
|**Linker mục đánh dấu**| **24** | `__rel_dyn_start`, `__rel_dyn_end`, `__rel_plt_start`, `__rel_plt_end` — four per module × six modules |
| **`glslc*` shader compiler** | **9** | `glslcCompile`, `glslcCompilePreSpecialized`, `glslcCompileSpecialized`, `glslcFinalize`, `glslcGetDefaultOptions`, `glslcGetVersion`, `glslcInitialize`, `glslcSetAllocator` |
|Bộ ngoại lệ **SDK**| **1** | `nnosGetDefaultUserExceptionStackForApplication` (sdk, reported twice) |

**24 of the 34 are NOT functions** — they are ELF section boundary symbols (`__rel_*`), which no
Cuộc gọi chương trình. Việc không được giải quyết của họ đã được đưa ra và vô hại**.

**The 9 `glslc*` symbols are a genuine finding.** They are the **GLSL shader compiler** — the tool a
game uses to compile shaders *at runtime*. Splatoon 2's `main` references them. If the game ever
calls `glslcCompile`, it will hit the missing-import stub. Whether Splatoon 2 compiles shaders at
Chạy thời gian (hơn là vận chuyển mã Maxwell trước khi được biên dịch) chưa được thiết lập** và bóng râm là
Rõ ràng là nằm ngoài phạm vi của mục tiêu này, nhưng đây là tiểu đầu tiên, tên là "mamer-adjacent"
phụ thuộc vào dự án đã tìm thấy trong hệ nhị phân.

## Vậy 34 không phải nguyên nhân.

They are mostly markers. That means the `sdk+30 (_init+c)` fault has a different cause. The most
likely candidate, from reading `main.cpp`:

```cpp
static void init_module(CPU& c, const ModuleInfo& m) {
    for (size_t k = 0; k < m.init_count; k++) call_preserving(c, m.base + m.init_array[k]);
}
```

`init_module(sdk)` calls **every entry of sdk's `init_array`** as a function. If any entry is not a
function start — or if `_init` itself is not treated as a function boundary by the recompiler — the
call lands mid-function, which is exactly the reported fault (`_init+0xc`).

**Đây là một giả thuyết, không phải một kết luận.** Nó không được thử nghiệm vòng này.

## Vòng này chứng minh gì?

|Mục|Tình trạng|
|---|---|
|Cơ sở môđun không lật ngược|teppi82@ gmail. com|
|Mọi mô- đun được phối hợp với các cơ sở mới|_ 0 không điều khiển, 522 đối tượng, 0 thất bại|
|Liên kết vẫn thành công|_ 140 MB|
|Lỗi chồng chéo vòng 3|♪ Biến mất ♪|
|34 lần nhập khẩu không được giải quyết|♪ Phát triển và phân loại ♪|
|Thực (không dấu) chưa được giải quyết| ✅ **10**: 9 `glslc*` + 1 `nnos*` |
| `sdk+30` fault |chẩn đoán, **không được sửa chữa**|

## 6 Những gì điều này không xác minh

- **It still does not run past `nnMain`'s module initialisation.** No game initialisation completes.
- **The `init_array` hypothesis was not tested.**
- **The `glslc*` symbols were not investigated** — whether Splatoon 2 compiles shaders at runtime is
  không rõ, và đèn pha nằm ngoài phạm vi của mục tiêu này.
- ** The HLE vẫn chưa được phân loại** — đóng dấu 116, không có cuộc gọi dịch vụ nào.
- **Không NVN, không cửa sổ, không trình bày.**
- **The 24 `__rel_*` markers were not given definitions** — they are believed harmless, not proven so.

## 7. Tăng dần

Test the `init_array` hypothesis: log each entry `init_module` is about to call, with its offset, for
the `sdk` module. If an entry is not a function start, that is the bug and it is in the generated
`init_array` or in how `_init` is handled. This is a small, targeted diagnostic on the exact code
con đường mà lỗi.
