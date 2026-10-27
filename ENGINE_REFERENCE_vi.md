# Tài liệu tham chiếu của động cơ khởi động

Quan sát các dấu hiệu và vai trò cho các chức năng của động cơ **sead / Lp / nn *
Đường dẫn khởi động phụ thuộc vào, lấy từ những xác chết bị phân hủy thay vì tuyên bố.

Bạn bè để [PLATORM_REFECE.md] (PLATORM_REFECE.md), bao gồm các
Có 51 chức năng, cùng nhau ghi chú toàn bộ
Kết thúc bằng mật mã thật.

Nguồn tài liệu: Ghidra 12.1.2 qua A. Hàm: 126.

---

## Độ sâu 0–1 — con đường quan trọng (31 chức năng)

### `sead::BufferedSafeStringBase`

- **Address**: `0x7100e851d0`  ·  **depth 1**
- **Body kích cỡ**: 300 byte
- **Role**: dây quản lý
- **Obristed chữ ký**:

```c
} while (lVar1 < 0x80000);
```

_2 mục tiêu cuộc gọi riêng biệt; 4 địa điểm gọi gián tiếp; 68 dòng cơ thể _

### `_ZNK4sead22BufferedSafeStringBaseIcE22assureTerminationImpl_Ev`

- **Address**: `0x7100e84ccc`  ·  **depth 1**
- **Body kích cỡ**: 20 byte
- **Role**: dây quản lý
- **Obristed chữ ký**:

```c
sead::BufferedSafeStringBase<char>::assureTerminationImpl_() const void __thiscall sead::BufferedSafeStringBase<char>::assureTerminationImpl_(BufferedSafeStringBase<char> *this)
```

_1 mục tiêu cuộc gọi riêng biệt; 1 địa điểm gọi gián tiếp; 8 dòng cơ thể

### `sead::ExpHeap::create`

- **Address**: `0x7100e76784`  ·  **depth 1**
- **Body kích cỡ**: 8 byte
- **Role**: dàn xếp đống
- **Obristed chữ ký**:

```c
tryCreate(param_1,param_2,param_3,param_4,param_5,param_6 & 1);
```

_2 mục tiêu cuộc gọi riêng biệt; 9 đường cơ thể

### `Lp::Sys::HeapGroup::createHeap`

- **Address**: `0x71011f5130`  ·  **depth 1**
- **Body kích cỡ**: 508 byte
- **Role**: dàn xếp đống
- **Obristed chữ ký**:

```c
WARNING: Removing unreachable block (ram,0x0071011f5294) /* WARNING: Removing unreachable block (ram,0x0071011f5204) */ /* WARNING: Removing unreachable block (ram,0x0071011f51c0) */ /* WARNING: Removing unreachable block (ram,0x0071011f524c) */ /* WARNING: Removing unreachable block (ram,0x0071011f
```

_4 mục tiêu cuộc gọi riêng biệt; cảnh báo phân hủy hiện tại; 55 dòng cơ thể

### `Lp::Sys::HeapGroup::createInstance`

- **Address**: `0x71011f4ffc`  ·  **depth 1**
- **Body kích cỡ**: 160 byte
- **Role**: dàn xếp đống
- **Obristed chữ ký**:

```c
undefined8 * Lp::Sys::HeapGroup::createInstance(Heap *param_1)
```

_5 mục tiêu cuộc gọi riêng biệt; 25 đường cơ thể

### `Lp::Sys::RootTask::createParallelInitThread`

- **Address**: `0x71011fcadc`  ·  **depth 0**
- **Body kích cỡ**: 104 byte
- **Role**: song song- nit dàn nhạc
- **Obristed chữ ký**:

```c
Lp::Sys::RootTask::createParallelInitThread() void __thiscall Lp::Sys::RootTask::createParallelInitThread(RootTask *this)
```

_2 mục tiêu cuộc gọi riêng biệt; 1 địa điểm gọi gián tiếp; 16 dòng cơ thể

### `Lp::Sys::WorkerThreadMgr::createWorker`

- **Address**: `0x710123d4a0`  ·  **depth 1**
- **Body kích cỡ**: 136 byte
- **Role**: công việc- dịch chuyển
- **Obristed chữ ký**:

```c
Lp::Sys::WorkerThreadMgr::createWorker(WorkerThreadMgr *this,Sys *param_1,undefined8 param_2)
```

_3 mục tiêu cuộc gọi riêng biệt; 19 đường cơ thể

### `Lp::Utl::dumpDateTime`

- **Address**: `0x71012cdbf4`  ·  **depth 1**
- **Body kích cỡ**: 216 byte
- **Role**: thời gian
- **Obristed chữ ký**:

```c
void Lp::Utl::dumpDateTime(undefined8 param_1)
```

_6 mục tiêu cuộc gọi riêng biệt; 40 đường cơ thể

### `Lp::Utl::dumpMemoryInfo`

- **Address**: `0x71012cdccc`  ·  **depth 1**
- **Body kích cỡ**: 408 byte
- **Role**: chẩn đoán / định dạng
- **Obristed chữ ký**:

```c
void Lp::Utl::dumpMemoryInfo(undefined8 param_1)
```

_3 mục tiêu cuộc gọi riêng biệt; 84 đường cơ thể

### `Lp::Sys::WorkerThreadMgr::enqueue`

- **Address**: `0x710123d1a8`  ·  **depth 1**
- **Body kích cỡ**: 88 byte
- **Role**: công việc- dịch chuyển
- **Obristed chữ ký**:

```c
Lp::Sys::WorkerThreadMgr::enqueue(WorkerThreadMgr *this,uint *param_1,long param_2,uint param_3)
```

_2 mục tiêu cuộc gọi riêng biệt; 26 đường cơ thể

### `sead::FormatFixedSafeString`

- **Address**: `0x710000dbec`  ·  **depth 1**
- **Body kích cỡ**: 224 byte
- **Role**: chẩn đoán / định dạng
- **Obristed chữ ký**:

```c
BufferedSafeStringBase<char>::assureTerminationImpl_(param_1);
```

_3 mục tiêu cuộc gọi riêng biệt; 37 đường cơ thể

### `Lp::Sys::Framework`

- **Address**: `0x71011f44e4`  ·  **depth 1**
- **Body kích cỡ**: 108 byte
- **Role**:
- **Obristed chữ ký**:

```c
Lp::Sys::Framework::Framework(sead::GameFrameworkNx::CreateArg&) void __thiscall Lp::Sys::Framework::Framework(Framework *this,void *param_1)
```

_3 mục tiêu cuộc gọi riêng biệt; 22 đường cơ thể

### `Lp::Sys::getCpCallbackSeadAssert`

- **Address**: `0x71011f3774`  ·  **depth 1**
- **Body kích cỡ**: 12 byte
- **Role**: chẩn đoán / định dạng
- **Obristed chữ ký**:

```c
Lp::Sys::getCpCallbackSeadAssert() undefined8 * Lp::Sys::getCpCallbackSeadAssert(void)
```

_1 mục tiêu cuộc gọi riêng biệt; 6 đường cơ thể

### `Lp::Sys::SysInit::Init`

- **Address**: `0x71011f5b20`  ·  **depth 0**
- **Body kích cỡ**: 1308 byte
- **Role**: mục nhập khởi động / bộ nhớ
- **Obristed chữ ký**:

```c
WARNING: Removing unreachable block (ram,0x0071011f5fac) /* WARNING: Removing unreachable block (ram,0x0071011f5cb4) */ /* WARNING: Removing unreachable block (ram,0x0071011f5d8c) */ /* WARNING: Removing unreachable block (ram,0x0071011f6004) */ /* Lp::Sys::SysInit::Init() */ void Lp::Sys::SysInit::
```

