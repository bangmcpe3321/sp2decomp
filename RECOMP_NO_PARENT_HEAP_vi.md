# The circle-breaker exists: `ExpHeap::tryCreate` has a no-parent overload

Động cơ khởi động đã được thực hiện đúng như các bằng chứng cho phép. **Nó tạo ra đống làm việc đầu tiên
Tạo ra dự án này có** — và tiết lộ lớp tiếp theo của vòng tròn.

---

## Một. khám phá

`sead::ExpHeap` has **three** `tryCreate` overloads, and the project had been using the wrong one:

|Tải quá nhiều|Ký hiệu|Kết quả|
|---|---|---|
| `(size, name, Heap* parent, int, HeapDirection, bool)` | `…tryCreateEmRKNS_…EPNS_4HeapEiNS5_13HeapDirectionEb` | **faults** at `+0x44` (the engine's own path) |
| `(void* buf, size_t, name, Heap* parent, bool)` | `…tryCreateEPvmRKNS_…EPNS_4HeapEb` |**re bật tắt null** (đã bỏ qua một phụ huynh vô giá trị)|
| **`(void* buf, size_t, name, bool)`** | **`…tryCreateEPvmRKNS_…Eb`** |**WORKS**|

** chịu quá tải 4 lần không có tham số phụ huynh** - nó tồn tại chính xác để đống đầu tiên có thể là
được tạo ra khi không có gì để nuôi nó. **Đây là nguyên thủy không vòng tròn mà cái bẫy cần thiết.**

```
bootstrap: ExpHeap::tryCreate(buf=5001000000, size=0xf000000, NO-PARENT overload) at main+e76b18
bootstrap: root heap = 0x5001000000
```

**`0x5001000000` is the first heap this port has ever successfully created.** Every earlier attempt returned
Vô giá trị hay lỗi lầm.

## Lớp 2 tiếp theo của hình tròn

Với một đống thực sự trong tay, hai cuộc gọi được thử cài đặt, và cả hai đều có lỗi:

|nhỏ|Hiệu|Kết quả|
|---|---|---|
| `HeapMgr::setCurrentHeap_(heap)` | `0xe7cfc0` | fault, `0x88` |
| `HeapMgr::initializeImpl_()` (added before it) | `0xe7c5e4` | fault at **`(nil)`** |

**Both need `HeapMgr::sInstance` to exist, and it does not.** So the ordering problem recurses one level:

> nhưng đối tượng quản lý **heap mà sẽ sở hữu nó** thì không.

`HeapMgr::initialize(size)` is the call that creates that state — **and it is the one that needs the arena**,
Đó là ngõ cụt từ các hiệp trước.

## 3. Một sự sửa đổi xứng đáng để ghi âm

At one point `lr = 0x6f000005a0 (hle:__process_return)` looked like evidence of a bad return address. **It is
not** — that is the trampoline `call_preserving` installs, so it simply marks "the fault happened inside this
Đọc nó như một bằng chứng là một sai lầm, và nó được ghi nhận vì vậy nó không được lặp lại.

## Điều này chứng minh gì?

|Mục|Tình trạng|
|---|---|
| **`tryCreate(buf, size, name, bool)` exists and works** |♪ Người chủ đã tạo ra, không phải chim sẻ ♪|
|Tốc độ quá tải 5 mẫu sẽ từ chối cha mẹ vô giá trị|Đã xác nhận|
| The engine's own `tryCreate(size, …, parent)` path fails |Đã xác nhận|
| `setCurrentHeap_` alone is sufficient | ❌ **faults — needs `sInstance`** |
| `initializeImpl_()` first is sufficient | ❌ **faults at `(nil)` — also needs `sInstance`** |
|Cấu trúc hoàn tất|**no — một lớp sâu hơn**|

## 5 Điều này không xác minh

- **What `HeapMgr::initializeImpl_()` dereferences at `(nil)`** was not identified — it may need `sInstance`
  Được phân phát, hoặc khóa, hoặc đấu trường.
- **How `sInstance` is meant to be created** was not determined. `HeapMgr::initialize(size)` does it, but needs
  đấu trường; không có gì khác trong ADI làm.
- **Cho dù địa chỉ đống rễ là đúng** — nó bằng bộ đệm chúng tôi đã đi qua, mà được mong đợi, nhưng không có gì
  đã sử dụng nó thành công.
- **Các 240 MB root-heap kích thước và 16 MB bù đắp** vẫn còn tùy ý lựa chọn.
- ** Cổng không được khởi động.** Không có gì được mở ra. ** Đây không phải trò chơi có thể chơi.**

## 6. Tăng dần

**Find what creates `HeapMgr::sInstance`.** It is a static at `0x3663e70`. Two routes:

1. **Disassemble `HeapMgr::initialize(size)`** (`0xe7c4e0`) — it must construct `sInstance` and the arena before
   `createRootHeap_`. Whatever it does *first* (before touching the arena) is what needs reproducing.
2. **Allocate `sInstance` from the root heap we now have**, then call `initializeImpl_()`. If `sInstance` is a
   Vật đơn giản mà người quản lý phân phát từ đống riêng của mình, điều này kết thúc vòng lặp.

**Route 1 là nguyên tắc và nó là một đọc tĩnh.** Không có cha mẹ đã loại bỏ một lớp của
Vòng tròn; tuyến 1 chỉ ra làm thế nào để loại bỏ tiếp theo.
