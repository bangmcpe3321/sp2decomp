# Tham chiếu thực hiện nền tảng

Theo dõi các hợp đồng cho các chức năng 51 nền tảng trong
[PORT_WORKLST.md] (PORT_WORKLST.md, lấy từ hệ nhị phân bị ngắt quãng hơn
hơn là từ một cái đầu.

**Why this matters:** `open-ead/nnsdk` ships no `include/nn/os/` headers, so
`nn::os` signatures are documented nowhere public. These signatures are read
ra khỏi mã vận chuyển, làm cho họ có thẩm quyền hợp đồng.

Source: `platform-decompiled.txt` (Ghidra 12.1.2 via REA provider).
Hàm: 51.

---

## Phase 1: `nn::os` — 24 functions

### `nn::os::AllocateMemoryBlock`

- **Address**: `0x7101413ec8`
- **Body kích cỡ**: 13 byte
- **Role**: Allococator
- ** Boot-cloable callers**: Lp:::Sys Init:::ninitStartup, ra biển: Arena::initize
- **Obristed chữ ký**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void nn::os::AllocateMemoryBlock(ulong *param_1,ulong param_2)
```

_Body: 1 mục tiêu cuộc gọi riêng biệt; chứa cảnh báo phân hủy; 7 dòng cơ thể _

### `nn::os::GetSystemTick`

- **Address**: `0x7101412298`
- **Body kích cỡ**: 13 byte
- **Role**: thời gian
- ** Boot-cloable callers**: Lp::Sys Init: Init, Lp:::::Framework, Lp:Sys::: Sys Init:print FromStartTime
- **Obristed chữ ký**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void nn::os::GetSystemTick(void)
```

_Body: 1 mục tiêu cuộc gọi riêng biệt; chứa cảnh báo phân hủy; 7 dòng cơ thể _

### `nn::os::QueryMemoryInfo`

- **Address**: `0x71014141e8`
- **Body kích cỡ**: 13 byte
- **Role**: truy vấn / kiểm soát
- ** Boot-cloest callers**: Lp::Sys Init::::ninitStartup, Lp:::Sys Init: Init, Lp::dumpMemory Info
- **Obristed chữ ký**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void nn::os::QueryMemoryInfo(MemoryInfo *param_1)
```

_Body: 1 mục tiêu cuộc gọi riêng biệt; chứa cảnh báo phân hủy; 7 dòng cơ thể _

### `nn::os::SetMemoryHeapSize`

- **Address**: `0x71014141f8`
- **Body kích cỡ**: 13 byte
- **Role**: Allococator
- ** Boot-cloable callers**: Lp:::Sys Init::ninitStartup
- **Obristed chữ ký**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void nn::os::SetMemoryHeapSize(ulong param_1)
```

_Body: 1 mục tiêu cuộc gọi riêng biệt; chứa cảnh báo phân hủy; 7 dòng cơ thể _

### `nn::os::ConvertToTimeSpan`

- **Address**: `0x7101412c08`
- **Body kích cỡ**: 13 byte
- **Role**: thời gian
- ** Boot-cloable callers**: biển:: Tharead: ngủ
- **Obristed chữ ký**:

```c
void nn::os::ConvertToTimeSpan(void)
```

_Body: 1 mục tiêu cuộc gọi riêng biệt; 6 đường cơ thể

### `nn::os::GetThreadAvailableCoreMask`

- **Address**: `0x7101412d98`
- **Body kích cỡ**: 13 byte
- **Role**: truy vấn / kiểm soát
- ** Boot-cloable callers**: biển:: Thread::setAffinity, biển: Thread
- **Obristed chữ ký**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void nn::os::GetThreadAvailableCoreMask(void)
```

_Body: 1 mục tiêu cuộc gọi riêng biệt; chứa cảnh báo phân hủy; 7 dòng cơ thể _

### `nn::os::GetTlsValue`

- **Address**: `0x71014125e8`
- **Body kích cỡ**: 13 byte
- **Role**:
- ** Boot-clocall callers**: _ZNK4sehd7HeapMgr14get HeapEv, _ZNK4sead7 HeapMgr15 find ContainHePKv, biển:
- **Obristed chữ ký**:

```c
void nn::os::GetTlsValue(void)
```

_Body: 1 mục tiêu cuộc gọi riêng biệt; 6 đường cơ thể

### `nn::os::InitializeMutex`

- **Address**: `0x7101412b38`
- **Body kích cỡ**: 13 byte
- **Role**: bộ khởi động
- ** Boot-cloable callers**: biển::CrialSection
- **Obristed chữ ký**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void nn::os::InitializeMutex(MutexType *param_1,bool param_2,int param_3)
```

_Body: 1 mục tiêu cuộc gọi riêng biệt; chứa cảnh báo phân hủy; 7 dòng cơ thể _

### `nn::os::SetThreadCoreMask`

- **Address**: `0x7101412da8`
- **Body kích cỡ**: 13 byte
- **Role**: truy vấn / kiểm soát
- ** Boot-cloable callers**: biển:: Thread::setAffinity, biển: Thread
- **Obristed chữ ký**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void nn::os::SetThreadCoreMask(ThreadType *param_1,int param_2,ulong param_3)
```

_Body: 1 mục tiêu cuộc gọi riêng biệt; chứa cảnh báo phân hủy; 7 dòng cơ thể _

### `nn::os::SleepThread`

- **Address**: `0x7101412d48`
- **Body kích cỡ**: 13 byte
- **Role**: chỉ nguyên thủy
- ** Boot-cloable callers**: biển:: Tharead: ngủ
- **Obristed chữ ký**:

```c
void nn::os::SleepThread(void)
```

_Body: 1 mục tiêu cuộc gọi riêng biệt; 6 đường cơ thể

### `nn::os::CreateThread`

- **Address**: `0x7101412ce8`
- **Body kích cỡ**: 13 byte
- **Role**: bộ khởi động
- ** Boot-cloable callers**: biển: Thread
- **Obristed chữ ký**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void nn::os::CreateThread (ThreadType *param_1,_func_void_void_ptr *param_2,void *param_3,void *param_4, ulong param_5,int param_6)
```

_Body: 1 mục tiêu cuộc gọi riêng biệt; chứa cảnh báo phân hủy; 9 dòng cơ thể_BAR_

### `nn::os::InitializeSemaphore`

- **Address**: `0x7101413ee8`
- **Body kích cỡ**: 13 byte
- **Role**: bộ khởi động
- ** Boot-cloure callers**: biển::emaphore
- **Obristed chữ ký**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void nn::os::InitializeSemaphore(SemaphoreType *param_1,int param_2,int param_3)
```

_Body: 1 mục tiêu cuộc gọi riêng biệt; chứa cảnh báo phân hủy; 7 dòng cơ thể _

### `nn::os::LockMutex`

- **Address**: `0x7101412b48`
- **Body kích cỡ**: 13 byte
- **Role**: khóa nguyên thủy
- ** Boot-cloable callers**: biển::CrialSection::lock
- **Obristed chữ ký**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void nn::os::LockMutex(MutexType *param_1)
```

_Body: 1 mục tiêu cuộc gọi riêng biệt; chứa cảnh báo phân hủy; 7 dòng cơ thể _

### `nn::os::SetThreadName`

- **Address**: `0x7101412cf8`
- **Body kích cỡ**: 13 byte
- **Role**: truy vấn / kiểm soát
- ** Boot-cloable callers**: biển: Thread
- **Obristed chữ ký**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void nn::os::SetThreadName(ThreadType *param_1,char *param_2)
```

_Body: 1 mục tiêu cuộc gọi riêng biệt; chứa cảnh báo phân hủy; 7 dòng cơ thể _

### `nn::os::UnlockMutex`

- **Address**: `0x7101412b68`
- **Body kích cỡ**: 13 byte
- **Role**: khóa nguyên thủy
- ** Boot-cloable callers**: biển::CorialSection::unlock
- **Obristed chữ ký**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void nn::os::UnlockMutex(MutexType *param_1)
```

_Body: 1 mục tiêu cuộc gọi riêng biệt; chứa cảnh báo phân hủy; 7 dòng cơ thể _

### `nn::os::InitializeMessageQueue`

- **Address**: `0x7101412c48`
- **Body kích cỡ**: 13 byte
- **Role**: bộ khởi động
- ** Boot-cloable callers**: biển::MessageQue::: allocate
- **Obristed chữ ký**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void nn::os::InitializeMessageQueue(MessageQueueType *param_1,ulong *param_2,ulong param_3)
```

_Body: 1 mục tiêu cuộc gọi riêng biệt; chứa cảnh báo phân hủy; 7 dòng cơ thể _

### `nn::os::AllocateTlsSlot`

- **Address**: `0x7101413df8`
- **Body kích cỡ**: 13 byte
- **Role**:
- ** Boot-cloure callers**: stold::
- **Obristed chữ ký**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void nn::os::AllocateTlsSlot(TlsSlot *param_1,_func_void_ulong *param_2)
```

_Body: 1 mục tiêu cuộc gọi riêng biệt; chứa cảnh báo phân hủy; 7 dòng cơ thể _

### `nn::os::ChangeThreadPriority`

- **Address**: `0x7101412d88`
- **Body kích cỡ**: 13 byte
- **Role**: truy vấn / kiểm soát
- ** Boot-cloable callers**: biển:: ReadMgr:initMain Thuread_:
- **Obristed chữ ký**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void nn::os::ChangeThreadPriority(ThreadType *param_1,int param_2)
```

_Body: 1 mục tiêu cuộc gọi riêng biệt; chứa cảnh báo phân hủy; 7 dòng cơ thể _

### `nn::os::GetCurrentCoreNumber`

- **Address**: `0x71014126b8`
- **Body kích cỡ**: 13 byte
- **Role**: truy vấn / kiểm soát
- ** Boot-cloable callers**: biển:: ReadMgr:initMain Thuread_:
- **Obristed chữ ký**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void nn::os::GetCurrentCoreNumber(void)
```

_Body: 1 mục tiêu cuộc gọi riêng biệt; chứa cảnh báo phân hủy; 7 dòng cơ thể _

### `nn::os::GetCurrentThread`

- **Address**: `0x7101412db8`
- **Body kích cỡ**: 13 byte
- **Role**: chỉ nguyên thủy
- ** Boot-cloable callers**: biển:: ReadMgr:initMain Thuread_:
- **Obristed chữ ký**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void nn::os::GetCurrentThread(void)
```

_Body: 1 mục tiêu cuộc gọi riêng biệt; chứa cảnh báo phân hủy; 7 dòng cơ thể _

### `nn::os::GetThreadId`

- **Address**: `0x7101413de8`
- **Body kích cỡ**: 13 byte
- **Role**: truy vấn / kiểm soát
- ** Boot-cloable callers**: biển:: ReadMgr:initMain Thuread_:
- **Obristed chữ ký**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void nn::os::GetThreadId(ThreadType *param_1)
```

_Body: 1 mục tiêu cuộc gọi riêng biệt; chứa cảnh báo phân hủy; 7 dòng cơ thể _

### `nn::os::SetTlsValue`

- **Address**: `0x7101412d08`
- **Body kích cỡ**: 13 byte
- **Role**:
- ** Boot-cloable callers**: biển:: ReadMgr:initMain Thuread_:
- **Obristed chữ ký**:

```c
void nn::os::SetTlsValue(void)
```

_Body: 1 mục tiêu cuộc gọi riêng biệt; 6 đường cơ thể

### `nn::os::GetCurrentStackInfo`

- **Address**: `0x7101412d28`
- **Body kích cỡ**: 13 byte
- **Role**: truy vấn / kiểm soát
- ** Boot-cloable callers**: biển: Thread
- **Obristed chữ ký**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void nn::os::GetCurrentStackInfo(ulong *param_1,ulong *param_2)
```

_Body: 1 mục tiêu cuộc gọi riêng biệt; chứa cảnh báo phân hủy; 7 dòng cơ thể _

### `nn::os::GetThreadPriority`

- **Address**: `0x7101412d18`
- **Body kích cỡ**: 13 byte
- **Role**: truy vấn / kiểm soát
- ** Boot-cloable callers**: biển: Thread
- **Obristed chữ ký**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void nn::os::GetThreadPriority(ThreadType *param_1)
```

_Body: 1 mục tiêu cuộc gọi riêng biệt; chứa cảnh báo phân hủy; 7 dòng cơ thể _

---

## Phase 4: `nn::vi` — 6 functions

### `nn::vi::CreateLayer`

- **Address**: `0x7101413d18`
- **Body kích cỡ**: 13 byte
- **Role**: bộ khởi động
- ** Boot-clocure calls**: stid::: gamesFrameworkNx::initiizeGracicSytem
- **Obristed chữ ký**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void nn::vi::CreateLayer(Layer **param_1,Display *param_2)
```

_Body: 1 mục tiêu cuộc gọi riêng biệt; chứa cảnh báo phân hủy; 7 dòng cơ thể _

### `nn::vi::GetDisplayVsyncEvent`

- **Address**: `0x7101413d38`
- **Body kích cỡ**: 13 byte
- **Role**: Hiển thị / giao diện video
- ** Boot-clocure calls**: stid::: gamesFrameworkNx::initiizeGracicSytem
- **Obristed chữ ký**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void nn::vi::GetDisplayVsyncEvent(SystemEventType *param_1,Display *param_2)
```

_Body: 1 mục tiêu cuộc gọi riêng biệt; chứa cảnh báo phân hủy; 7 dòng cơ thể _

### `nn::vi::GetNativeWindow`

- **Address**: `0x7101413d58`
- **Body kích cỡ**: 13 byte
- **Role**: Hiển thị / giao diện video
- ** Boot-clocure calls**: stid::: gamesFrameworkNx::initiizeGracicSytem
- **Obristed chữ ký**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void nn::vi::GetNativeWindow(void **param_1,Layer *param_2)
```

_Body: 1 mục tiêu cuộc gọi riêng biệt; chứa cảnh báo phân hủy; 7 dòng cơ thể _

### `nn::vi::Initialize`

- **Address**: `0x7101413cf8`
- **Body kích cỡ**: 13 byte
- **Role**: bộ khởi động
- ** Boot-clocure calls**: stid::: gamesFrameworkNx::initiizeGracicSytem
- **Obristed chữ ký**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void nn::vi::Initialize(void)
```

_Body: 1 mục tiêu cuộc gọi riêng biệt; chứa cảnh báo phân hủy; 7 dòng cơ thể _

### `nn::vi::OpenDefaultDisplay`

- **Address**: `0x7101413d08`
- **Body kích cỡ**: 13 byte
- **Role**: hệ thống tập tin / rmfs
- ** Boot-clocure calls**: stid::: gamesFrameworkNx::initiizeGracicSytem
- **Obristed chữ ký**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void nn::vi::OpenDefaultDisplay(Display **param_1)
```

_Body: 1 mục tiêu cuộc gọi riêng biệt; chứa cảnh báo phân hủy; 7 dòng cơ thể _

### `nn::vi::SetLayerScalingMode`

- **Address**: `0x7101413d28`
- **Body kích cỡ**: 13 byte
- **Role**: Hiển thị / giao diện video
- ** Boot-clocure calls**: stid::: gamesFrameworkNx::initiizeGracicSytem
- **Obristed chữ ký**:

```c
void nn::vi::SetLayerScalingMode(void)
```

_Body: 1 mục tiêu cuộc gọi riêng biệt; 6 đường cơ thể

---

## Phase 1: `nn::mem` — 5 functions

### `nn::mem::StandardAllocator`

- **Address**: `0x7101413038`
- **Body kích cỡ**: 13 byte
- **Role**: Allococator
- ** Boot-cloure callers**: nn::init:: khởi động Allocator
- **Obristed chữ ký**:

```c
void __thiscall nn::mem::StandardAllocator::StandardAllocator(StandardAllocator *this)
```

_Body: 1 mục tiêu cuộc gọi riêng biệt; 6 đường cơ thể

### `nn::mem::StandardAllocator`

- **Address**: `0x7101413cd8`
- **Body kích cỡ**: 13 byte
- **Role**: Allococator
- ** Boot-clocure calls**: stid::: gamesFrameworkNx::initiizeGracicSytem
- **Obristed chữ ký**:

```c
nn::mem::StandardAllocator::StandardAllocator(StandardAllocator *this,void *param_1,ulong param_2)
```

_Body: 1 mục tiêu cuộc gọi riêng biệt; 7 dòng cơ thể _

### `nn::mem::StandardAllocator::Initialize`

- **Address**: `0x7101413008`
- **Body kích cỡ**: 13 byte
- **Role**: bộ khởi động
- ** Boot-cloure callers**: nn::init:: khởi động Allocator
- **Obristed chữ ký**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void nn::mem::StandardAllocator::Initialize(void *param_1,ulong param_2)
```

_Body: 1 mục tiêu cuộc gọi riêng biệt; chứa cảnh báo phân hủy; 7 dòng cơ thể _

### `nn::mem::StandardAllocator::Allocate`

- **Address**: `0x7101412ee8`
- **Body kích cỡ**: 13 byte
- **Role**: Allococator
- ** Boot-cloable callers**: malloc
- **Obristed chữ ký**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void nn::mem::StandardAllocator::Allocate(ulong param_1)
```

_Body: 1 mục tiêu cuộc gọi riêng biệt; chứa cảnh báo phân hủy; 7 dòng cơ thể _

### `nn::mem::StandardAllocator::Free`

- **Address**: `0x7101412ef8`
- **Body kích cỡ**: 13 byte
- **Role**: Allococator
- ** Boot-cloable callers**: free
- **Obristed chữ ký**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void nn::mem::StandardAllocator::Free(void *param_1)
```

_Body: 1 mục tiêu cuộc gọi riêng biệt; chứa cảnh báo phân hủy; 7 dòng cơ thể _

---

## Phase 4: `nv / nvn` — 5 functions

### `nv::InitializeGraphics`

- **Address**: `0x7101413cc8`
- **Body kích cỡ**: 13 byte
- **Role**: bộ khởi động
- ** Boot-clocure calls**: stid::: gamesFrameworkNx::initiizeGracicSytem
- **Obristed chữ ký**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void nv::InitializeGraphics(void *param_1,ulong param_2)
```

_Body: 1 mục tiêu cuộc gọi riêng biệt; chứa cảnh báo phân hủy; 7 dòng cơ thể _

### `nv::SetGraphicsAllocator`

- **Address**: `0x7101413cb8`
- **Body kích cỡ**: 13 byte
- **Role**: Allococator
- ** Boot-clocure calls**: stid::: gamesFrameworkNx::initiizeGracicSytem
- **Obristed chữ ký**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void nv::SetGraphicsAllocator (_func_void_ptr_ulong_ulong_void_ptr *param_1,_func_void_void_ptr_void_ptr *param_2, _func_void_ptr_void_ptr_ulong_void_ptr *param_3,void *param_4)
```

_Body: 1 mục tiêu cuộc gọi riêng biệt; chứa cảnh báo phân hủy; 9 dòng cơ thể_BAR_

### `nv::SetGraphicsDevtoolsAllocator`

- **Address**: `0x7101413ce8`
- **Body kích cỡ**: 13 byte
- **Role**: Allococator
- ** Boot-clocure calls**: stid::: gamesFrameworkNx::initiizeGracicSytem
- **Obristed chữ ký**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void nv::SetGraphicsDevtoolsAllocator (_func_void_ptr_ulong_ulong_void_ptr *param_1,_func_void_void_ptr_void_ptr *param_2, _func_void_ptr_void_ptr_ulong_void_ptr *param_3,void *param_4)
```

_Body: 1 mục tiêu cuộc gọi riêng biệt; chứa cảnh báo phân hủy; 9 dòng cơ thể_BAR_

### `nvnBootstrapLoader`

- **Address**: `0x7101413d48`
- **Body kích cỡ**: 13 byte
- **Role**: NVN khởi động
- ** Boot-clocure calls**: stid::: gamesFrameworkNx::initiizeGracicSytem
- **Obristed chữ ký**:

```c
void nvnBootstrapLoader(void)
```

_Body: 1 mục tiêu cuộc gọi riêng biệt; 6 đường cơ thể

### `nvnLoadCProcs`

- **Address**: `0x7100ddd6e4`
- **Body kích cỡ**: 12712 byte
- **Role**: NVN khởi động
- ** Boot-clocure calls**: stid::: gamesFrameworkNx::initiizeGracicSytem
- **Obristed chữ ký**:

```c
void nvnLoadCProcs(undefined8 param_1,undefined *param_2)
```

_Body: 1 mục tiêu cuộc gọi riêng biệt; 913 dòng cơ thể _

---

## Phase 2: `nn::time` — 4 functions

### `nn::time::Initialize`

- **Address**: `0x7101413048`
- **Body kích cỡ**: 13 byte
- **Role**: bộ khởi động
- ** Boot-cloable callers**: biển::DateTime::set now
- **Obristed chữ ký**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void nn::time::Initialize(void)
```

_Body: 1 mục tiêu cuộc gọi riêng biệt; chứa cảnh báo phân hủy; 7 dòng cơ thể _

### `nn::time::IsInitialized`

- **Address**: `0x7101413e28`
- **Body kích cỡ**: 13 byte
- **Role**: truy vấn / kiểm soát
- ** Boot-cloable callers**: biển::DateTime::set now
- **Obristed chữ ký**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void nn::time::IsInitialized(void)
```

_Body: 1 mục tiêu cuộc gọi riêng biệt; chứa cảnh báo phân hủy; 7 dòng cơ thể _

### `nn::time::StandardUserSystemClock::GetCurrentTime`

- **Address**: `0x7101412eb8`
- **Body kích cỡ**: 13 byte
- **Role**: thời gian
- ** Boot-cloable callers**: biển::DateTime::set now
- **Obristed chữ ký**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void nn::time::StandardUserSystemClock::GetCurrentTime(PosixTime *param_1)
```

_Body: 1 mục tiêu cuộc gọi riêng biệt; chứa cảnh báo phân hủy; 7 dòng cơ thể _

### `nn::time::ToCalendarTime`

- **Address**: `0x7101412ec8`
- **Body kích cỡ**: 13 byte
- **Role**: thời gian
- ** Boot-cloable callers**: biển::DateTime::set now
- **Obristed chữ ký**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void nn::time::ToCalendarTime (CalendarTime *param_1,CalendarAdditionalInfo *param_2,PosixTime *param_3)
```

_Body: 1 mục tiêu cuộc gọi riêng biệt; chứa cảnh báo phân hủy; 8 dòng cơ thể_BAR_

---

## Phase 3: `nn::fs` — 2 functions

### `nn::fs::MountRom`

- **Address**: `0x7101413ca8`
- **Body kích cỡ**: 13 byte
- **Role**: hệ thống tập tin / rmfs
- ** Boot-cloable callers**: biển::FileDeviceMgr
- **Obristed chữ ký**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void nn::fs::MountRom(char *param_1,void *param_2,ulong param_3)
```

_Body: 1 mục tiêu cuộc gọi riêng biệt; chứa cảnh báo phân hủy; 7 dòng cơ thể _

### `nn::fs::QueryMountRomCacheSize`

- **Address**: `0x7101413c98`
- **Body kích cỡ**: 13 byte
- **Role**: hệ thống tập tin / rmfs
- ** Boot-cloable callers**: biển::FileDeviceMgr
- **Obristed chữ ký**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void nn::fs::QueryMountRomCacheSize(ulong *param_1)
```

_Body: 1 mục tiêu cuộc gọi riêng biệt; chứa cảnh báo phân hủy; 7 dòng cơ thể _

---

## Phase 1: `nn::init` — 1 function

### `nn::init::InitializeAllocator`

- **Address**: `0x7100dda018`
- **Body kích cỡ**: 80 byte
- **Role**: bộ khởi động
- ** Boot-cloable callers**: Lp:::Sys Init::ninitStartup
- **Obristed chữ ký**:

```c
void nn::init::InitializeAllocator(ulong param_1)
```

_Body: 3 mục tiêu cuộc gọi riêng biệt; 9 đường cơ thể

---

## Phase 2: `nn::nifm` — 1 function

### `nn::nifm::Initialize`

- **Address**: `0x7101413268`
- **Body kích cỡ**: 13 byte
- **Role**: bộ khởi động
- ** Boot-cloable callers**: Lp:::Sys Init: Init
- **Obristed chữ ký**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void nn::nifm::Initialize(void)
```

_Body: 1 mục tiêu cuộc gọi riêng biệt; chứa cảnh báo phân hủy; 7 dòng cơ thể _

---

## Phase 2: `nn::diag` — 1 function

### `nn::diag::detail::LogImpl`

- **Address**: `0x7101412708`
- **Body kích cỡ**: 13 byte
- **Role**: gỗ
- ** Boot-cloable callers**: Lp: Utl::dumpDateTime, Lp:: Utl::dumpMemory Info
- **Obristed chữ ký**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void nn::diag::detail::LogImpl(LogMetaData *param_1,char *param_2,...)
```

_Body: 1 mục tiêu cuộc gọi riêng biệt; chứa cảnh báo phân hủy; 7 dòng cơ thể _

---

## Phase 2: `nn::oe` — 1 function

### `nn::oe::Initialize`

- **Address**: `0x71014121c8`
- **Body kích cỡ**: 13 byte
- **Role**: bộ khởi động
- ** Boot-cloable callers**: biển::PerformanceMgrNx::initize
- **Obristed chữ ký**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void nn::oe::Initialize(void)
```

_Body: 1 mục tiêu cuộc gọi riêng biệt; chứa cảnh báo phân hủy; 7 dòng cơ thể _

---

## Phase 2: `nn::util` — 1 function

### `nn::util::VSNPrintf`

- **Address**: `0x7101412a78`
- **Body kích cỡ**: 13 byte
- **Role**: gỗ
- ** Boot-cloable callers**: stringUtil::vsnprintf
- **Obristed chữ ký**:

```c
void nn::util::VSNPrintf(void)
```

_Body: 1 mục tiêu cuộc gọi riêng biệt; 6 đường cơ thể

---

## Ghi chú

### Hãy cẩn thận đọc chữ ký

**Những chức năng này là 13- byte
Nhập khẩu stubs mà về phía trước thông qua một con trỏ, và chu vi chính nó tuyên bố không
parameters. Ghidra therefore renders many of them as `f(void)` — for example
`void nn::os::GetTlsValue(void)` — even though the real SDK function takes
lập luận.

**ABI thật sự ở trong kiểu con trỏ, không phải gốc.** Một con bọ trông giống như:

```c
void nn::os::GetSystemTick(void)
{
  (*(code *)PTR_GetSystemTick_7102f9a700)();
}
```

The actual parameter list belongs to `PTR_GetSystemTick_*`. To recover a true
Chữ ký, đọc thông báo của con trỏ tại địa chỉ đó trong phân tích, hoặc
Thanh tra một trang ** call site** trong một chức năng người gọi, nơi các đối số thực sự là
passed. `PORT_WORKLIST.md` lists those callers for every entry.

Chữ ký được vẽ với các tham số tên — chẳng hạn
`nn::init::InitializeAllocator(ulong param_1)` or
`nn::mem::StandardAllocator::StandardAllocator(StandardAllocator *this)` — came
từ những chức năng có cơ thể thật và đáng tin cậy.

### Những hang động khác

- Ký hiệu được quản lý** từ cơ thể bị hủy bỏ, không được tuyên bố trong một
  Đầu trang. Naming có thể khác với bản tuyên bố gốc SDK; ABI nên
  Không.
- Toàn bộ mã giả cho mỗi hàm được tái sử dụng với
  `tools/ghidra/ExtractDecompiled.py`; it is not committed here.
- Hàm đánh dấu **Platform dịch vụ ( Ứng cử viên)** cần phải được stuct
  thay vì thực hiện cho dấu hiệu khởi động ngoại tuyến.
- **The platform layer is not implemented in `main`.** These 51 are imports; the
  real implementations live in the `sdk` module (confirmed present there for
  `nn::os` and `nn::mem::StandardAllocator`). See the finding in
  [DECOMPILED_BODIES.md](DECOMPILED_BODIES.md) and analyse `sdk` before writing
  Tất cả những thứ này từ đầu.
