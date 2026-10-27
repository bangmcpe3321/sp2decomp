# `nnMain` IS REACHED — the game's own framework initialisation is running

** Mục tiêu chính của mục tiêu đã được hoàn thành.** Với lỗi bộ sửa chữa kép cố định, cổng ngay bây giờ đi vào
`nnMain`, runs the game's own `SysInit`, and reaches `sead::GameFrameworkNx::initialize` — where it faults.

---

## Một, bằng chứng.

**`entering nnMain` appears in the run log** (line 55), and the fault backtrace is entirely inside the game's
Chạy khung riêng:

```
#0  0x00E7CF7C  sead::HeapMgr::getCurrentHeap()                      ← FAULT
#1  0x00E7678C  sead::ExpHeap::tryCreate(size, SafeStringBase<char> const&, Heap*, int, HeapDirection, bool)
#2  0x00E76784  (same function, entry)
#3  0x00E698AC  sead::Framework::initialize(Framework::InitializeArg const&)
#4  0x00E69FE4  sead::GameFramework::initialize(Framework::InitializeArg const&)
#5  0x00E6724C  sead::GameFrameworkNx::initialize(Framework::InitializeArg const&)
#6  0x011F5B20  Lp::Sys::SysInit::Init()                            ← the GAME's own sysinit
#7  0x0019A3E0  nnMain                                              ← ★ nnMain REACHED ★
#8  nx::call
#9  nx::nn_main
```

** Mỗi khung là một chức năng thực, được gọi là động cơ.** Đây không còn là giàn giáo kích hoạt trạng thái tĩnh — cái này
Đây là khuôn khổ trò chơi của Splatoon 2 sắp tới.

## Điều này chứng minh gì?

|Xác nhận|Trạng thái|
|---|---|
| `main`'s `_init` completed | ✅ **yes — `nnMain` was entered after it** |
| **`nnMain` reached** | ✅ **YES — `entering nnMain` logged, and frame #7 is `nnMain`** |
|Bộ mã riêng của trò chơi| ✅ `Lp::Sys::SysInit::Init` is the game's sysinit |
| `sead` engine initialisation runs | ✅ **`GameFrameworkNx` → `GameFramework` → `Framework`** |
|Sửa chữa bộ đệm kép là đúng|Đó là những gì đã làm sáng tỏ tất cả những chuyện này.|

**This is the goal's primary target: "get the boot past main's static constructors and into `nnMain`."**

## 3. Thuốc chặn mới — và chính xác

**`sead::HeapMgr::getCurrentHeap()` is what faults.** `sead::ExpHeap::tryCreate` asks the heap manager for
the current heap (to use as the parent), and the manager has **none** — so the dereference at `+0x88` reads
thông qua một số vô giá trị.

**In other words: `sead::HeapMgr` was never given a root heap.** The game's own engine heap manager is
uninitialised when `Framework::initialize` asks it for a heap to allocate from.

**That is a single, well-defined missing step**, not a mystery. On hardware something initialises `HeapMgr`
with a root heap before `Framework::initialize` runs. Candidates:

1. **`sead::HeapMgr::initialize()` is called by code the port skips** — possibly part of the SDK startup we
   bypass by entering at `nnosInitialize` → `nnMain`.
2. **It is called by the game but silently failed** — e.g. its own `new` returned null because
   `nn::init::InitializeAllocator` state differs from hardware.

## Điều gì đã thay đổi để đến được đây?

One condition in `init_module`: the `init_array` loop is now gated behind `NX_DOUBLE_CTOR`, because **`_init`
Đã chạy bảng xây dựng.** Trước đó, mỗi nhà xây dựng chạy hai lần, danh sách PGV tự liên kết, và
the boot died at constructor #1367 without ever approaching `nnMain`.

## 5 Điều này không xác minh

- **The game does not boot.** It faults during `GameFrameworkNx::initialize`.
- **`sead::HeapMgr`'s initialisation path was not located.** Nobody has yet found which function is supposed to
  Đặt một đống rễ, hoặc tại sao không.
- **`main`'s per-constructor logs are zero** — because `_init` runs them internally and the port no longer logs
  each entry. **That the 1,604 constructors all ran is inferred from `nnMain` being reached, not observed.**
- **`NX_DOUBLE_CTOR` was never exercised** — the old path was not re-tested after this change.
- **The allocator is still 512 MB at `kHeapBase`, an arbitrary size**, now installed via the real
  `svcSetHeapSize` path.
- ** Không có NVN, không có cửa sổ, không có bóng râm, không có trình bày.** Không có gì được vẽ, và đèn pha vẫn nằm ngoài phạm vi.
- **This is not a playable game and not a booted game.** It is a process that reaches `nnMain` and faults in
  Người quản lý hàng đống máy.

## 6. Tăng dần

**Find `sead::HeapMgr::initialize` / `setCurrentHeap` in the symbol table, and determine whether it was
Gọi là.** Vậy thì kiểm tra xem ai nên gọi nó -- nếu câu trả lời là "Sự khởi động SDK", cảng cần phải gọi nó bằng một
root `sead::ExpHeap` created over the game heap before `nnMain`, exactly as the real startup would.

Bây giờ đây là một vấn đề **targeed** với một chức năng được đặt tên, một tên bang mất tích, và một tập nhỏ của
Các ứng viên — một vị trí rất khác biệt so với khởi đầu của việc này.