_32 mục tiêu cuộc gọi riêng biệt; 10 điểm gọi gián tiếp; cảnh báo phân hủy hiện tại; 177 dòng cơ thể_

### `sead::GameFrameworkNx::initialize`

- **Address**: `0x7100e6724c`  ·  **depth 1**
- **Body kích cỡ**: 20 byte
- **Role**:
- **Obristed chữ ký**:

```c
sead::GameFrameworkNx::initialize(sead::Framework::InitializeArg const&) void sead::GameFrameworkNx::initialize(long *param_1)
```

_3 mục tiêu cuộc gọi riêng biệt; 8 đường cơ thể

### `sead::ForegroundBucketMgr::initialize`

- **Address**: `0x710139fb3c`  ·  **depth 1**
- **Body kích cỡ**: 4 byte
- **Role**: đồ họa
- **Obristed chữ ký**:

```c
void sead::ForegroundBucketMgr::initialize(void)
```

_1 mục tiêu cuộc gọi riêng biệt; 6 đường cơ thể

### `sead::Framework::InitializeArg`

- **Address**: `0x7100e69894`  ·  **depth 1**
- **Body kích cỡ**: 12 byte
- **Role**:
- **Obristed chữ ký**:

```c
sead::Framework::InitializeArg::InitializeArg() void __thiscall sead::Framework::InitializeArg::InitializeArg(InitializeArg *this)
```

_1 mục tiêu cuộc gọi riêng biệt; 8 đường cơ thể

### `sead::GameFrameworkNx::initializeGraphicsSystem`

- **Address**: `0x7100e6738c`  ·  **depth 1**
- **Body kích cỡ**: 2372 byte
- **Role**: đem đồ họa lên
- **Obristed chữ ký**:

```c
nv::InitializeGraphics(pvVar11,(ulong)*(uint *)(this + 0xcc));
```

_35 mục tiêu cuộc gọi riêng biệt; 27 địa điểm cuộc gọi gián tiếp; 250 đường cơ thể

### `sead::TaskBase::MgrTaskArg`

- **Address**: `0x7100e6b7bc`  ·  **depth 1**
- **Body kích cỡ**: 308 byte
- **Role**:
- **Obristed chữ ký**:

```c
sead::TaskBase::MgrTaskArg::MgrTaskArg(sead::TaskClassID const&) void __thiscall sead::TaskBase::MgrTaskArg::MgrTaskArg(MgrTaskArg *this,undefined8 *param_1)
```

_1 mục tiêu cuộc gọi riêng biệt; 87 đường cơ thể _

### `Lp::Sys::SysInit::nninitStartup`

- **Address**: `0x71011f5ab4`  ·  **depth 0**
- **Body kích cỡ**: 108 byte
- **Role**: mục nhập khởi động / bộ nhớ
- **Obristed chữ ký**:

```c
Lp::Sys::SysInit::nninitStartup() void Lp::Sys::SysInit::nninitStartup(void)
```

_5 mục tiêu cuộc gọi riêng biệt; 16 đường cơ thể

### `_ZdaPv`

- **Address**: `0x7100e565b0`  ·  **depth 1**
- **Body kích cỡ**: 100 byte
- **Role**:
- **Obristed chữ ký**:

```c
void operator_delete__(void *param_1)
```

_3 mục tiêu cuộc gọi riêng biệt; 1 trong vòng gọi gián tiếp nơi Mạng; decomiler cảnh báo có mặt; 19 dòng cơ thể_

### `_ZnwmPN4sead4HeapEi`

- **Address**: `0x7100e5629c`  ·  **depth 1**
- **Body kích cỡ**: 116 byte
- **Role**:
- **Obristed chữ ký**:

```c
void * operator_new(size_t param_1,long *param_2,undefined4 param_3)
```

_4 mục tiêu cuộc gọi riêng biệt; 1 trong vòng gọi gián tiếp nơi Mạng; decomiler cảnh báo hiện tại; 19 dòng cơ thể_

### `_ZnamPN4sead4HeapEi`

- **Address**: `0x7100e56310`  ·  **depth 1**
- **Body kích cỡ**: 116 byte
- **Role**:
- **Obristed chữ ký**:

```c
void * operator_new__(size_t param_1,long *param_2,undefined4 param_3)
```

_3 mục tiêu cuộc gọi riêng biệt; 1 trong vòng gọi gián tiếp nơi Mạng; decomiler cảnh báo có mặt; 19 dòng cơ thể_

### `Lp::Sys::RootTask::parallelInitThreadFunc`

- **Address**: `0x71011fca28`  ·  **depth 0**
- **Body kích cỡ**: 180 byte
- **Role**: song song- nit dàn nhạc
- **Obristed chữ ký**:

```c
Lp::Sys::RootTask::parallelInitThreadFunc(int) int __thiscall Lp::Sys::RootTask::parallelInitThreadFunc (undefined8 param_1_00,uint param_2,undefined8 param_3,undefined8 param_4, undefined8 param_5,undefined8 param_6,undefined8 param_7,undefined8 param_8)
```

_4 mục tiêu cuộc gọi riêng biệt; 3 địa điểm gọi gián tiếp; 29 dòng cơ thể

### `Lp::Sys::SysInit::printFromStartTime`

- **Address**: `0x71011f603c`  ·  **depth 1**
- **Body kích cỡ**: 424 byte
- **Role**:
- **Obristed chữ ký**:

```c
Lp::Sys::SysInit::printFromStartTime(sead::SafeStringBase<char> const&) int Lp::Sys::SysInit::printFromStartTime(void)
```

_8 mục tiêu cuộc gọi riêng biệt; 59 đường cơ thể

### `sead::AssertConfig::registerCallback`

- **Address**: `0x7101397fac`  ·  **depth 1**
- **Body kích cỡ**: 160 byte
- **Role**: chẩn đoán / định dạng
- **Obristed chữ ký**:

```c
void sead::AssertConfig::registerCallback(long param_1)
```

_3 mục tiêu cuộc gọi riêng biệt; 1 địa điểm gọi gián tiếp; 30 dòng cơ thể

### `Lp::Sys::WorkerThreadMgr::run`

- **Address**: `0x710123d8c0`  ·  **depth 1**
- **Body kích cỡ**: 72 byte
- **Role**: công việc- dịch chuyển
- **Obristed chữ ký**:

```c
Lp::Sys::WorkerThreadMgr::run(int, bool) undefined8 Lp::Sys::WorkerThreadMgr::run(long param_1,uint param_2)
```

_2 mục tiêu cuộc gọi riêng biệt; 1 địa điểm gọi gián tiếp; 21 dòng cơ thể

### `sead::Framework::RunArg`

- **Address**: `0x7100e698a0`  ·  **depth 1**
- **Body kích cỡ**: 12 byte
- **Role**:
- **Obristed chữ ký**:

```c
sead::Framework::RunArg::RunArg() void __thiscall sead::Framework::RunArg::RunArg(RunArg *this)
```

_1 mục tiêu cuộc gọi riêng biệt; 7 đường cơ thể _

### `Lp::Sys::RootTask::runParallelInitThread`

- **Address**: `0x71011fcb44`  ·  **depth 0**
- **Body kích cỡ**: 96 byte
- **Role**: song song- nit dàn nhạc
- **Obristed chữ ký**:

```c
Lp::Sys::RootTask::runParallelInitThread(int) void __thiscall Lp::Sys::RootTask::runParallelInitThread(RootTask *this,undefined4 param_1)
```

_3 mục tiêu cuộc gọi riêng biệt; 2 địa điểm gọi gián tiếp; 17 dòng cơ thể

### `Lp::Utl::sleepCurThreadMilliSec`

