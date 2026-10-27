# `nnosInitialize` confirmed: the missing SDK init, and the next fault

Round 7. The round-6 hypothesis — *"the port enters at `nnMain`, bypassing SDK system
Khởi tạo" — là ** Xác nhận**, bộ khởi động bị mất là ** và bây giờ chạy**, và khởi động
Tiến bộ đáng kể đến một lỗi chính xác mới.

---

## Một.

Splatoon 2's SDK is the **old `nnos*` C API era**, not the `nn::init` era:

- **121 distinct `nnos*` symbols** — `nnosAcquireSemaphore`, `nnosAllocateTlsSlot`,
  `nnosCreateThread`, `nnosAttachSystemEvent`, and so on.
- And crucially **`nnosInitialize`**, at **`sdk+0x86bd8`** (`{"nnosInitialize", 0x86bd8, 468, 2, 1, 0}`).

**Đó là hệ thống khởi tạo cổng đã bỏ qua.** Sự va chạm vòng-6
`nn::os::LockMutex` on uninitialised state is exactly what a missing `nnosInitialize` produces.

## Bây giờ nó chạy, và khởi động

```
nn::init::Start absent -- older SDK; running nnosInitialize, then nnMain
nnosInitialize at sdk+86bd8 (nnosInitialize+0)
missing import called: nnosGetDefaultUserExceptionStackForApplication
    (lr sdk+86d6c (nnosInitialize+194)) -> 0
nnosInitialize returned
sdk: _init at +0x24
sdk constructors: 0
main: _init at +0x24
```

Compare with round 6, which died **inside `sdk`'s `_init`** before reaching `main` at all. The boot
now completes `nnosInitialize`, `sdk`'s `_init`, and `main`'s `_init` in sequence.

**One of the 34 previously-unresolved imports was actually exercised**: `nnosGetDefaultUserException
StackForApplication` was *called* from inside `nnosInitialize+0x194`, hit the missing-import stub, and
Trả lại 0. Đó là lần nhập khẩu chưa được giải quyết đầu tiên trong dự án này để được **proven có thể với tới**
chứ không chỉ đơn thuần là đếm.

## 3 Lỗi mới

```
=== HOST SIGSEGV ===
  fault address : 0x10
  guest lr      : 0x7100d08790  main+d08790 (_ZN2nn3nex9WaterMarkC2EPKcbj+84)
  x0  0000000000000000     <- this == NULL
  x1  000000710287442c
  x3  000000000000ea60
```

**`nn::nex::WaterMark::WaterMark(const char*, bool, unsigned)` is being constructed with a null
`this`.** (`nex` is Nintendo's networking library.) The constructor dereferences `this+0x10`, hence
the fault at `0x10`.

**A `this == NULL` construction almost always means the enclosing object was allocated by a `new`
mà trở lại null, hoặc là một con trỏ tĩnh chưa bao giờ được chỉ định** — hoặc.e. một đống hoặc tĩnh-init
Quan hệ phụ thuộc vẫn chưa được thỏa mãn.

`x3 = 0xea60` = 60000, and `x20 = 1` — plausible constructor arguments — so the *arguments* arrived
Chính xác và cả hai bị quyến rũ đều không.

## 4 hiệp này là gì?

|Mục|Tình trạng|
|---|---|
|Giả thuyết vòng sáu|♪ **CONFIRRED**|
|Nhận diện thế hệ SDK| ✅ **`nnos*` C API era, 121 symbols** |
|Thiếu bộ điều khiển| ✅ **found: `nnosInitialize` at `sdk+0x86bd8`** |
| `nnosInitialize` runs |♪ Phải, hãy trở về trong sạch ♪|
|Khoảng cách khởi động| ✅ **past `nnosInitialize`, `sdk::_init`, `main::_init`** |
|Name| ✅ `nnosGetDefaultUserExceptionStackForApplication` |
|Lỗi tiếp theo| ❌ `nn::nex::WaterMark` ctor, `this == NULL`, **located not fixed** |

## 5 Điều này không xác minh

- **`nn::nex::WaterMark`'s null `this` is not diagnosed** beyond `this == NULL`. Whether the cause is
  a null `new`, an unset static, or a missing allocator is unknown.
- **`sdk constructors: 0`** — the `init_array` loop reported **zero** constructors for `sdk`, which is
  suspicious and was not investigated. `main`'s count was not printed before the fault.
- **`nnosGetDefaultUserExceptionStackForApplication` returned 0** and its consequence was not
  traced; it may or may not be related to the null `this`.
- **Không có sự khởi tạo trò chơi nào đã hoàn thành.**
- ** The HLE phần lớn vẫn chưa được phân loại** — một thông tin nhập khẩu được gọi là 115 không.
- **Không NVN, không cửa sổ, không trình bày.**
- **`nnosInitialize`'s return value was not checked** — the code logs "returned" regardless.

## 6. Tăng dần

Two candidate causes for the null `this`, both cheap to distinguish:

1. **`sdk constructors: 0`** — if `sdk`'s `init_array` genuinely has zero entries, or the status word
   is wrong, then whatever registers the object behind `WaterMark` never ran.
2. **A null `new`** — the heap/SDK allocator path. `nn::init::InitializeAllocator` is one of the four
   `nn::init` symbols Splatoon 2 *does* export; if the game's allocator was never installed, every
   `new` returns null and this fault is the first symptom.

Instrumenting `main`'s constructor count and the first `new` result would settle it.
