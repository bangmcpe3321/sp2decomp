# The circular dependency: `IDisposer(heap=null)` — and why patching cannot break it

Kết quả là lời tuyên bố rõ ràng nhất của ** tại sao không thể sửa chữa một miếng vá tại một
thời gian**.

---

## 1, tìm thấy gì?

|Tỷ lệ|Kết quả|
|---|---|
| `sead::Arena::Arena()` called? | ✅ **yes — once**, on `this = 0x7103663e98` = **`HeapMgr::sDefaultArena`** |
|♪ Là người gọi nó ♪| `main_00E7D068` ← `main_00000024` (`_init`) — **a normal static constructor** |
| `sead::Arena::initialize(size)` called? | ✅ yes — **by `HeapMgr::initialize(size)`**, with our diagnostic's `0x10000000` |
|Sau đó là lỗi mới.| **`sead::IDisposer::IDisposer(Heap*, HeapNullOption)`** at `0xe76550` |

## Lỗi mới là gì?

`sead::IDisposer` is the **base class of almost every sead object**, and its constructor takes a `Heap*` plus
a `HeapNullOption`. It registers the object with that heap.

The fault occurs immediately after, while constructing an `ExpHeap`
(`ExpHeap::ExpHeap(SafeStringBase const&, Heap*, void*, size_t, ...)` at `0xe76670`).

**So the engine is trying to create a heap, whose `IDisposer` base needs a heap — and there isn't one.**

**Đó là một sự phụ thuộc hình tròn đúng sự thật:**

> Để tạo ra đống đầu tiên, bạn cần một đống.

## 3. Tại sao không thể vá lại?

Trên phần cứng, vòng tròn bị phá vỡ bởi **SDK/cơ chế khởi động**, mà:

1. obtains the process memory via `svcSetHeapSize`,
2. Đặt một đấu trường thông thường và hệ thống **trên nó,
3. creates the **first** `ExpHeap` with a **null parent** (which `HeapNullOption` exists precisely to permit),
4. installs it as `HeapMgr`'s root, and only then
5. runs `nnMain`, where `SysInit` and `Framework::initialize` can call `getCurrentHeap()` and get something.

**This port does none of steps 1–4.** It jumps to `nnosInitialize` → `nnMain`. Every missing value found so
Cho đến nay là một triệu chứng của sự thiếu sót đó:

|Thiếu kết nhập|Tại sao nó lại bị mất?|
|---|---|
| `InitializeArg` size fields = 0 |Điền đầy mã khởi động vào các cổng nhảy qua|
| `HeapMgr::initialize(0)` |Kích cỡ đến từ cùng trạng thái khởi động|
| `sDefaultArena` has no buffer |đấu trường sẽ được đặt trên bộ nhớ tiến trình khi khởi động.|
| `IDisposer(heap = null)` |Không có một đống rễ cây nào tồn tại vì cái bẫy không bao giờ chạy.|

Mỗi cái là một cái lá, cắt lá không mọc cây.

## 4 phán quyết trung thực.

** Đây không còn là lỗi nữa. Nó là một giai đoạn thiếu của quá trình lặp lại sự sống.**

Bước kế tiếp không phải là đo lường khác, mà là tăng tốc khởi động động cơ.
process heap, place a static `sead::Arena` over it, create the first `ExpHeap` with a null parent, and install
it via `HeapMgr` before `nnMain`. That is a **design task of real size**, not an observation.

**Và ngay cả điều đó cũng không thể tạo ra một trò chơi đang chạy.** Ngoài ra nó còn là toàn bộ bề mặt NVN — không bao giờ tập thể dục
Một lần trong dự án này - và máy làm bóng của Maxwell 2, đã vượt quá phạm vi.

## Điều này chứng minh gì?

|Mục|Tình trạng|
|---|---|
| `sDefaultArena` is constructed |Phải, như một trạng thái tĩnh lặng bình thường**|
| `Arena::initialize(size)` is invoked | ✅ by `HeapMgr::initialize(size)` |
|Name| ✅ `0x10000000` (diagnostic) |
|Lỗi được xoá| ❌ **no — moved to `IDisposer(heap=null)`** |
|Nguyên nhân gốc|Một đống cần thiết để tạo ra đống đầu tiên**|
|Sửa được bằng cách vá thêm|Nó cần giai đoạn khởi động**|

## 6 Những gì điều này không xác minh

- **Đó chính là những gì Slatoon 2 bắt đầu làm.** Đó là tiêu chuẩn
  NintendoSDK/sead và nó giải thích mọi quan sát, nhưng chức năng khởi động trò chơi này chưa bao giờ
  Địa điểm hoặc đọc.**
- **Whether a root `ExpHeap` with a null parent would satisfy `Framework::initialize`.** Not tested.
- **That `Arena::initialize(size)` does not allocate a buffer internally.** Not disassembled.
- ** Trò chơi không khởi động.** Không có gì được diễn ra. Không có NVN, không có cửa sổ, không có đèn pha.
- ** Đây không phải là một trò chơi có thể chơi được, và công việc này đã không thành công.**

## 7, đề nghị bước kế tiếp — và đó là quyết định, chứ không phải đo lường

** Đừng đo lường; hãy quyết định.** Ba lựa chọn chân thật:

1. **Implement the engine bootstrap** (allocate process heap → static arena → first `ExpHeap` with null parent
   → install as `HeapMgr` root → then `nnMain`). Sizeable, and unblocks only the *next* layer.
2. ** Cổng ra một tiêu đề mà thời gian chạy này bắt đầu đã trình diễn** — i.e. mà thế hệ SDK tương ứng với những gì
   Thời gian chạy của MIT đã được viết nên rẻ hơn nhiều, về vật chất nhiều khả năng tạo ra một trò chơi đang chạy.
3. **Stop, and keep this as documentation.** The repository now contains a fully-named map from `nnMain` to a
   Quan hệ phụ thuộc vòng tròn, một cuốn sổ tay 6 lối vào im lặng, và hai cái bẫy công cụ chuyển sang
   bất cứ danh hiệu nào.

** Phương pháp thử nghiệm đã hết tác dụng.** Mỗi vòng đo lường thêm sẽ tạo ra một cái tên khác
Lá trên cùng một cây. và nó nên được chọn một cách có chủ tâm hơn
phát hiện ra từng lỗi một.
