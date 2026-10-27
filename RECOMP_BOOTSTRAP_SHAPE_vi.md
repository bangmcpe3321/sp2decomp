# `HeapMgr::initialize(size)` starts by taking a lock — not by allocating

Disassembled `HeapMgr::initialize(size_t)` (`0xe7c4e0`) to find what it does *before* touching the arena. The
Câu trả lời rất hẹp và hữu ích.

---

## Một, trình tự

```asm
main_00E7C4E0  (HeapMgr::initialize(size_t))
  +8..+88    register/stack housekeeping
  +95        mov (%rdi),%rax ; c.x[0] = size
  +105       load a vtable-ish pointer
  +135       call main_00E98BD8      <-- sead::CriticalSection::lock()
  +140..+197 ...loads, then:
  +207       call main_00EB9F1C      <-- sead::Arena::initialize(size_t)
  ...
```

**`main_00E98BD8` resolves to `sead::CriticalSection::lock()`**, confirmed against the symbol table — and it sits
trong một chạy của các chức năng khoá/rat:

```
0xe98b2c  CriticalSection::CriticalSection(Heap*, IDisposer::HeapNullOption)
0xe98bd8  CriticalSection::lock()
0xe98be0  CriticalSection::tryLock()
0xe98be8  CriticalSection::unlock()
0xe98bf0  Event::Event()
```

## 2 nghĩa là gì?

**`HeapMgr::initialize(size)` does, in order:**

1. ** Khóa phần quan trọng của cây số**
2. `sDefaultArena.initialize(size)`
3. tạo đống gốc
4. (không khóa)

**Nothing is allocated before the lock.** `initializeImpl_()` — the call guessed at last round — is **not** part
of this path, which explains why calling it produced a fault at `(nil)`: it is a *different* entry with different
Trước khi điều chỉnh.

**Vì vậy, cái "điều gì đó đầu tiên" cái bẫy cần là đơn giản: nắm lấy ổ khóa.** Không cấp quyền cho một đối tượng quản lý, không phải
Xây dựng một đấu trường — khóa cửa.

## 3. Tại sao điều đó quan trọng cho vòng tròn?

The lock is `sead::CriticalSection`, which derives from `IDisposer` — the type whose constructor **faults on a
Có vẻ như là một vòng tròn cứng: ổ khóa cần một đống, cái đống cần ổ khóa.

**But `idDisposer`'s constructor takes a `HeapNullOption` parameter** (`CriticalSection::CriticalSection(Heap*,
IDisposer::HeapNullOption)`). That parameter exists **precisely** so a `CriticalSection` can be constructed with a
Vứt đi, trước khi có đống nào.

**So the lock is constructible first, and the circle is broken by `HeapNullOption` — which is what the earlier
đạn bị nghi ngờ nhưng không thể xác nhận.** Thứ tự là: khóa (nul-heap-perited) _ đấu trường gốc _BAR_
cài đặt khóa  vội vàng.

## Điều này chứng minh gì?

|Mục|Tình trạng|
|---|---|
| First action of `HeapMgr::initialize(size)` | ✅ **`CriticalSection::lock()`** |
|Độ lệch| ✅ `0xe98bd8` |
|Hành động thứ hai| ✅ **`Arena::initialize(size)`** at `0xeb9f1c` |
| `initializeImpl_()` in this path | ❌ **not called** — explains the `(nil)` fault |
|Khoá được xây dựng mà không có một đống| ✅ **`HeapNullOption` exists for exactly this** |
|Xác định vị trí khoá/rangle| ✅ `0xe98b2c`, `0xe98bd8`, `0xe98be0`, `0xe98be8` |

## 5 Điều này không xác minh

- **`setCurrentHeap_`'s `0x88` fault was not explained.** It may require the lock held; untested.
- **Whether the heap-tree `CriticalSection` static is already constructed** by `main`'s `init_array` was not
  Xác nhận — nếu đúng, có thể lấy được ổ khóa.
- **The unlock step** was not located in the disassembly beyond `+296`.
- ** Chuỗi cuộc gọi chính xác từ cổng không được viết hay thử nghiệm** — vòng tròn này xác định hình dạng, không phải
  làm việc thực hiện.
- ** Cổng không được khởi động.** Không có gì được mở ra. ** Đây không phải trò chơi có thể chơi.**

## 6. Tăng dần

**Hãy sản xuất ra bốn bước rõ ràng**, bây giờ hình dạng của chúng đã được biết đến:

1. `CriticalSection::lock()` on the heap-tree lock (offset `0xe98bd8`)
2. `Arena::initialize(size)` (offset `0xeb9f1c`)
3. root heap already creatable via the **no-parent `tryCreate`** (proven last round)
4. `setCurrentHeap_` — and if it still faults, `unlock` first and retry

** Hai trong bốn bước đã được biết đến để làm việc.** Thông tin mới là chuỗi bắt đầu với một
**lock**, chứ không phải định vị — và ổ khóa là hợp pháp để tạo ra với một đống vô giá trị.
