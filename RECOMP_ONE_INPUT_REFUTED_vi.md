# The one-input hypothesis is wrong: the fault moves to `sead::Heap::Heap`

The diagnostic was run. Calling `HeapMgr::initialize(0x10000000)` ourselves moved the fault **deeper into
còn đây là một câu trả lời cho câu hỏi chiến lược:
Vấn đề kích hoạt khuôn khổ, không phải là một số còn thiếu.**

---

## Một, chẩn đoán đã làm gì?

Inserted before the real `nnMain`:

```cpp
uint64_t hm = 0;
if (find_func_offset(nx_module_main, "_ZN4sead7HeapMgr10initializeEm", hm)) {
    c.x[0] = 0x10000000;                       // 256 MB of the 512 MB game heap
    call_preserving(c, nx_module_main.base + hm);
}
```

It ran — the log shows `DIAGNOSTIC: sead::HeapMgr::initialize(0x10000000) at main+e7c4e0` — and then:

| |Trước|chứa|
|---|---|---|
|Hàm lỗi| `sead::ExpHeap::tryCreate` | **`sead::Heap::Heap(SafeStringBase const&, Heap*, void*, size_t, HeapDirection, bool)`** |
|Địa chỉ bị lỗi| `0x88` | **`0x10`** |

**The fault moved rather than disappeared.** `HeapMgr::initialize(size)` got *into* heap creation and then
thất bại một bước tiếp theo xuống.

## 2 nghĩa là gì?

`sead::HeapMgr::initialize(size_t)` constructs a root heap from a **default arena** — in this build,
`sead::HeapMgr::sArena` (`0x3663e90`) / `sDefaultArena` (`0x3663e98`). **That arena holds the buffer the heap
is carved from, and the port never initialises it**, so the `Heap` constructor is handed a null buffer/parent
and dereferences `+0x10`.

**Vì vậy cung cấp một kích thước là cần thiết nhưng không đủ.** Cái bẫy biển là một **sequecation**:

1. an `Arena` must be created over a real buffer,
2. `HeapMgr::initialize(Arena*)` (or an equivalent) must install it,
3. only then can `HeapMgr::initialize(size)`/`createRootHeap_` succeed.

** Cổng không thực hiện bước 1–2**, bởi vì họ sống trong SDK/N khởi động vào tại
`nnosInitialize` → `nnMain` bypasses.

## 3. Câu trả lời chiến lược

|Hỏi|Trả lời|
|---|---|
|Đây có phải là vấn đề một lần không?|♪ **no**|
|Có phải đó là một vấn đề về tư duy cơ bản?|[Tiếng Tây Ban Nha] (Tiếng Tây Ban Nha)|

**Đó là kết quả hữu ích.** Nếu lỗi được xóa, công việc còn lại sẽ là "bên phải
Nó không rõ ràng, và hình dạng của những tác phẩm còn lại bây giờ được biết đến là lớn hơn và khác biệt.

## Điều này chứng minh gì?

|Mục|Tình trạng|
|---|---|
| `HeapMgr::initialize(size)` callable from the port |♪ Phải, chạy|
|Lỗi được xóa bằng cách cung cấp kích cỡ|♪ **no**|
|Lỗi di chuyển| ✅ **to `sead::Heap::Heap(...)` at `0x10`** |
|Nguyên nhân căn bản của lỗi đó|vội vã trên đấu trường/bộ đệm — dẫn đầu, không được chứng minh**|
|Bản chất của các vấn đề còn lại|¶ bước nhảy theo bước chân khởi động**|

## 5 Điều này không xác minh

- **The null arena reading is not proven.** The `Heap` constructor's arguments were not read at the fault;
  `0x10` could be a different field of a different null object.
- **`HeapMgr::initialize(Arena*)` was not tried** — the next step in the sequence, and the obvious experiment.
- **The `sead::Arena` API was not located** in the symbol table.
- **The diagnostic is currently unconditional**: `main.cpp` calls `HeapMgr::initialize(0x10000000)` before every
  `nnMain`. **It is a diagnostic, not a fix**, and it changes the observed failure from the true one to a
  Sâu hơn nữa. **Nó nên được đóng hay gỡ bỏ trước khi "nó đi xa đến đâu". **
- ** Trò chơi không khởi động.** Không có gì được diễn ra. Không có NVN, không có cửa sổ, không có đèn pha.
- **Đây không phải trò chơi có thể chơi được.**

## 6 nơi nó rời khỏi dự án

Dây xích giờ đã được vẽ đầy đủ và kết thúc bằng một cái bẫy đa bước nhiều:

```
nnMain
  -> Lp::Sys::SysInit::Init
    -> sead::GameFrameworkNx::initialize
      -> sead::GameFramework::initialize
        -> sead::Framework::initialize
          -> arg sizes are 0  (who fills them: unknown)
          -> sead::HeapMgr::initialize(0)
            -> no arena installed  (step 1-2 never happen)
              -> sead::Heap::Heap(null buffer) -> fault
```

** Mọi liên kết đều được đặt tên. Không có dữ liệu nào bị mất.** Cung cấp chúng có nghĩa là tái tạo biển cả'
Khởi động động cơ, trên phần cứng chạy như là một phần của SDK khởi động mà cảng này không hoạt động.

## 7. Tăng dần

**Locate the `sead::Arena` API** (`Arena::initialize`, `Arena::sInstance`) and determine whether an arena can
be constructed over the game heap and installed before `nnMain`. That is the next link in the sequence, and
Nó là cùng một loại đo lường đã làm việc: tìm các chức năng, phá vỡ trên nó, xem liệu nó có được gọi là.

Nếu đấu trường không thể bị gài bẫy mà không mất thêm bang nào nữa, thì kết luận trung thực là
Cổng cần đường dẫn khởi động **SDK/cơ khí thay vì nhiều bản vá cá nhân —⁠ một mảnh lớn hơn đáng kể
công việc hơn bất cứ thứ gì đã cố gắng.
