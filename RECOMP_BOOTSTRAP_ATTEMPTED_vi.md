# Cái bẫy động cơ, thực hiện và giả thuyết vô sinh làm giả mạo

The bootstrap was implemented as designed. **It runs, and `tryCreate` returns null.** That falsifies the
Giả định trung tâm đằng sau nó.

---

## 1, thứ được tạo ra

`bootstrap_engine_heap(CPU&)` in `main.cpp`, called after `main`'s constructors and before `nnMain`:

```cpp
// ExpHeap::tryCreate(void* buf, size_t size, SafeStringBase<char> const&, Heap* parent, bool)
//   _ZN4sead7ExpHeap9tryCreateEPvmRKNS_14SafeStringBaseIcEEPNS_4HeapEb   @ 0xe76c6c
// SafeStringBase<char> is { const char* stringTop; size_t length; }
c.x[0] = kHeapBase + 0x01000000;   // buf  (16 MB into the game heap)
c.x[1] = 0x0F000000;               // size (240 MB)
c.x[2] = &ssb;                     // SafeStringBase over a scratch page
c.x[3] = 0;                        // parent = nullptr   <- the intended circle-breaker
c.x[4] = 0;                        // bool
call(c, main.base + 0xe76c6c);
heap = c.x[0];
if (heap) { c.x[0] = heap; call(c, main.base + 0xe7cfc0); }  // HeapMgr::setCurrentHeap_
```

It also **removed** the unconditional `HeapMgr::initialize` diagnostic from the previous increment, so the
Cảng trở lại để đo lường tình trạng thật sự của nó thay vì một cái đã được định sẵn.

## Chuyện gì đã xảy ra?

```
bootstrap: ExpHeap::tryCreate(buf=5001000000, size=0xf000000, parent=null) at main+e76c6c
bootstrap: root heap = 0x0
bootstrap: tryCreate returned null -- root heap NOT created
entering nnMain
=== HOST SIGSEGV ===  fault 0x88
  guest lr : main+e767d0  sead::ExpHeap::tryCreate + 0x44
```

**The call executed cleanly and returned `0`.** No fault, no crash — `tryCreate` **refused**.

That is a clean, informative result: **`ExpHeap::tryCreate` will not create a heap with a null parent.** It
returns null rather than faulting, which is exactly what a `try*` factory should do.

## Ba, cái đó giả dối cái gì?

Thiết kế bẫy khởi động dựa trên tuyên bố này:

> *creating the first `ExpHeap` with a null parent (which `HeapNullOption` exists precisely to permit)*

**That is now falsified for this call.** `IDisposer`'s `HeapNullOption` permits a null heap for *some*
constructors, but `ExpHeap::tryCreate` does not accept a null parent in the way the design assumed.

**So the circle does not break at `ExpHeap::tryCreate`.** It breaks somewhere else, or with a different
Bố mẹ.

## Điều này chứng minh gì?

|Mục|Tình trạng|
|---|---|
|Khởi động và kết nối vào| ✅ **yes, runs before `nnMain`** |
|Chẩn đoán bị gỡ bỏ|thể hiện tình trạng của hải cảng một lần nữa|
| `SafeStringBase<char>` as `{ptr, len}` accepted |♪ Không có tai nạn, cuộc gọi đã được thông qua ♪|
| `tryCreate(buf, size, name, nullptr, false)` |♪ Hãy quay lại và biến mất ♪|
|Giả định chất đống cha mẹ|[Tiếng bản xứ]|
|Chất nền được tạo|♪ **no**|
|Lỗi không thay đổi| ✅ still `ExpHeap::tryCreate +0x44`, `0x88` |

## 5 Điều này không xác minh

- **Why `tryCreate` returned null is not known.** Candidates: null parent rejected; the `SafeStringBase`
  layout I assumed is wrong; the `bool` argument means something other than assumed; alignment or size
  Từ chối.
- **`x[4] = 1` was not tried.** One bit, one experiment, untested.
- **`HeapMgr::initialize(Arena*)` (0xe7c6b8) was never called** — it is the other candidate entry point and
  vẫn không bị ảnh hưởng.
- **No other `Heap` subclass was considered** (a `UnitHeap`, or a non-`ExpHeap` root).
- ** Trò chơi không khởi động.** Không có gì được diễn ra. Không có NVN, không có cửa sổ, không có đèn pha.
- ** Đây không phải là một trò chơi có thể chơi được, và công việc này đã không thành công.**

## 6 chỗ nào để lại quyết định

Đây là lựa chọn được đề nghị 1 — ** Làm khởi động**. nó đã được thực hiện, trung thành và
Nỗ lực bê tông đầu tiên là **rejected bởi động cơ**.

Đó là kết quả trung thực: **the Shotrap không phải là một cuộc gọi đến một chữ ký đã biết; đó là một điều chưa biết
dãy mà phải được mã hóa từ sự khởi đầu của trò chơi.**

**Các con đường còn lại, không thay đổi hình dạng nhưng bây giờ với bằng chứng đằng sau chúng:**

1. **Find and read Splatoon 2's actual start-up function** — the code that on hardware runs before `nnMain`
   và thực hiện chuỗi này. **Đây là con đường duy nhất không đoán được.** Nó chưa bao giờ được định vị.
2. ** Cổng ra một tiêu đề mà thời gian chạy đã biểu diễn.**
3. ** Dừng lại, và giữ lại tài liệu.**

**Option 1 rõ ràng là cổ chai**: mọi nỗ lực để "tách" cái bẫy đã bị từ chối bởi
Động cơ là những gì bạn mong đợi, trình tự là có thể khám phá, nhưng bằng cách đọc phần khởi động của trò chơi, không phải
Bằng cách cố gắng chữ ký.

## 7 Những gì kho chứa

- A fully-named chain from `nnMain` to a circular heap dependency.
- **Six** documented Wonder-vs-Splatoon-2 silent mismatches (`g_fast`, module stride, `kDtInit`,
  `init_status`, allocator, `nnos` entry contract).
- Two toolchain traps: **`exefs` is LZ4** (never do offset math on it) and **`call_preserving` hooks miss
  Các cuộc gọi trực tiếp được nối lại.
- Công thức làm việc mà sản xuất mọi kết quả: điểm quan sát trên một trường struct, điểm cắt giảm điểm,
  và kỹ thuật giải quyết vấn đề.
- A working 140 MB recompiled binary that reaches `nnMain` and runs the game's own framework start-up.
