# Scoping the heap layer: is `HeapMgr`/`ExpHeap` a wall?

`GAMEFRAMEWORK_SCOPE.md` ended on this question, because every level of `GameFramework`
Đứng trên đống đá, và trả lời nó.

** Verritic: có thể uốn nắn như một giao diện, nhưng nhà hóa học thật sự là một bức tường — và con đường xung quanh
Nó là để ngăn chặn các CN đã biển trên máy điều hòa thay vì tái tạo lại
`ExpHeap`'s free lists.**

---

## 1. 1 phát hiện quan trọng: 2 lô tên

Những lớp chất đống tồn tại **twice** trong nhị phân:

|Miền tên| `HeapMgr` | `ExpHeap` |Đường khởi động?|
|---|---:|---:|---|
| `pead::` | 13 | 31 | these are the addresses `inventory.txt` lists for the pead manglings |
| `sead::` |Hiện tại|Hiện tại|**Đây là những gì con đường khởi động gọi**|

`GAMEFRAMEWORK_SCOPE.md` recorded `pead::HeapMgr` addresses from an inventory grep while
the decompiled `GameFramework::initialize` body calls **`sead::HeapMgr`** and
**`sead::ExpHeap`** (`ExpHeap::create(sz, {"sead::SystemManagers"}, ...)`).

**So any porting must target `sead::`, and the `pead::` set must not be confused for it.**
An earlier scoping script searched only `_ZN4sead` and silently returned nothing because the
grep had matched `_ZN4pead`; that mistake is why this section exists. Two same-named
Phân cấp trong một hệ nhị phân chính xác là thứ tạo ra sai cảng.

## Cỡ 2.

|Hạng|Hàm|
|---|---:|
| `pead::HeapMgr` | 13 |
| `pead::ExpHeap` | 31 |
| `pead::Heap` (base) | 11 |
| `pead::Arena` | 1 |
|**total**| **56** |

`ExpHeap`'s 31 split into roughly **21 interface-shaped** methods and **10 internal
Trợ lý quản lý khối**:

```
interface-like:  create, tryCreate, doCreate, destroy, freeAll, adjust, adjustBack_,
                 adjustFront_, tryAlloc, free, resizeFront, resizeBack, realloc_,
                 tryRealloc, getAllocatedSize, getManagementAreaSize, setAllocMode
algorithm (_-suffixed): createMaxSizeFreeMemBlock_, pushToFreeList_,
                 findLastMemBlockIfFree_, findFirstMemBlockIfFree_,
                 allocFromHead_ (x2), allocFromTail_ (x2), pushToUseList_
```

## 3. Những gì con đường khởi động thực sự cần

From `Framework::initialize` and `GameFramework::initialize`:

|Hàm| Address (`pead::` equivalent) |Nhiệm vụ|
|---|---|---|
| `HeapMgr::initialize(u64)` | `0x7100c9419c` |nhập kích cỡ|
| `HeapMgr::initialize(Arena*)` | `0x7100c941b8` |khởi động mục nhập, hình đấu trường|
| `HeapMgr::initializeImpl_` | `0x7100c94258` |Xác được chia sẻ|
| `HeapMgr::createRootHeap_` | `0x7100c942f4` |tạo ra đống gốc|
| `HeapMgr::setCurrentHeap_` | `0x7100c94aec` |được dùng cho mọi bộ quản lý|
| `ExpHeap::create` | `0x7100c8f6c8` |Mỗi người quản lý hệ thống có một người|
| `Heap::getFreeSize` (`vptr+0x80`) | — |kích cỡ khối kế tiếp|
| `Heap::destroy` (`vptr+0x28`) | — |Phá hủy từng đống một|

Đó là **~8 chức năng** cho đường đi giày — chứ không phải 56.

## 4 bức tường, và con đường bao quanh nó.

**The wall:** `ExpHeap` is a genuine allocator. `allocFromHead_`/`allocFromTail_`,
`pushToFreeList_`, `findFirstMemBlockIfFree_` and friends are a real free-list
implementation with block splitting and `adjust`/`adjustBack_`/`adjustFront_` coalescing.
Xây dựng lại một cách trung thành là một phần đáng kể của công việc.

**Con đường xung quanh nó, đó là những gì các cổng nên làm:** thực hiện một đống *.
Động cơ đạt đến một đống thông qua giao diện của nó **virtal harctor**
(`vptr+0x80` for free size, `+0x28` for destroy, plus `alloc`/`free`/`resize`), so a host-
backed `Heap` that satisfies the interface is sufficient — the game does not depend on
`ExpHeap`'s *internal* block layout, only on the interface and its accounting.

This converts the gate from "reimplement a 31-method allocator" into **"implement the `Heap`
bề mặt giao diện "**, đó chính xác là cách mà lớp nền được xây dựng
(`port/src/os.cpp` implements `nn::os` over host primitives rather than reimplementing
Horizon).

**Điều gì có thể làm cho đường tắt sai:** bất cứ thứ gì đọc được tiểu bang chất đống - đi bộ
`MemBlock`s, `dumpTreeYAML`, or reasoning about fragmentation or exact addresses. Nothing
Nếu một giai đoạn sau có, đó là điểm mà một thực tế
`ExpHeap` becomes necessary.

## Kế hoạch 5 bị sửa đổi

1. **Port the `sead::Heap` interface** (the vtable surface the engine dispatches through)
   Được hậu thuẫn bởi người điều khiển máy — cùng một chiến lược như lớp nền.
2. **Port `sead::HeapMgr::initialize` / `createRootHeap_` / `setCurrentHeap_`** — 3
   chức năng, tất cả nhỏ, và mục nhập khởi động thực tế.
3. **Implement `sead::ExpHeap::create` as a factory returning a host-backed heap.** This is
   Một nơi mà lòng trung thành được trao đổi để có tính dễ dãi, và được ghi lại như thế.
4. Only then return to `Framework::initialize` (§2 of `GAMEFRAMEWORK_SCOPE.md`), which
   consumes `InitializeArg` and creates the `ThreadMgr` heap.

## 6 Những giới hạn chân thật

- ** Việc tìm kiếm không gian hai tên cần phải sửa đổi trước khi gửi.** Tài liệu này suy ra rằng
  `sead::` is the boot-path hierarchy from the decompiled call sites; the `pead::` set was
  what an inventory grep surfaced. The `sead::` addresses were not enumerated here.
- **`Heap`'s vtable offsets are taken from the decompile** (`+0x80`, `+0x28`) rather than from a full vtable dump, so the interface surface is only partly
  Xem xét nó là nhiệm vụ đầu tiên của bước 1.
- **`MemBlock` has zero matches** in this inventory scan, so the block type `ExpHeap`
  Không định vị được.
- **Không mã số nào được chuyển vào vòng này.** Người chạy giày vẫn dừng lại ở bước 5.
