# The blocker after `nnMain`: `sead::HeapMgr::initialize(0)`

With `nnMain` reached, the next fault is `sead::HeapMgr::getCurrentHeap()` in `Framework::initialize`. The
Nguyên nhân bây giờ được xác định: **Người quản lý đống của động cơ được khởi động với kích thước bằng 0, vì vậy nó không bao giờ được khởi động
tạo ra một đống rễ cây.

---

## 1.

The crash had `x0 = x19 = 0x7103663e70`. Resolving `main`'s symbols:

```
sead::HeapMgr::sInstance      0x3663e70     <- exactly the faulting pointer
sead::HeapMgr::sArena         0x3663e90
sead::HeapMgr::sRootHeaps     0x3663eb0
sead::HeapMgr::sIndependentHeaps 0x3663ee0
```

**So the null-ish dereference is `HeapMgr::sInstance` — the engine heap manager itself.**

## Số 2.

|Hàm|Hiệu|
|---|---|
| `HeapMgr::initialize(size_t)` | `0xe7c4e0` |
| `HeapMgr::initialize(Arena*)` | `0xe7c6b8` |
| `HeapMgr::initializeImpl_()` | `0xe7c5e4` |
| `HeapMgr::createRootHeap_()` | `0xe7c790` |
| `HeapMgr::setCurrentHeap_(Heap*)` | `0xe7cfc0` |
| `HeapMgr::getCurrentHeap()` | `0xe7cf7c` ← faults |

## 3. Các phép đo quyết định

Điểm ngắt trên cả ba điểm khai sáng thông qua một chạy đầy đủ:

```
HeapMgr::initialize(size=0x0)     hit #1        <-- CALLED, WITH SIZE ZERO
HeapMgr::initialize(Arena*)       0 hits
HeapMgr::createRootHeap_          0 hits        <-- NEVER CREATED
```

**The game *does* call `HeapMgr::initialize` — but passes `0`.** And because the size is zero,
**`createRootHeap_` is never reached**, so `sRootHeaps`/`sCurrentHeap` stay empty, and the first
`getCurrentHeap()` in `Framework::initialize` dereferences a manager with no heap.

**Đó là toàn bộ lỗi.**

## 4 ở đâu số 0 có khả năng đến từ

The size passed to `HeapMgr::initialize` is presumably derived from a **memory query**. The run's SVC trace
hiển thị:

```
svc 0x29  (GetInfo)  8 calls
```

`svcGetInfo` is exactly where a title asks how much memory it has. **If those queries return zero, the
computed heap size is zero, and `HeapMgr::initialize(0)` follows.**

`kernel.cpp` dispatches `GetInfo` to a `get_info(type, handle, sub, rc)` helper whose **definition was not
located in `kernel.cpp`** — it lives elsewhere in the runtime. **Its behaviour for the memory-info types was
không thanh tra.**

**Đây là giả thuyết hàng đầu và nó chưa được kiểm tra.**

## Điều này chứng minh gì?

|Mục|Tình trạng|
|---|---|
|Nhận diện con trỏ sai| ✅ **`HeapMgr::sInstance`** |
| `HeapMgr::initialize` called by the game |♪ Phải, một lần ♪|
|**Size đã qua**| ✅ **`0x0`** |
| `createRootHeap_` ever called |♪ Đừng bao giờ ♪|
| `initialize(Arena*)` ever called |♪ **no**|
|Sự kết hợp| ✅ **no root heap → `getCurrentHeap()` faults** |
|Tại sao kích thước là zero|vội vã trả lại 0 — dẫn đầu, chưa được kiểm tra**|

## 6 Những gì điều này không xác minh

- **Where the size comes from is not determined.** `get_info`'s definition was not found and its
  Ứng xử thông tin bộ nhớ chưa được đọc.
- **The eight `svc 0x29` calls were not individually inspected** — their types and return values are unknown.
- **Calling `HeapMgr::initialize` ourselves with a non-zero size was not attempted.** That is the obvious
  Thử nghiệm tiếp theo và nó vẫn chưa được thực hiện.
- **The game is not booted** — it faults in `GameFrameworkNx::initialize`.
- **Không có gì được trình bày.** Không có NVN, không có cửa sổ, không có đèn pha. ** Đây không phải là một trò chơi có thể chơi.**

## 7. Tăng dần

**Call `sead::HeapMgr::initialize(size)` ourselves, with a non-zero size, before `nnMain`** — after the
allocator is installed, since the root heap is carved from it. `main.base + 0xe7c4e0`, `x0 = size`.

Nếu tội lỗi biến mất và bản ghi thay đổi, điều đó xác nhận chẩn đoán và làm cho
Sai * sửa chữa rõ ràng: làm cho các yêu cầu bộ nhớ cung cấp các kích thước thực sự trở về các giá trị.
zero came from somewhere else and the search moves to the caller of `HeapMgr::initialize`.

**Đây là một thí nghiệm một dòng với một kết quả quyết định bằng cách nào đó.**
