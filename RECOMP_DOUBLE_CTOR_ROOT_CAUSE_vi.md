# TWICE đang chạy

Điểm quan sát trả lời câu hỏi mở, và câu trả lời không nằm trong dữ liệu — nó nằm trong thời kỳ **runtime**.
Cánh cổng chạy tất cả các máy tạo tĩnh **2 lần**, và đó là những gì tạo ra tự liên kết.

---

## 1. The four writes to `node->m_pNext` (`0x710304fb98`)

A hardware watchpoint on the node's `m_pNext` caught every write, with a host backtrace:

| # |Giá trị mới| Writer (`#0`) | Chain to `init_module` |
|---:|---|---|---|
| **1** | `0x0` | `main_00D2F404` (PGV base ctor) | `… → main_00000024 → main_00D1A3E8 → main_00D0CB08 → main_00D2F404` |
| **2** | `0x7103650210` | `main_00D181E0` (**`SetNext`**) | `… → AddVariable → main_00D5A238` |
| **3** | `0x0` | `main_00D2F404` (**again**) | `… → main_00D1A3E8 → main_00D0CB08 → main_00D2F404` ← **no `main_00000024`** |
| **4** | **`0x710304fb90`** | `main_00D181E0` (**`SetNext`**) | `… → AddVariable → main_00D0CB08 → main_00D1A3E8` |

**Write #4 is the self-link, and it comes from `AddVariable`, invoked by constructor `main_00D1A3E8`.**

## 2. Súng hút thuốc là viết # 1 đấu viết #3

Both write `0x0` to the same field via the same function — but the **chains differ**:

- **#1**: `init_module → call_preserving → nx::call → `**`main_00000024`**` → nx::call → main_00D1A3E8 → …`
- **#3**: `init_module → call_preserving → nx::call → main_00D1A3E8 → …`

**`main_00000024` is `_init`** — offset `0x24`, the very same offset `init_module` uses for `_init`
(`sdk: _init at +0x24`, `main: _init at +0x24`).

**And `_init` runs the constructor table itself.** So:

```cpp
static void init_module(CPU& c, const ModuleInfo& m) {
    call_preserving(c, m.base + init_off);        // _init -> runs EVERY constructor   (pass 1)
    ...
    for (size_t k = 0; k < m.init_count; k++)     // then the port runs them ALL AGAIN (pass 2)
        call_preserving(c, m.base + m.init_array[k]);
}
```

**Mọi máy tạo tĩnh điện đều chạy hai lần. **

## 3, Tại sao điều này gây ra nạn tham nhũng chính xác?

1. ** LE 1** đăng ký PGVs và xây dựng chuỗi thông thường (viết 2).
2. **Pass 2** re-runs the `PseudoGlobalVariable` constructor, which resets `m_pNext = 0` (**write #3**).
3. Its `AddVariable` then walks the list, finds that node as the tail (its `m_pNext` was **just zeroed**),
   and calls `tail->SetNext(node)` where `tail == node` — **`node->m_pNext = node`** (**write #4**).
4. Giấy đăng ký tiếp theo đi vào chu kỳ và **hangs**.

**This accounts for every observation since round 7**: the duplicate registration, the `.bss` node whose
Tự chỉ điểm được viết vào thời điểm chạy, "đi bộ dừng lại ngay lập tức", và sự quay CPU. **Không ai trong số đó là một
bọ chơi.**

## 4. Sửa chữa, và kết quả

`init_module` now relies on `_init` alone; the `init_array` loop is gated behind `NX_DOUBLE_CTOR` so both
Hành vi vẫn có thể kiểm tra được.

**Before (constructors twice):** hang at `main init[1367]`,
`nn::nex::PseudoGlobalVariable<StreamSettings>`, exit 124.

**Sau đó (những người quay phim một lần):**Cái giá treo cổ là xong **, và cuộc chạy bộ sẽ làm họ phát điên thêm**:

```
nnosInitialize returned
sdk: _init at +0x24
  sdk: init_status @ sdk+6bf678 = 2, init_count = 74
installing game allocator at kHeapBase: 0x5000000000 size 0x20000000 (guest space)
main: _init at +0x24
  main: init_status @ main+2fdc0b8 = 2, init_count = 1604
=== HOST SIGSEGV ===
  fault address : 0x88
  guest lr      : main+e767d0
                  (_ZN4sead7ExpHeap9tryCreateEmRKNS_14SafeStringBaseIcEEPNS_4HeapEiNS5_13HeapDirectionEb+44)
```

**`_init` demonstrably runs the constructors** — it reached `sead::ExpHeap::tryCreate`, the game's own heap
Quản lý, mà chỉ xảy ra sau khi rất nhiều im lặng.

**The failure has moved out of `nn::nex` entirely** and into `sead::ExpHeap` creation at `this + 0x88` — a
không phải là một sự xoay vòng.

## Điều này chứng minh gì?

|Mục|Tình trạng|
|---|---|
|Ai đã viết tự liên kết| ✅ **`SetNext` called from `AddVariable`** |
|Người xây dựng đã gọi nó| ✅ **`main_00D1A3E8`** |
|**Root nguyên nhân**| ✅ **`init_module` ran every constructor twice (`_init` + `init_array` loop)** |
|Tại sao bản sao xuất hiện|♪ Bỏ qua 2 lần đăng ký lại các đối tượng của 1 ♪|
| Why the node's `m_pNext` was zero at pass 2 |(Tiếng viết #3)|
|Tại sao nó tự liên kết|♪ Đi bộ tìm thấy cái lõi là đuôi, và đuôi là nút**|
|Nó là một lỗi trò chơi|(Tiếng Tây Ban Nha) (Tiếng cười)|
|**PGV hang**|**FIXED**|
|Comment| ❌ `sead::ExpHeap::tryCreate +0x44`, fault `0x88` |

## 6 Những gì điều này không xác minh

- **The new `sead::ExpHeap::tryCreate` fault is not diagnosed.** Whether it is caused by the 512 MB heap at
  `kHeapBase`, by `svcSetHeapSize` still never being called, or by something else is **unknown**.
- **`main`'s constructors completing is not proven** — the fault occurs during `main: _init`. **`nnMain` is
  Vẫn chưa tới.
- **`_init` was called once, not twice, in the new run** — but that was not independently verified with a
  Điểm quan sát; nó được suy ra từ treo cổ biến mất.
- **`NX_DOUBLE_CTOR` was not tested** — the retention path exists but was not exercised.
- **The Alloctor's 512 MB kích thước vẫn là một sự lựa chọn tùy ý**, không bắt nguồn từ NPDM.
- **Không NVN, không cửa sổ, không bóng râm, không trình bày. ** Đây không phải là một trò chơi khởi động.**

## 7. Tăng dần

**Diagnose `sead::ExpHeap::tryCreate +0x44`.** It is now the first fault after a *correct* single-pass
Thiết bị xây dựng, làm cho nó trở thành vật cản thực sự hơn là một triệu chứng của người đầu tiên.

Hai nguyên nhân, cả hai đều rẻ để kiểm tra:

1. **`svcSetHeapSize` still never being called** — the kernel's heap bookkeeping (`g_heap_size`, `vm_set`) is
   never established, only our manual `commit`. Calling the svc path first would match hardware exactly.
2. **The 512 MB heap at `kHeapBase` not matching what `sead::ExpHeap` expects** — `tryCreate` may require a
   parent heap that `nnosInitialize` would normally have made.