- **Address**: `0x71012cdf50`  ·  **depth 1**
- **Body kích cỡ**: 48 byte
- **Role**:
- **Obristed chữ ký**:

```c
Lp::Utl::sleepCurThreadMilliSec(long) void Lp::Utl::sleepCurThreadMilliSec(void)
```

_2 mục tiêu cuộc gọi riêng biệt; 9 đường cơ thể

### `Lp::Sys::RootTask::waitDoneParallelInitThread`

- **Address**: `0x71011fcba4`  ·  **depth 0**
- **Body kích cỡ**: 56 byte
- **Role**: song song- nit dàn nhạc
- **Obristed chữ ký**:

```c
Lp::Sys::RootTask::waitDoneParallelInitThread() void __thiscall Lp::Sys::RootTask::waitDoneParallelInitThread(RootTask *this)
```

_2 mục tiêu cuộc gọi riêng biệt; 12 đường cơ thể

---

## Độ sâu 2–3 — hỗ trợ tức thời (73 chức năng)

### `__cxa_guard_acquire`

- **Address**: `0x7101412248`  ·  **depth 2**
- **Body kích cỡ**: 13 byte
- **Role**:
- **Obristed chữ ký**:

```c
void __cxa_guard_acquire(void)
```

_1 mục tiêu cuộc gọi riêng biệt; 6 đường cơ thể

### `__cxa_guard_release`

- **Address**: `0x7101412258`  ·  **depth 2**
- **Body kích cỡ**: 13 byte
- **Role**:
- **Obristed chữ ký**:

```c
void __cxa_guard_release(void)
```

_1 mục tiêu cuộc gọi riêng biệt; 6 đường cơ thể

### `__errno_location`

- **Address**: `0x7101413468`  ·  **depth 3**
- **Body kích cỡ**: 13 byte
- **Role**:
- **Obristed chữ ký**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked int * __errno_location(void)
```

_1 mục tiêu cuộc gọi riêng biệt; cảnh báo phân hủy hiện tại; 8 dòng cơ thể

### `sead::Heap::appendDisposer_`

- **Address**: `0x7100e7b29c`  ·  **depth 3**
- **Body kích cỡ**: 120 byte
- **Role**:
- **Obristed chữ ký**:

```c
void __thiscall sead::Heap::appendDisposer_(Heap *this,long param_1)
```

_4 mục tiêu cuộc gọi riêng biệt; 1 địa điểm gọi gián tiếp; 20 dòng cơ thể

### `sead::DateUtil::calcWeekDay`

- **Address**: `0x7100ea8080`  ·  **depth 3**
- **Body kích cỡ**: 192 byte
- **Role**: thời gian
- **Obristed chữ ký**:

```c
sead::DateUtil::calcWeekDay(sead::CalendarTime::Year const&, sead::CalendarTime::Month const&,
   sead::CalendarTime::Day const&) int sead::DateUtil::calcWeekDay(int *param_1,int *param_2,int *param_3)
