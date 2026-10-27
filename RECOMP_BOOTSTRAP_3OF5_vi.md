# Ba trong năm bước khởi động bây giờ đi qua

The four-step bootstrap was implemented in the order read from `HeapMgr::initialize(size)`. **Steps 1–3 all
Thành công.** Lỗi đã di chuyển đến bước 4.

---

## 1. thực hiện

`bootstrap_engine_heap()` in `main.cpp` now performs, in order:

|Step|nhỏ|Hiệu|Kết quả|
|---|---|---|---|
| **1** | `CriticalSection::lock()` on `HeapMgr::sHeapTreeLockCS` (`main+0x3663f10`) | `0xe98bd8` | ✅ |
| **2** | `HeapMgr::sDefaultArena.initialize(size)` (`main+0x3663e98`) | `0xeb9f1c` | ✅ |
| **3** | `ExpHeap::tryCreate(buf, size, name, bool)` — **no-parent overload** | `0xe76b18` | ✅ **heap `0x5001000000`** |
| **4** | `HeapMgr::setCurrentHeap_(heap)` | `0xe7cfc0` | ❌ **fault `0x88`** |
| 5 | `CriticalSection::unlock()` | `0xe98be8` |chưa tới|

```
bootstrap: 1/5 locked sHeapTreeLockCS
bootstrap: 2/5 sDefaultArena.initialize(0xf000000)
bootstrap: 3/5 no-parent tryCreate -> heap 0x5001000000
=== HOST SIGSEGV ===  fault 0x88
```

** Ba trong số năm**, bao gồm cả một đống công trình sáng tạo mà mọi nỗ lực trước đây đều thất bại.

## Tại sao bước thứ 2 thất bại — và có thể chẩn đoán được

The fault is at `0x88`, the **same offset** seen in the original `getCurrentHeap` crash. The adjacent statics
Hãy giải thích:

|Địa chỉ|Sao?|
|---|---|
| `0x3663e70` | **`HeapMgr::sInstance` — a pointer** |
| `0x3663e98` | `HeapMgr::sDefaultArena` — **an object, only `0x28` later** |

So `setCurrentHeap_` is almost certainly `sInstance->mCurrentHeap = heap`, and **`sInstance` is still null** →
`*(0 + 0x88)`. **The lock and the arena do not create it.**

## 3. Điều này chứng minh gì?

|Mục|Tình trạng|
|---|---|
| Step 1 `CriticalSection::lock()` |♪ Các công việc ♪|
| Step 2 `Arena::initialize(size)` |♪ Các công việc ♪|
| **Step 3 root heap via no-parent `tryCreate`** | ✅ **works — heap `0x5001000000`** |
| Step 4 `setCurrentHeap_` | ❌ **faults — `sInstance` is null** |
|Bước 1–3 theo thứ tự chính xác|{\cH00FFFF}Được xác nhận bằng cách hành quyết**|
|Khóa là hợp pháp trước khi có bất kỳ đống nào tồn tại|Tập luyện đã xác nhận.|

## 4 Những gì điều này không xác minh

- **`HeapMgr::HeapMgr()` (`0xe7c4c0`) was not called**, so whether constructing `sInstance` is the right fix is
  Chưa được kiểm tra.
- **`sInstance`'s expected size and where it should be allocated** are unknown.
- **Whether `setCurrentHeap_` requires anything else** — a lock being held (it is), or `initializeImpl_` having
  Chạy (những khuyết điểm nào) — chưa được xác định.
- **Step 5 (`unlock`) was never reached**, so the lock is left held if the install path errors.
- **Các 240 MB root-heap kích thước và 16 MB bù đắp vẫn tùy ý**, không bắt nguồn từ.
- ** Cổng không được khởi động.** Không có gì được mở ra. ** Đây không phải trò chơi có thể chơi.**

## 5. Tăng dần

**Construct `HeapMgr` and set `sInstance`**, then retry step 4:

1. carve a small object from the heap buffer (`HeapMgr::HeapMgr()` at `0xe7c4c0`)
2. call it with `x0` = that object
3. store the result into `*(main.base + 0x3663e70)` — set `sInstance`
4. retry `setCurrentHeap_`

3 đường thẳng trên những gì đã thành công. **Đây là nhiệm vụ ngắn gọn, cụ thể, chứ không phải tìm kiếm.**
