# Scoping `GameFramework`: is step 5 a wall or a tree?

`sead::GameFrameworkNx::initialize` (`0x7100e6724c`) is the next unported boot-root
dependency, and `ENGINE_RECONSTRUCTION.md` flagged it as a step change in difficulty
bởi vì cơ thể của nó chỉ tua lại:

```c
void sead::GameFrameworkNx::initialize(InitializeArg const& arg) {
    GameFramework::initialize(arg);      // 0x7100e69fe4, 456 bytes
    PerformanceMgrNx::initialize();      // 0x7100e68c44
}
```

Tài liệu này trả lời cho việc mở một bức tường hay một cái cây có thể điều khiển được. **Nó là một cái cây, và
một cái cạn** — nhưng nó là một cái cây, không phải một chức năng duy nhất, và sự phân biệt đó là
Tìm kiếm hữu ích.

---

## 1. `GameFramework::initialize` — 456 bytes, 6 specific calls

Được tái tạo một cách trung thực, cơ thể là **heap và quản lý hệ thống**:

```c
void sead::GameFramework::initialize(const InitializeArg& arg) {
    Framework::initialize(arg);                                  // 0x7100e698ac

    Heap* root = <first root heap from PTR_sRootHeaps>;
    size_t sz = root->getFreeSize(root, 8);                      // vtable +0x80

    Heap* sys = ExpHeap::create(sz, {"sead::SystemManagers"}, root, 8, 1, 0);
    sz = sys->getFreeSize(sys, 8);
    Heap* res = ExpHeap::create(sz, {"sead::ResourceMgr"}, sys, 8, 1, 0);
    if (res) prev = HeapMgr::setCurrentHeap_(PTR_sInstancePtr, res);
    ResourceMgr::createInstance(res);
    res->destroy(res);                                           // vtable +0x28
    if (prev != 1) HeapMgr::setCurrentHeap_(PTR_sInstancePtr, prev);

    sz = sys->getFreeSize(sys, 8);
    Heap* fdev = ExpHeap::create(sz, {"sead::FileDeviceMgr"}, sys, 8, 1, 0);
    if (fdev) prev2 = HeapMgr::setCurrentHeap_(PTR_sInstancePtr, fdev);
    FileDeviceMgr::createInstance(fdev);
    fdev->destroy(fdev);
    if (prev2 != 1) HeapMgr::setCurrentHeap_(PTR_sInstancePtr, prev2);
    ...
}
```

**The pattern repeats.** Each system manager gets its own `ExpHeap`, is installed as the
current heap, has `createInstance` called, and the previous heap is restored — with
`SystemManagers`, `ResourceMgr` and `FileDeviceMgr` visible in the first 456 bytes and the
`...` indicating more of the same.

|Metric|Số lượng|
|---|---:|
|Các cuộc gọi trực tiếp bị cắt đứt| **6** |
|Name| **6** |
| Heap-virtual calls (`vptr + 0x80`) | **3** |

Vì vậy, bức tường không phải là 456 byte của logic duy nhất — nó là **1 mẫu áp dụng cho mỗi người quản lý**.

## 2. `Framework::initialize` — 200 bytes, also bounded

```c
void sead::Framework::initialize(const InitializeArg& arg) {
    if (arg.arena == nullptr) HeapMgr::initialize(arg.heap_size);   // +0x00 / +0x08
    else                      HeapMgr::initialize(arg.arena);

    Heap* root = <first root heap>;
    Heap* th = ExpHeap::create(0, {"sead::ThreadMgr"}, root, 8, 1, 0);
    ThreadMgr::createInstance(th);
    ThreadMgr::initialize(PTR_sInstance_7102f9d280, th);
    th->destroy(th);
    GlobalRandom::createInstance(root);
}
```

Note it reads **`arg.heap_size` and `arg.arena`** — the two fields of `InitializeArg`, which
is already ported (`port/src/framework_args.cpp`, 48 MB and null). That is the first place
Đối số bị cập nhật thực sự đã bị tiêu hủy.

## 3 cây phụ, với địa chỉ

|Hàm|Địa chỉ|Tình trạng|
|---|---|---|
| `sead::GameFrameworkNx::initialize` | `0x7100e6724c` |wrapper, 20B|
| `sead::GameFramework::initialize` | `0x7100e69fe4` |**456 B** — rễ cây|
| `sead::PerformanceMgrNx::initialize` | `0x7100e68c44` |Anh em, nhỏ|
| `sead::Framework::initialize` | `0x7100e698ac` |**200 B**|
| `sead::HeapMgr::initialize` | — |Chưa giải quyết|
| `sead::HeapMgr::setCurrentHeap_` | `0x7100e7cfc0` | |
| `sead::ExpHeap::create` |chưa giải quyết|tham khảo, cần phải xem xét lại|
| `sead::ThreadMgr::createInstance` / `initialize` | — |Chưa giải quyết|
| `sead::GlobalRandom::createInstance` | — |Chưa giải quyết|
| `sead::ResourceMgr::createInstance` | `0x7100e8f150` | |
| `sead::FileDeviceMgr::createInstance` | `0x7100e64760` | |

**Depth is 3–4** (`GameFrameworkNx` → `GameFramework` → `Framework` → `HeapMgr`), and each
Cấp chỉ đạt đến một số ít chức năng.

## 4. Điều này thay đổi gì trong kế hoạch

**Sự thay đổi bước là thật nhưng ràng buộc.** Nó không phải là một chức năng và nó không phải là một hệ thống con
có kích cỡ không rõ — nó là một cây **hallow của những nhà máy xây dựng nhỏ và nhà máy quản lý**
đằng sau một mô hình lặp đi lặp lại.

Đó là hiệu lực ghi âm nó như là một bước thay đổi thay vì một bức tường, và nó thay đổi cổng
order: **`Framework::initialize` (`0x7100e698ac`, 200 bytes) is the tractable next port**,
not `GameFramework::initialize`. It is smaller, its callees are named, and it consumes the
already-ported `InitializeArg`.

## Điều gì sẽ khiến chuyện này trở nên tồi tệ?

- **`ExpHeap` has no resolved address.** `Heap::CreateArg`, the root-heap globals and the
  heap vtable (`+0x80` free-size, `+0x28` destroy) all need establishing. The heap layer is
  Cả cái cây này đang đứng trên đó, và nó không hề bị giám sát.
- **6 địa điểm gửi gián tiếp.** Giống như 10 trong gốc khởi động, mục tiêu của họ không phải là
  Vẫn có thể giải quyết được, vì vậy một số phụ thuộc thực sự được đặt ở đây là vô hình.
- **`PTR_sRootHeaps` / `PTR_sInstance` are `.bss` globals** — no file bytes, the same
  limitation recorded for `sAssertEvent`, `MutexType` and the firmware's `sAssertEvent`.

**The heap layer is the genuine next unknown.** Before porting `Framework::initialize`, the
question worth answering is whether `HeapMgr`/`ExpHeap` is itself a shallow tree or the
first real wall — because every level of `GameFramework` depends on it.