```

_1 mục tiêu cuộc gọi riêng biệt; 23 đường cơ thể

### `sead::CalendarTime`

- **Address**: `0x7100ea75c4`  ·  **depth 2**
- **Body kích cỡ**: 116 byte
- **Role**: thời gian
- **Obristed chữ ký**:

```c
sead::CalendarTime::CalendarTime(sead::CalendarTime::Year const&, sead::CalendarTime::Month
   const&, sead::CalendarTime::Day const&, sead::CalendarTime::Hour const&,
   sead::CalendarTime::Minute const&, sead::CalendarTime::Second const&) void __thiscall sead::CalendarTime::CalendarTime (Calen
```

_2 mục tiêu cuộc gọi riêng biệt; 20 đường cơ thể

### `sead::GraphicsNvn::convertNvnDebugLevel`

- **Address**: `0x7100e71100`  ·  **depth 2**
- **Body kích cỡ**: 32 byte
- **Role**: đồ họa
- **Obristed chữ ký**:

```c
sead::GraphicsNvn::convertNvnDebugLevel(unsigned int) undefined4 sead::GraphicsNvn::convertNvnDebugLevel(uint param_1)
```

_1 mục tiêu cuộc gọi riêng biệt; 9 đường cơ thể

### `sead::ThreadUtil::ConvertPrioritySeadToPlatform`

- **Address**: `0x7100e9a2ec`  ·  **depth 2**
- **Body kích cỡ**: 4 byte
- **Role**:
- **Obristed chữ ký**:

```c
sead::ThreadUtil::ConvertPrioritySeadToPlatform(int) void sead::ThreadUtil::ConvertPrioritySeadToPlatform(void)
```

_1 mục tiêu cuộc gọi riêng biệt; 6 đường cơ thể

### `sead::FrameBufferNvn::create`

- **Address**: `0x7100e6ff90`  ·  **depth 2**
- **Body kích cỡ**: 932 byte
- **Role**: đồ họa
- **Obristed chữ ký**:

```c
void sead::FrameBufferNvn::create(long *param_1,undefined8 *param_2,uint param_3,uint param_4)
```

_7 mục tiêu cuộc gọi riêng biệt; 92 đường cơ thể

### `sead::ResourceMgr::createInstance`

- **Address**: `0x7100e8f150`  ·  **depth 3**
- **Body kích cỡ**: 128 byte
- **Role**: dàn xếp đống
- **Obristed chữ ký**:

```c
IDisposer * sead::ResourceMgr::createInstance(Heap *param_1)
```

_4 mục tiêu cuộc gọi riêng biệt; 18 đường cơ thể

### `sead::FileDeviceMgr::createInstance`

- **Address**: `0x7100e64760`  ·  **depth 3**
- **Body kích cỡ**: 128 byte
- **Role**: dàn xếp đống
- **Obristed chữ ký**:

```c
IDisposer * sead::FileDeviceMgr::createInstance(Heap *param_1)
```

_4 mục tiêu cuộc gọi riêng biệt; 18 đường cơ thể

### `sead::CriticalSection`

- **Address**: `0x7100e98ab0`  ·  **depth 2**
- **Body kích cỡ**: 60 byte
- **Role**:
- **Obristed chữ ký**:

```c
sead::CriticalSection::CriticalSection() void __thiscall sead::CriticalSection::CriticalSection(CriticalSection *this)
```

_3 mục tiêu cuộc gọi riêng biệt; 9 đường cơ thể

### `sead::CalendarTime::Date`

- **Address**: `0x7100ea74e4`  ·  **depth 3**
- **Body kích cỡ**: 72 byte
- **Role**: thời gian
- **Obristed chữ ký**:

```c
sead::CalendarTime::Date::Date(sead::CalendarTime::Year const&, sead::CalendarTime::Month const&,
   sead::CalendarTime::Day const&) void __thiscall sead::CalendarTime::Date::Date(Date *this,int *param_1,int *param_2,int *param_3)
```

_2 mục tiêu cuộc gọi riêng biệt; 13 đường cơ thể

### `sead::DateTime`

- **Address**: `0x7100ea7934`  ·  **depth 2**
- **Body kích cỡ**: 8 byte
- **Role**: thời gian
- **Obristed chữ ký**:

```c
sead::DateTime::DateTime(unsigned long) void __thiscall sead::DateTime::DateTime(DateTime *this,undefined8 param_1)
```

_1 mục tiêu cuộc gọi riêng biệt; 7 đường cơ thể _

### `sead::DelegateThread`

- **Address**: `0x7100e99804`  ·  **depth 2**
- **Body kích cỡ**: 92 byte
- **Role**: sợi
- **Obristed chữ ký**:

```c
Thread::Thread((Thread *)this,param_1,param_3,param_4,param_5,param_6,param_7,param_8);
```

_2 mục tiêu cuộc gọi riêng biệt; 17 đường cơ thể

### `sead::DisplayBufferNvn`

- **Address**: `0x7100e70360`  ·  **depth 2**
- **Body kích cỡ**: 56 byte
- **Role**: đồ họa
- **Obristed chữ ký**:

```c
sead::DisplayBufferNvn::DisplayBufferNvn() void __thiscall sead::DisplayBufferNvn::DisplayBufferNvn(DisplayBufferNvn *this)
```

_1 mục tiêu cuộc gọi riêng biệt; 21 đường cơ thể

### `sead::DrawLockContext`

- **Address**: `0x7100eb9ed8`  ·  **depth 3**
- **Body kích cỡ**: 28 byte
- **Role**:
- **Obristed chữ ký**:

```c
sead::DrawLockContext::DrawLockContext() void __thiscall sead::DrawLockContext::DrawLockContext(DrawLockContext *this)
```

_2 mục tiêu cuộc gọi riêng biệt; 11 đường cơ thể

### `Lp::Sys::WorkerThread::enqueue`

- **Address**: `0x710123ca44`  ·  **depth 2**
- **Body kích cỡ**: 148 byte
- **Role**: công việc- dịch chuyển
- **Obristed chữ ký**:

```c
undefined4 __thiscall Lp::Sys::WorkerThread::enqueue(WorkerThread *this,long param_1,ulong param_2)
```

_4 mục tiêu cuộc gọi riêng biệt; 1 địa điểm gọi gián tiếp; 26 dòng cơ thể

### `sead::ListNode::erase_`

- **Address**: `0x7100e56af4`  ·  **depth 2**
- **Body kích cỡ**: 40 byte
- **Role**:
- **Obristed chữ ký**:

```c
sead::ListNode::erase_() void __thiscall sead::ListNode::erase_(ListNode *this)
```

_1 mục tiêu cuộc gọi riêng biệt; 1 địa điểm gọi gián tiếp; 14 dòng cơ thể _

### `_ZNK4sead7HeapMgr15findContainHeapEPKv`

- **Address**: `0x7100e7c8f4`  ·  **depth 2**
- **Body kích cỡ**: 504 byte
- **Role**: câu hỏi chồng chất
- **Obristed chữ ký**:

```c
Heap * __thiscall sead::HeapMgr::findContainHeap(undefined8 param_1_00,undefined8 param_2)
```

_7 mục tiêu cuộc gọi riêng biệt; 5 địa điểm cuộc gọi gián tiếp; 111 dòng cơ thể

### `sead::Heap::findContainHeap_`

- **Address**: `0x7100e7b388`  ·  **depth 3**
- **Body kích cỡ**: 200 byte
- **Role**: câu hỏi chồng chất
- **Obristed chữ ký**:

```c
Heap * __thiscall sead::Heap::findContainHeap_(Heap *this,undefined8 param_1)
```

_1 mục tiêu cuộc gọi riêng biệt; 5 địa điểm cuộc gọi gián tiếp; 31 dòng cơ thể

### `free`

- **Address**: `0x7100dda114`  ·  **depth 2**
- **Body kích cỡ**: 28 byte
- **Role**:
- **Obristed chữ ký**:

```c
void free(void *__ptr)
```

_2 mục tiêu cuộc gọi riêng biệt; 9 đường cơ thể

### `sead::GameFramework`

- **Address**: `0x7100e69c78`  ·  **depth 3**
- **Body kích cỡ**: 100 byte
- **Role**:
- **Obristed chữ ký**:

```c
sead::GameFramework::GameFramework() void __thiscall sead::GameFramework::GameFramework(GameFramework *this)
```

_2 mục tiêu cuộc gọi riêng biệt; 23 đường cơ thể

### `sead::GameFrameworkNx`

- **Address**: `0x7100e67260`  ·  **depth 2**
- **Body kích cỡ**: 224 byte
- **Role**:
- **Obristed chữ ký**:

```c
sead::GameFrameworkNx::GameFrameworkNx(sead::GameFrameworkNx::CreateArg const&) void __thiscall sead::GameFrameworkNx::GameFrameworkNx(GameFrameworkNx *this,void *param_1)
```

_5 mục tiêu cuộc gọi riêng biệt; 34 đường cơ thể

### `_ZNK4sead8DateTime15getCalendarTimeEPNS_12CalendarTimeE`

- **Address**: `0x7100ea7ce4`  ·  **depth 2**
- **Body kích cỡ**: 480 byte
- **Role**: thời gian
- **Obristed chữ ký**:

```c
void __thiscall sead::DateTime::getCalendarTime(DateTime *this,CalendarTime *param_1)
```

_13 mục tiêu cuộc gọi riêng biệt; 72 đường cơ thể

### `_ZNK4sead7HeapMgr14getCurrentHeapEv`

- **Address**: `0x7100e7cf7c`  ·  **depth 2**
- **Body kích cỡ**: 68 byte
- **Role**: câu hỏi chồng chất
- **Obristed chữ ký**:

```c
sead::HeapMgr::getCurrentHeap() const undefined8 __thiscall sead::HeapMgr::getCurrentHeap(HeapMgr *this)
```

_2 mục tiêu cuộc gọi riêng biệt; 1 địa điểm gọi gián tiếp; 13 dòng cơ thể

### `sead::GraphicsNvn::getNewTextureId`

- **Address**: `0x7100e71018`  ·  **depth 3**
- **Body kích cỡ**: 24 byte
- **Role**: đồ họa
- **Obristed chữ ký**:

```c
sead::GraphicsNvn::getNewTextureId() void __thiscall sead::GraphicsNvn::getNewTextureId(GraphicsNvn *this)
```

_3 mục tiêu cuộc gọi riêng biệt; 18 đường cơ thể

### `sead::EnumUtil::getParseTextCS_`

- **Address**: `0x7100e7d734`  ·  **depth 3**
- **Body kích cỡ**: 116 byte
- **Role**:
- **Obristed chữ ký**:

```c
sead::EnumUtil::getParseTextCS_() undefined * sead::EnumUtil::getParseTextCS_(void)
```

_5 mục tiêu cuộc gọi riêng biệt; 12 đường cơ thể

### `Lp::Sys::getThreadInfo`

- **Address**: `0x710123c29c`  ·  **depth 2**
- **Body kích cỡ**: 384 byte
- **Role**:
- **Obristed chữ ký**:

```c
Lp::Sys::getThreadInfo(sead::SafeStringBase<char> const&) void __thiscall Lp::Sys::getThreadInfo(undefined4 *param_1,Sys *this)
```

_2 mục tiêu cuộc gọi riêng biệt; 5 địa điểm gọi gián tiếp; 67 dòng cơ thể

### `sead::Graphics`

- **Address**: `0x7100e9d050`  ·  **depth 3**
- **Body kích cỡ**: 52 byte
- **Role**: đồ họa
- **Obristed chữ ký**:

```c
sead::Graphics::Graphics() void __thiscall sead::Graphics::Graphics(Graphics *this)
```

_2 mục tiêu cuộc gọi riêng biệt; 12 đường cơ thể

### `sead::GraphicsNvn`

- **Address**: `0x7100e70d54`  ·  **depth 2**
- **Body kích cỡ**: 192 byte
- **Role**: đồ họa
- **Obristed chữ ký**:

```c
sead::GraphicsNvn::GraphicsNvn(sead::GraphicsNvn::CreateArg const&) void __thiscall sead::GraphicsNvn::GraphicsNvn(GraphicsNvn *this,undefined8 *param_1)
```

_3 mục tiêu cuộc gọi riêng biệt; 1 trong vòng gọi gián tiếp nơi Mạng; decomiler cảnh báo hiện tại; 38 dòng cơ thể_

### `sead::Heap`

- **Address**: `0x7100e7ada8`  ·  **depth 3**
- **Body kích cỡ**: 340 byte
- **Role**:
- **Obristed chữ ký**:

```c
IDisposer::IDisposer((IDisposer *)this,param_2,1);
```

_7 mục tiêu cuộc gọi riêng biệt; 65 đường cơ thể

### `sead::IDisposer`

- **Address**: `0x7100e76550`  ·  **depth 2**
- **Body kích cỡ**: 144 byte
- **Role**:
- **Obristed chữ ký**:

```c
void __thiscall sead::IDisposer::IDisposer(IDisposer *this,Heap *param_1,uint param_2)
```

_4 mục tiêu cuộc gọi riêng biệt; 34 đường cơ thể

### `sead::GameFramework::initialize`

- **Address**: `0x7100e69fe4`  ·  **depth 2**
- **Body kích cỡ**: 456 byte
- **Role**:
- **Obristed chữ ký**:

```c
sead::GameFramework::initialize(sead::Framework::InitializeArg const&) void sead::GameFramework::initialize(long *param_1)
```

_6 mục tiêu cuộc gọi riêng biệt; 6 địa điểm gọi gián tiếp; 54 dòng cơ thể

### `sead::PerformanceMgrNx::initialize`

- **Address**: `0x7100e68c44`  ·  **depth 2**
- **Body kích cỡ**: 4 byte
- **Role**:
- **Obristed chữ ký**:

```c
sead::PerformanceMgrNx::initialize() void sead::PerformanceMgrNx::initialize(void)
```

_1 mục tiêu cuộc gọi riêng biệt; 7 đường cơ thể _

### `sead::Graphics::initialize`

- **Address**: `0x7100e9d0ac`  ·  **depth 2**
- **Body kích cỡ**: 116 byte
- **Role**: đồ họa
- **Obristed chữ ký**:

```c
void __thiscall sead::Graphics::initialize(Graphics *this,long *param_1)
```

_5 mục tiêu cuộc gọi riêng biệt; 4 địa điểm gọi gián tiếp; 14 dòng cơ thể

### `sead::Framework::initialize`

- **Address**: `0x7100e698ac`  ·  **depth 3**
- **Body kích cỡ**: 200 byte
- **Role**:
- **Obristed chữ ký**:

```c
sead::Framework::initialize(sead::Framework::InitializeArg const&) void sead::Framework::initialize(long *param_1)
```

_6 mục tiêu cuộc gọi riêng biệt; 1 địa điểm gọi gián tiếp; 29 dòng cơ thể

### `sead::PtrArrayImpl::insert`

- **Address**: `0x7100e57814`  ·  **depth 3**
- **Body kích cỡ**: 136 byte
- **Role**:
- **Obristed chữ ký**:

```c
void __thiscall sead::PtrArrayImpl::insert(PtrArrayImpl *this,int param_1,undefined8 param_2)
```

_2 mục tiêu cuộc gọi riêng biệt; 2 địa điểm gọi gián tiếp; 17 dòng cơ thể

### `sead::ListNode::insertFront_`

- **Address**: `0x7100e56adc`  ·  **depth 2**
- **Body kích cỡ**: 24 byte
- **Role**:
- **Obristed chữ ký**:

```c
void __thiscall sead::ListNode::insertFront_(ListNode *this,long *param_1)
```

_1 mục tiêu cuộc gọi riêng biệt; 14 đường cơ thể

### `sead::DateUtil::isLeapYear`

- **Address**: `0x7100ea8038`  ·  **depth 3**
- **Body kích cỡ**: 72 byte
- **Role**: thời gian
- **Obristed chữ ký**:

```c
sead::DateUtil::isLeapYear(unsigned int) bool sead::DateUtil::isLeapYear(uint param_1)
```

_1 mục tiêu cuộc gọi riêng biệt; 6 đường cơ thể

### `sead::DrawLockContext::lock`

- **Address**: `0x7100eb9ef8`  ·  **depth 3**
- **Body kích cỡ**: 8 byte
- **Role**:
- **Obristed chữ ký**:

```c
sead::DrawLockContext::lock() void __thiscall sead::DrawLockContext::lock(DrawLockContext *this)
```

_2 mục tiêu cuộc gọi riêng biệt; 7 đường cơ thể

### `sead::CriticalSection::lock`

- **Address**: `0x7100e98bd8`  ·  **depth 3**
- **Body kích cỡ**: 8 byte
- **Role**:
- **Obristed chữ ký**:

```c
sead::CriticalSection::lock() void __thiscall sead::CriticalSection::lock(CriticalSection *this)
```

_2 mục tiêu cuộc gọi riêng biệt; 7 đường cơ thể

### `sead::CalendarTime::Month::makeFromValueOneOrigin`

- **Address**: `0x7100ea74bc`  ·  **depth 3**
- **Body kích cỡ**: 8 byte
- **Role**: thời gian
- **Obristed chữ ký**:

```c
sead::CalendarTime::Month::makeFromValueOneOrigin(unsigned int) undefined4 sead::CalendarTime::Month::makeFromValueOneOrigin(undefined4 param_1)
```

_1 mục tiêu cuộc gọi riêng biệt; 6 đường cơ thể

### `malloc`

- **Address**: `0x7100dda0c0`  ·  **depth 2**
- **Body kích cỡ**: 84 byte
- **Role**:
- **Obristed chữ ký**:

```c
void * malloc(size_t __size)
```

_3 mục tiêu cuộc gọi riêng biệt; 16 đường cơ thể

### `memcpy`

- **Address**: `0x7101412278`  ·  **depth 3**
- **Body kích cỡ**: 13 byte
- **Role**:
- **Obristed chữ ký**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void * memcpy(void *__dest,void *__src,size_t __n)
```

_1 mục tiêu cuộc gọi riêng biệt; cảnh báo phân hủy hiện tại; 8 dòng cơ thể

### `memset`

- **Address**: `0x7101412268`  ·  **depth 3**
- **Body kích cỡ**: 13 byte
- **Role**:
- **Obristed chữ ký**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void * memset(void *__s,int __c,size_t __n)
```

_1 mục tiêu cuộc gọi riêng biệt; cảnh báo phân hủy hiện tại; 8 dòng cơ thể

### `sead::EnumUtil::parseText_`

- **Address**: `0x7100e7d810`  ·  **depth 3**
- **Body kích cỡ**: 248 byte
- **Role**:
- **Obristed chữ ký**:

```c
void sead::EnumUtil::parseText_(long param_1,byte *param_2,int param_3)
```

_1 mục tiêu cuộc gọi riêng biệt; 67 đường cơ thể _

### `sead::ReadWriteLock`

- **Address**: `0x7100e998a8`  ·  **depth 2**
- **Body kích cỡ**: 84 byte
- **Role**:
- **Obristed chữ ký**:

```c
sead::ReadWriteLock::ReadWriteLock() void __thiscall sead::ReadWriteLock::ReadWriteLock(ReadWriteLock *this)
```

_2 mục tiêu cuộc gọi riêng biệt; 14 đường cơ thể

### `sead::GraphicsNvn::registerDefaultCommandBuffer`

- **Address**: `0x7100e71048`  ·  **depth 2**
- **Body kích cỡ**: 8 byte
- **Role**: đồ họa
- **Obristed chữ ký**:

```c
sead::GraphicsNvn::registerDefaultCommandBuffer(GraphicsNvn *this,undefined8 param_1)
```

_1 mục tiêu cuộc gọi riêng biệt; 8 đường cơ thể

### `sead::GraphicsNvn::registerDisplayBufferNvn`

- **Address**: `0x7100e71050`  ·  **depth 2**
- **Body kích cỡ**: 8 byte
- **Role**: đồ họa
- **Obristed chữ ký**:

```c
void __thiscall sead::GraphicsNvn::registerDisplayBufferNvn(GraphicsNvn *this,undefined8 param_1)
```

_1 mục tiêu cuộc gọi riêng biệt; 7 đường cơ thể _

### `sead::GraphicsNvn::registerQueue`

- **Address**: `0x7100e71040`  ·  **depth 2**
- **Body kích cỡ**: 8 byte
- **Role**: đồ họa
- **Obristed chữ ký**:

```c
void __thiscall sead::GraphicsNvn::registerQueue(GraphicsNvn *this,undefined8 param_1)
```

_1 mục tiêu cuộc gọi riêng biệt; 7 đường cơ thể _

### `sead::Semaphore`

- **Address**: `0x7100eba538`  ·  **depth 3**
- **Body kích cỡ**: 76 byte
- **Role**:
- **Obristed chữ ký**:

```c
sead::Semaphore::Semaphore(int, int) void __thiscall sead::Semaphore::Semaphore(Semaphore *this,int param_1,int param_2)
```

_3 mục tiêu cuộc gọi riêng biệt; 9 đường cơ thể

### `sead::Thread::setAffinity`

- **Address**: `0x7100e992cc`  ·  **depth 2**
- **Body kích cỡ**: 56 byte
- **Role**: sợi
- **Obristed chữ ký**:

```c
sead::Thread::setAffinity(sead::CoreIdMask const&) void __thiscall sead::Thread::setAffinity(Thread *this,undefined4 *param_1)
```

_3 mục tiêu cuộc gọi riêng biệt; 1 địa điểm gọi gián tiếp; 11 dòng cơ thể

### `sead::HeapMgr::setCurrentHeap_`

- **Address**: `0x7100e7cfc0`  ·  **depth 3**
- **Body kích cỡ**: 60 byte
- **Role**: câu hỏi chồng chất
- **Obristed chữ ký**:

```c
undefined8 __thiscall sead::HeapMgr::setCurrentHeap_(undefined8 param_1_00,undefined8 param_2)
```

_2 mục tiêu cuộc gọi riêng biệt; 1 địa điểm gọi gián tiếp; 11 dòng cơ thể

### `sead::CalendarTime::setDate`

- **Address**: `0x7100ea7638`  ·  **depth 3**
- **Body kích cỡ**: 60 byte
- **Role**: thời gian
- **Obristed chữ ký**:

```c
sead::CalendarTime::setDate(sead::CalendarTime::Date const&) void __thiscall sead::CalendarTime::setDate(CalendarTime *this,undefined8 *param_1)
```

_2 mục tiêu cuộc gọi riêng biệt; 11 đường cơ thể

### `sead::DateTime::setNow`

- **Address**: `0x7100ea7ec4`  ·  **depth 2**
- **Body kích cỡ**: 204 byte
- **Role**: thời gian
- **Obristed chữ ký**:

```c
sead::DateTime::setNow() undefined8 __thiscall sead::DateTime::setNow(DateTime *this)
```

_12 mục tiêu cuộc gọi riêng biệt; 39 đường cơ thể

### `sead::DisplayBufferNvn::setPresentInterval`

- **Address**: `0x7100e70408`  ·  **depth 2**
- **Body kích cỡ**: 36 byte
- **Role**: đồ họa
- **Obristed chữ ký**:

```c
sead::DisplayBufferNvn::setPresentInterval(unsigned char) void __thiscall sead::DisplayBufferNvn::setPresentInterval(DisplayBufferNvn *this,DisplayBufferNvn param_2)
```

_1 mục tiêu cuộc gọi riêng biệt; 2 trong vòng gọi gián tiếp nơi Mạng; decomiler cảnh báo hiện tại; 14 dòng cơ thể_

### `sead::DisplayBufferNvn::setTripleBuffer`

- **Address**: `0x7100e7042c`  ·  **depth 2**
- **Body kích cỡ**: 20 byte
- **Role**: đồ họa
- **Obristed chữ ký**:

```c
sead::DisplayBufferNvn::setTripleBuffer(bool) void __thiscall sead::DisplayBufferNvn::setTripleBuffer(DisplayBufferNvn *this,uint param_1)
```

_1 mục tiêu cuộc gọi riêng biệt; 12 đường cơ thể

### `sead::DateTime::setUnixTime`

- **Address**: `0x7100ea7940`  ·  **depth 3**
- **Body kích cỡ**: 248 byte
- **Role**: thời gian
- **Obristed chữ ký**:

```c
sead::DateTime::setUnixTime(sead::CalendarTime::Year const&, sead::CalendarTime::Month const&,
   sead::CalendarTime::Day const&, sead::CalendarTime::Hour const&, sead::CalendarTime::Minute
   const&, sead::CalendarTime::Second const&) void __thiscall sead::DateTime::setUnixTime (DateTime *this,
```

_4 mục tiêu cuộc gọi riêng biệt; 46 đường cơ thể

### `sead::CalendarTime::Year::setValue`

- **Address**: `0x7100ea72dc`  ·  **depth 3**
- **Body kích cỡ**: 8 byte
- **Role**: thời gian
- **Obristed chữ ký**:

```c
sead::CalendarTime::Year::setValue(unsigned int) void __thiscall sead::CalendarTime::Year::setValue(Year *this,undefined4 param_1)
```

_1 mục tiêu cuộc gọi riêng biệt; 7 đường cơ thể _

### `sead::CalendarTime::Day::setValue`

- **Address**: `0x7100ea74c4`  ·  **depth 3**
- **Body kích cỡ**: 8 byte
- **Role**: thời gian
- **Obristed chữ ký**:

```c
sead::CalendarTime::Day::setValue(unsigned int) void __thiscall sead::CalendarTime::Day::setValue(Day *this,undefined4 param_1)
```

_1 mục tiêu cuộc gọi riêng biệt; 7 đường cơ thể _

### `sead::CalendarTime::Hour::setValue`

- **Address**: `0x7100ea74cc`  ·  **depth 3**
- **Body kích cỡ**: 8 byte
- **Role**: thời gian
- **Obristed chữ ký**:

```c
sead::CalendarTime::Hour::setValue(unsigned int) void __thiscall sead::CalendarTime::Hour::setValue(Hour *this,undefined4 param_1)
```

_1 mục tiêu cuộc gọi riêng biệt; 7 đường cơ thể _

### `sead::CalendarTime::Minute::setValue`

- **Address**: `0x7100ea74d4`  ·  **depth 3**
- **Body kích cỡ**: 8 byte
- **Role**: thời gian
- **Obristed chữ ký**:

```c
sead::CalendarTime::Minute::setValue(unsigned int) void __thiscall sead::CalendarTime::Minute::setValue(Minute *this,undefined4 param_1)
```

_1 mục tiêu cuộc gọi riêng biệt; 7 đường cơ thể _

### `sead::CalendarTime::Second::setValue`

- **Address**: `0x7100ea74dc`  ·  **depth 3**
- **Body kích cỡ**: 8 byte
- **Role**: thời gian
- **Obristed chữ ký**:

```c
sead::CalendarTime::Second::setValue(unsigned int) void __thiscall sead::CalendarTime::Second::setValue(Second *this,undefined4 param_1)
```

_1 mục tiêu cuộc gọi riêng biệt; 7 đường cơ thể _

### `sead::Thread::sleep`

- **Address**: `0x7100e99434`  ·  **depth 2**
- **Body kích cỡ**: 20 byte
- **Role**: sợi
- **Obristed chữ ký**:

```c
sead::Thread::sleep(sead::TickSpan) void sead::Thread::sleep(void)
```

_3 mục tiêu cuộc gọi riêng biệt; 8 đường cơ thể

### `Lp::Sys::HeapGroup::Group::text_`

- **Address**: `0x71011f5908`  ·  **depth 2**
- **Body kích cỡ**: 428 byte
- **Role**: dàn xếp đống
- **Obristed chữ ký**:

```c
Lp::Sys::HeapGroup::Group::text_(int) undefined8 Lp::Sys::HeapGroup::Group::text_(uint param_1)
```

_9 mục tiêu cuộc gọi riêng biệt; 2 địa điểm gọi gián tiếp; 71 dòng cơ thể

### `sead::Thread`

- **Address**: `0x7100e98f50`  ·  **depth 3**
- **Body kích cỡ**: 476 byte
- **Role**:
- **Obristed chữ ký**:

```c
IDisposer::IDisposer((IDisposer *)this);
```

_13 mục tiêu cuộc gọi riêng biệt; 1 địa điểm gọi gián tiếp; 67 dòng xác_

### `sead::CalendarTime::Time`

- **Address**: `0x7100ea752c`  ·  **depth 3**
- **Body kích cỡ**: 28 byte
- **Role**: thời gian
- **Obristed chữ ký**:

```c
sead::CalendarTime::Time::Time(sead::CalendarTime::Hour const&, sead::CalendarTime::Minute
   const&, sead::CalendarTime::Second const&) void __thiscall sead::CalendarTime::Time::Time (Time *this,undefined4 *param_1,undefined4 *param_2,undefined4 *param_3)
```

_1 mục tiêu cuộc gọi riêng biệt; 12 đường cơ thể

### `sead::ExpHeap::tryCreate`

- **Address**: `0x7100e7678c`  ·  **depth 2**
- **Body kích cỡ**: 696 byte
- **Role**: dàn xếp đống
- **Obristed chữ ký**:

```c
Heap::Heap(pHVar5,param_2,param_3,pHVar5,uVar6,1,param_6 & 1);
```

_6 mục tiêu cuộc gọi riêng biệt; 5 địa điểm cuộc gọi gián tiếp; 131 dòng cơ thể _

### `sead::DrawLockContext::unlock`

- **Address**: `0x7100eb9f00`  ·  **depth 3**
- **Body kích cỡ**: 8 byte
- **Role**:
- **Obristed chữ ký**:

```c
sead::DrawLockContext::unlock() void __thiscall sead::DrawLockContext::unlock(DrawLockContext *this)
```

_2 mục tiêu cuộc gọi riêng biệt; 7 đường cơ thể

### `sead::CriticalSection::unlock`

- **Address**: `0x7100e98be8`  ·  **depth 3**
- **Body kích cỡ**: 8 byte
- **Role**:
- **Obristed chữ ký**:

```c
sead::CriticalSection::unlock() void __thiscall sead::CriticalSection::unlock(CriticalSection *this)
```

_2 mục tiêu cuộc gọi riêng biệt; 7 đường cơ thể

### `sead::StringUtil::vsnprintf`

- **Address**: `0x7100e8b3b8`  ·  **depth 2**
- **Body kích cỡ**: 148 byte
- **Role**:
- **Obristed chữ ký**:

```c
int sead::StringUtil::vsnprintf(long param_1,ulong param_2,undefined8 param_3,undefined8 *param_4)
```

_2 mục tiêu cuộc gọi riêng biệt; 27 đường cơ thể

### `Lp::Sys::WorkerThread`

- **Address**: `0x710123c920`  ·  **depth 3**
- **Body kích cỡ**: 164 byte
- **Role**:
- **Obristed chữ ký**:

```c
Lp::Sys::WorkerThread::WorkerThread(Lp::Sys::WorkerThread::CreateArg const&) void __thiscall Lp::Sys::WorkerThread::WorkerThread(WorkerThread *this,long *param_1)
```

_5 mục tiêu cuộc gọi riêng biệt; 1 trong vòng gọi gián tiếp nơi Mạng; decomiler cảnh báo hiện tại; 26 dòng cơ thể_

---

## Độ sâu 4+ — phụ thuộc sâu (22 chức năng)

### `sead::MessageQueue::allocate`

- **Address**: `0x7100eba35c`  ·  **depth 4**
- **Body kích cỡ**: 108 byte
- **Role**:
- **Obristed chữ ký**:

```c
void __thiscall sead::MessageQueue::allocate(MessageQueue *this,ulong param_2_00,long *param_2)
```

_5 mục tiêu cuộc gọi riêng biệt; 23 đường cơ thể

### `sead::PtrArrayImpl::allocBuffer`

- **Address**: `0x7100e575e0`  ·  **depth 4**
- **Body kích cỡ**: 84 byte
- **Role**:
- **Obristed chữ ký**:

```c
sead::PtrArrayImpl::allocBuffer(PtrArrayImpl *this,int param_1,long *param_2,undefined4 param_3)
```

_2 mục tiêu cuộc gọi riêng biệt; 16 đường cơ thể

### `sead::ThreadMgr::createInstance`

- **Address**: `0x7100e995d8`  ·  **depth 4**
- **Body kích cỡ**: 136 byte
- **Role**: dàn xếp đống
- **Obristed chữ ký**:

```c
ThreadMgr * sead::ThreadMgr::createInstance(Heap *param_1)
```

_4 mục tiêu cuộc gọi riêng biệt; 18 đường cơ thể

### `sead::GlobalRandom::createInstance`

- **Address**: `0x7100ea1f54`  ·  **depth 4**
- **Body kích cỡ**: 136 byte
- **Role**: dàn xếp đống
- **Obristed chữ ký**:

```c
Random * sead::GlobalRandom::createInstance(Heap *param_1)
```

_4 mục tiêu cuộc gọi riêng biệt; 18 đường cơ thể

### `sead::FileDeviceMgr`

- **Address**: `0x7100e64864`  ·  **depth 4**
- **Body kích cỡ**: 204 byte
- **Role**: hệ thống tập tin
- **Obristed chữ ký**:

```c
sead::FileDeviceMgr::FileDeviceMgr() void __thiscall sead::FileDeviceMgr::FileDeviceMgr(FileDeviceMgr *this)
```

_8 mục tiêu cuộc gọi riêng biệt; 32 đường cơ thể

### `sead::FindContainHeapCache`

- **Address**: `0x7100e7d060`  ·  **depth 4**
- **Body kích cỡ**: 8 byte
- **Role**:
- **Obristed chữ ký**:

```c
sead::FindContainHeapCache::FindContainHeapCache() void __thiscall sead::FindContainHeapCache::FindContainHeapCache(FindContainHeapCache *this)
```

_1 mục tiêu cuộc gọi riêng biệt; 7 đường cơ thể _

### `sead::Framework`

- **Address**: `0x7100e696a4`  ·  **depth 4**
- **Body kích cỡ**: 60 byte
- **Role**:
- **Obristed chữ ký**:

```c
sead::Framework::Framework() void __thiscall sead::Framework::Framework(Framework *this)
```

_1 mục tiêu cuộc gọi riêng biệt; 20 đường cơ thể

### `<no symbol>`

- **Address**: `0x710000019c`  ·  **depth 7**
- **Body kích cỡ**: 8 byte
- **Role**:
- **Obristed chữ ký**:

```c
undefined8 FUN_710000019c(void)
```

_1 mục tiêu cuộc gọi riêng biệt; 5 đường cơ thể

### `sead::Random::init`

- **Address**: `0x7100ea202c`  ·  **depth 5**
- **Body kích cỡ**: 96 byte
- **Role**:
- **Obristed chữ ký**:

```c
sead::Random::init() void __thiscall sead::Random::init(Random *this)
```

_2 mục tiêu cuộc gọi riêng biệt; 17 đường cơ thể

### `sead::HeapMgr::initialize`

- **Address**: `0x7100e7c6b8`  ·  **depth 4**
- **Body kích cỡ**: 216 byte
- **Role**: câu hỏi chồng chất
- **Obristed chữ ký**:

```c
void sead::HeapMgr::initialize(undefined8 *param_1)
```

_2 mục tiêu cuộc gọi riêng biệt; 1 địa điểm gọi gián tiếp; 29 dòng cơ thể_

### `sead::ThreadMgr::initialize`

- **Address**: `0x7100e99eb4`  ·  **depth 4**
- **Body kích cỡ**: 4 byte
- **Role**: sợi
- **Obristed chữ ký**:

```c
void __thiscall sead::ThreadMgr::initialize(ThreadMgr *this,long *param_1)
```

_8 mục tiêu cuộc gọi riêng biệt; 1 địa điểm gọi gián tiếp; 26 dòng cơ thể

### `sead::Arena::initialize`

- **Address**: `0x7100eb9f1c`  ·  **depth 5**
- **Body kích cỡ**: 52 byte
- **Role**:
- **Obristed chữ ký**:

```c
sead::Arena::initialize(unsigned long) void __thiscall sead::Arena::initialize(Arena *this,long param_1)
```

_2 mục tiêu cuộc gọi riêng biệt; 8 đường cơ thể

### `sead::ThreadMgr::initMainThread_`

- **Address**: `0x7100e996b8`  ·  **depth 5**
- **Body kích cỡ**: 184 byte
- **Role**: sợi
- **Obristed chữ ký**:

```c
void __thiscall sead::ThreadMgr::initMainThread_(ThreadMgr *this,long *param_1)
```

_8 mục tiêu cuộc gọi riêng biệt; 1 địa điểm gọi gián tiếp; 26 dòng cơ thể

### `sead::MainFileDevice`

- **Address**: `0x7100e656ac`  ·  **depth 5**
- **Body kích cỡ**: 424 byte
- **Role**: hệ thống tập tin
- **Obristed chữ ký**:

```c
void __thiscall sead::MainFileDevice::MainFileDevice(MainFileDevice *this,long *param_1)
```

_6 mục tiêu cuộc gọi riêng biệt; 3 địa điểm gọi gián tiếp; 71 dòng cơ thể _

### `memmove`

- **Address**: `0x7101412438`  ·  **depth 4**
- **Body kích cỡ**: 13 byte
- **Role**:
- **Obristed chữ ký**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void * memmove(void *__dest,void *__src,size_t __n)
```

_1 mục tiêu cuộc gọi riêng biệt; cảnh báo phân hủy hiện tại; 8 dòng cơ thể

### `sead::MessageQueue`

- **Address**: `0x7100eba350`  ·  **depth 4**
- **Body kích cỡ**: 8 byte
- **Role**:
- **Obristed chữ ký**:

```c
sead::MessageQueue::MessageQueue() void __thiscall sead::MessageQueue::MessageQueue(MessageQueue *this)
```

_1 mục tiêu cuộc gọi riêng biệt; 7 đường cơ thể _

### `sead::FileDeviceMgr::mount`

- **Address**: `0x7100e64990`  ·  **depth 5**
- **Body kích cỡ**: 472 byte
- **Role**: hệ thống tập tin
- **Obristed chữ ký**:

```c
void __thiscall sead::FileDeviceMgr::mount(FileDeviceMgr *this,long param_1,long *param_2)
```

_4 mục tiêu cuộc gọi riêng biệt; 9 địa điểm cuộc gọi gián tiếp; 75 dòng cơ thể _

### `sead::NinContentFileDevice`

- **Address**: `0x7100eb7150`  ·  **depth 6**
- **Body kích cỡ**: 92 byte
- **Role**: hệ thống tập tin
- **Obristed chữ ký**:

```c
sead::NinContentFileDevice::NinContentFileDevice() void __thiscall sead::NinContentFileDevice::NinContentFileDevice(NinContentFileDevice *this)
```

_2 mục tiêu cuộc gọi riêng biệt; 16 đường cơ thể

### `sead::NinFileDeviceBase`

- **Address**: `0x7100eb734c`  ·  **depth 7**
- **Body kích cỡ**: 392 byte
- **Role**: hệ thống tập tin
- **Obristed chữ ký**:

```c
sead::NinFileDeviceBase::NinFileDeviceBase(sead::SafeStringBase<char> const&,
   sead::SafeStringBase<char> const&) void __thiscall sead::NinFileDeviceBase::NinFileDeviceBase(NinFileDeviceBase *this,long *param_1,long param_2)
```

_4 mục tiêu cuộc gọi riêng biệt; 6 địa điểm gọi gián tiếp; 69 dòng cơ thể _

### `_ZnamPN4sead4HeapEiRKSt9nothrow_t`

- **Address**: `0x7100e564d8`  ·  **depth 5**
- **Body kích cỡ**: 116 byte
- **Role**:
- **Obristed chữ ký**:

```c
void * operator_new__(size_t param_1,long *param_2,undefined4 param_3)
```

_3 mục tiêu cuộc gọi riêng biệt; 1 trong vòng gọi gián tiếp nơi Mạng; decomiler cảnh báo có mặt; 19 dòng cơ thể_

### `sead::ResourceMgr`

- **Address**: `0x7100e8f238`  ·  **depth 4**
- **Body kích cỡ**: 380 byte
- **Role**:
- **Obristed chữ ký**:

```c
sead::ResourceMgr::ResourceMgr() void __thiscall sead::ResourceMgr::ResourceMgr(ResourceMgr *this)
```

_8 mục tiêu cuộc gọi riêng biệt; 1 địa điểm gọi gián tiếp; 70 dòng cơ thể

### `sead::ThreadMgr`

- **Address**: `0x7100e99e68`  ·  **depth 5**
- **Body kích cỡ**: 76 byte
- **Role**: sợi
- **Obristed chữ ký**:

```c
sead::ThreadMgr::ThreadMgr() void __thiscall sead::ThreadMgr::ThreadMgr(ThreadMgr *this)
```

_3 mục tiêu cuộc gọi riêng biệt; 15 đường cơ thể

---

## Ghi chú

- Chữ ký là **Bearled**, không phải tuyên bố; tên và loại đối số là
  Sự suy dinh dưỡng từ cơ thể Ghidra.
- ** phục hồi bản quyền là xấp xỉ cho một số chức năng.** Ghdra wraps
  kiểu quay lại và danh sách các tiêu đề trên các dòng, và cho chức năng kèm theo
  Những lời mở đầu khác thường có thể chọn một mảnh cơ thể thay vào đó.
  Có chữ ký giống như một tuyên bố thay vì một tuyên bố nên được
  read from the raw pseudocode, which `tools/ghidra/ExtractDecompiled.py`
  Tái tạo theo yêu cầu.
- **Names đến từ chỉ mục địa chỉ, không phải Ghidra.** Ghidra in bản in
  member name (`create`); the namespace-qualified name (`sead::ExpHeap::create`)
  is joined in from `engine-addrs-index.txt`.
- Độ sâu là khoảng cách từ gốc sáu giày trong đồ thị cuộc gọi đã được giải mã.
  Độ sâu 0–1 là những gì khởi động chạm đầu tiên — thực hiện ban nhạc đó đầu tiên.
- Full pseudocode is reproducible with `tools/ghidra/ExtractDecompiled.py`
  Và không được thực hiện, bởi vì đó là bản vẽ mã của Nintendo.
- Cùng với [PLATORM_REFERCE.md] (PLATORM_REFECE.md) bao gồm này
  Mỗi chức năng được đặt tên trong việc đóng cửa khởi động (51 sân ga + 126 động cơ = 177).
