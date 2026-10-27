# `sead::Heap` interface surface, from the vtable

`HEAP_LAYER_SCOPE.md` concluded the heap layer should be implemented **as an interface over
the host allocator** rather than by reconstructing `ExpHeap`'s free lists, and named
Đây là bản liệt kê.

Các vtable **is* giao diện co lại: động cơ đạt một chồng chỉ qua ảo
Thông báo, đây chính xác là những phương pháp mà một đống vật chủ phải cung cấp.

---

## A correction to `HEAP_LAYER_SCOPE.md`

Tài liệu đó nói rằng hai bù đắp đầu giày là:

> `vptr+0x80  Heap::getFreeSize` and `vptr+0x28  Heap::destroy`

**Điều thứ hai là đúng; điều đầu tiên là sai.** Các mục thực tế là:

|Hiệu|Mục|
|---|---|
| `vptr+0x78` | `ExpHeap::getFreeSize()` |
| **`vptr+0x80`** | **`ExpHeap::getMaxAllocatableSize(int)`** |

The boot path calls `+0x80` while building each system-manager heap:

```c
lVar3 = (**(code **)(*(long *)pHVar5 + 0x80))(pHVar5, 8);
pHVar5 = ExpHeap::create(lVar3, {"sead::SystemManagers"}, ...);
```

Vì vậy, nó đang yêu cầu cho kích thước của **max tất cả các khả năng nhận biết** tại 8-byte thẳng hàng, không phải kích thước miễn phí.
That distinction matters: a host-backed heap must implement `getMaxAllocatableSize(align)`
as its own method, not alias it to `getFreeSize()`.

## `sead::ExpHeap` vtable — 27 virtual functions

|vptr|Mục|Địa chỉ|
|---:|---|---|
|+ 0x00| `~ExpHeap()` (deleting) | `0x7100e76704` |
|+ 0x08| `~ExpHeap()` | `0x7100e76740` |
|+ 0x10| `checkDerivedRuntimeTypeInfo` | `0x7100e79958` |
|+ 0x18| `getRuntimeTypeInfo` | `0x7100e79a24` |
|+ 0x20| `destroy()` | `0x7100e76efc` |
|**+0x28**| **`adjust()`** | `0x7100e77308` |
|+ 0x30| `tryAlloc(size, align)` | `0x7100e776c0` |
|+ 0x38| `free(ptr)` | `0x7100e78334` |
|+ 0x40| `resizeFront(ptr, size)` | `0x7100e786f4` |
|+ 0x48| `resizeBack(ptr, size)` | `0x7100e78888` |
|+ 0x50| `tryRealloc(ptr, size, align)` | `0x7100e789f4` |
|+ 0x58| `freeAll()` | `0x7100e77208` |
|+ 0x60| `getStartAddress()` | `0x7100e78c14` |
|+ 0x68| `getEndAddress()` | `0x7100e78c1c` |
|+ 0x70| `getSize()` | `0x7100e78c28` |
|+ 0x78| `getFreeSize()` | `0x7100e78c30` |
|**+0x80**| **`getMaxAllocatableSize(align)`** | `0x7100e78cc4` |
|+ 0x88| `isInclude(ptr)` | `0x7100e771d0` |
|+ 0x90| `isEmpty()` | `0x7100e79930` |
|+ 0x98| `isFreeable()` | `0x7100e79940` |
|+0xa0| `isResizable()` | `0x7100e79948` |
|+0xa8| `isAdjustable()` | `0x7100e79950` |
|+ 0xb0| `dump()` | `0x7100e79820` |
|+ 0xb8| `dumpYAML(WriteStream&, int)` | `0x7100e78f9c` |
|+ 0xc0| `genInformation_(hostio::Context*)` | `0x7100e7992c` |
|+ 0xc8| `Heap::makeMetaString_(...)` | `0x7100e7c378` |
|+ 0xd0| `Heap::pushBackChild_(Heap*)` | `0x7100e7b450` |

**27 entries.** Entries +0xc8 and +0xd0 are inherited from `sead::Heap`, which confirms the
base and derived vtables line up — `ExpHeap`'s first four slots mirror `Heap`'s
(`~Heap` ×2, `checkDerivedRuntimeTypeInfo`, `getRuntimeTypeInfo`).

## Những gì các chủ thể phải thực hiện

** Mọi thứ từ + 0x20 đến + 0xb8** là giao diện thật. Đối với đường dẫn khởi động đặc biệt:

|Phương pháp|Cần thiết|
|---|---|
| `tryAlloc` / `free` / `freeAll` |các định vị thực tế|
| `getMaxAllocatableSize(align)` | **sizing each system-manager heap** (the `+0x80` call) |
| `getFreeSize` / `getSize` / `getStartAddress` / `getEndAddress` |kế toán đống|
| `destroy` |xé từng đống một|
| `adjust` | boot path reaches it at `+0x28` |
| `resizeFront` / `resizeBack` / `tryRealloc` |Có thể đạt được; cần thiết để tăng trưởng|
| `isInclude` / `isEmpty` / `isFreeable` / `isResizable` / `isAdjustable` |Các truy vấn khả năng|

**`dump`, `dumpYAML` and `genInformation_` can be inert** — they are diagnostics, not boot
path. `dumpYAML` is precisely the "reads heap-internal state" case
`HEAP_LAYER_SCOPE.md` flagged as where the shortcut would break; nothing on the boot path
Gọi nó đi, để nó có thể là một cái cọc trong khi phần còn lại là thật.

## Name

These vtables begin with **two zero words**, not the GNU ABI's `offset-to-top` and
`typeinfo` pointers. The first reader of this script broke out of its loop on the first
0 và báo cáo một **pouty vtable cho cả ba lớp** — cùng một tương đối-vs-absolute
và cái bẫy tiêu thụ định dạng được ghi lại sớm hơn trong dự án này.
không được coi là kết thúc.

Slots cũng giữ ** Hình ảnh-cơ sở** giá trị tại phần còn lại (RELATVE recation addends), do đó, một
stored `0xe77308` means `0x7100e77308`. Reading them as absolute yields small unnamed
Những con số.

## Tăng dần kế

Implement `sead::Heap`'s interface (the table above) backed by the host allocator, then
`HeapMgr::initialize` / `createRootHeap_` / `setCurrentHeap_`, then `ExpHeap::create` as a
factory returning a host-backed heap — at which point `Framework::initialize` becomes
Mang theo.

## Giới hạn

- **`HeapMgr`'s vtable entries at +0x18..+0x50 are unnamed** (`0x7100e7d704` onward, 4-byte
  apart), so `HeapMgr`'s virtual surface is not identified — only `ExpHeap`/`Heap`'s is.
- **`sead::Heap`'s own vtable stops at +0x18** in this scan (four real entries), so the rest
  of its surface is defined by `ExpHeap`'s full listing rather than enumerated directly.
- **Không có mã số nào được chuyển đến.** Người chạy giày vẫn dừng lại ở bước 5.
