# Boot-closure engine reference

Observed signatures and roles for the **sead / Lp / nn engine functions** the
boot path depends on, taken from decompiled bodies rather than declarations.

Companion to [PLATFORM_REFERENCE.md](PLATFORM_REFERENCE.md), which covers the
51 platform functions. Together they annotate the whole
[BOOT_CALLGRAPH.md](BOOT_CALLGRAPH.md) closure with real code.

Source: Ghidra 12.1.2 via REA. Functions: 126.

---

## Depth 0–1 — the critical path (31 functions)

### `sead::BufferedSafeStringBase`

- **Address**: `0x7100e851d0`  ·  **depth 1**
- **Body size**: 300 bytes
- **Role**: string handling
- **Observed signature**:

```c
} while (lVar1 < 0x80000);
```

_2 distinct call targets; 4 indirect call site(s); 68 body lines_

### `_ZNK4sead22BufferedSafeStringBaseIcE22assureTerminationImpl_Ev`

- **Address**: `0x7100e84ccc`  ·  **depth 1**
- **Body size**: 20 bytes
- **Role**: string handling
- **Observed signature**:

```c
sead::BufferedSafeStringBase<char>::assureTerminationImpl_() const void __thiscall sead::BufferedSafeStringBase<char>::assureTerminationImpl_(BufferedSafeStringBase<char> *this)
```

_1 distinct call targets; 1 indirect call site(s); 8 body lines_

### `sead::ExpHeap::create`

- **Address**: `0x7100e76784`  ·  **depth 1**
- **Body size**: 8 bytes
- **Role**: heap setup
- **Observed signature**:

```c
tryCreate(param_1,param_2,param_3,param_4,param_5,param_6 & 1);
```

_2 distinct call targets; 9 body lines_

### `Lp::Sys::HeapGroup::createHeap`

- **Address**: `0x71011f5130`  ·  **depth 1**
- **Body size**: 508 bytes
- **Role**: heap setup
- **Observed signature**:

```c
WARNING: Removing unreachable block (ram,0x0071011f5294) /* WARNING: Removing unreachable block (ram,0x0071011f5204) */ /* WARNING: Removing unreachable block (ram,0x0071011f51c0) */ /* WARNING: Removing unreachable block (ram,0x0071011f524c) */ /* WARNING: Removing unreachable block (ram,0x0071011f
```

_4 distinct call targets; decompiler warnings present; 55 body lines_

### `Lp::Sys::HeapGroup::createInstance`

- **Address**: `0x71011f4ffc`  ·  **depth 1**
- **Body size**: 160 bytes
- **Role**: heap setup
- **Observed signature**:

```c
undefined8 * Lp::Sys::HeapGroup::createInstance(Heap *param_1)
```

_5 distinct call targets; 25 body lines_

### `Lp::Sys::RootTask::createParallelInitThread`

- **Address**: `0x71011fcadc`  ·  **depth 0**
- **Body size**: 104 bytes
- **Role**: parallel-init orchestration
- **Observed signature**:

```c
Lp::Sys::RootTask::createParallelInitThread() void __thiscall Lp::Sys::RootTask::createParallelInitThread(RootTask *this)
```

_2 distinct call targets; 1 indirect call site(s); 16 body lines_

### `Lp::Sys::WorkerThreadMgr::createWorker`

- **Address**: `0x710123d4a0`  ·  **depth 1**
- **Body size**: 132 bytes
- **Role**: worker-thread dispatch
- **Observed signature**:

```c
Lp::Sys::WorkerThreadMgr::createWorker(WorkerThreadMgr *this,Sys *param_1,undefined8 param_2)
```

_3 distinct call targets; 19 body lines_

### `Lp::Utl::dumpDateTime`

- **Address**: `0x71012cdbf4`  ·  **depth 1**
- **Body size**: 216 bytes
- **Role**: time
- **Observed signature**:

```c
void Lp::Utl::dumpDateTime(undefined8 param_1)
```

_6 distinct call targets; 40 body lines_

### `Lp::Utl::dumpMemoryInfo`

- **Address**: `0x71012cdccc`  ·  **depth 1**
- **Body size**: 408 bytes
- **Role**: diagnostics / formatting
- **Observed signature**:

```c
void Lp::Utl::dumpMemoryInfo(undefined8 param_1)
```

_3 distinct call targets; 84 body lines_

### `Lp::Sys::WorkerThreadMgr::enqueue`

- **Address**: `0x710123d1a8`  ·  **depth 1**
- **Body size**: 88 bytes
- **Role**: worker-thread dispatch
- **Observed signature**:

```c
Lp::Sys::WorkerThreadMgr::enqueue(WorkerThreadMgr *this,uint *param_1,long param_2,uint param_3)
```

_2 distinct call targets; 26 body lines_

### `sead::FormatFixedSafeString`

- **Address**: `0x710000dbec`  ·  **depth 1**
- **Body size**: 224 bytes
- **Role**: diagnostics / formatting
- **Observed signature**:

```c
BufferedSafeStringBase<char>::assureTerminationImpl_(param_1);
```

_3 distinct call targets; 37 body lines_

### `Lp::Sys::Framework`

- **Address**: `0x71011f44e4`  ·  **depth 1**
- **Body size**: 108 bytes
- **Role**: —
- **Observed signature**:

```c
Lp::Sys::Framework::Framework(sead::GameFrameworkNx::CreateArg&) void __thiscall Lp::Sys::Framework::Framework(Framework *this,void *param_1)
```

_3 distinct call targets; 22 body lines_

### `Lp::Sys::getCpCallbackSeadAssert`

- **Address**: `0x71011f3774`  ·  **depth 1**
- **Body size**: 12 bytes
- **Role**: diagnostics / formatting
- **Observed signature**:

```c
Lp::Sys::getCpCallbackSeadAssert() undefined8 * Lp::Sys::getCpCallbackSeadAssert(void)
```

_1 distinct call targets; 6 body lines_

### `Lp::Sys::SysInit::Init`

- **Address**: `0x71011f5b20`  ·  **depth 0**
- **Body size**: 1308 bytes
- **Role**: boot entry / memory foundation
- **Observed signature**:

```c
WARNING: Removing unreachable block (ram,0x0071011f5fac) /* WARNING: Removing unreachable block (ram,0x0071011f5cb4) */ /* WARNING: Removing unreachable block (ram,0x0071011f5d8c) */ /* WARNING: Removing unreachable block (ram,0x0071011f6004) */ /* Lp::Sys::SysInit::Init() */ void Lp::Sys::SysInit::
```

_32 distinct call targets; 10 indirect call site(s); decompiler warnings present; 177 body lines_

### `sead::GameFrameworkNx::initialize`

- **Address**: `0x7100e6724c`  ·  **depth 1**
- **Body size**: 20 bytes
- **Role**: —
- **Observed signature**:

```c
sead::GameFrameworkNx::initialize(sead::Framework::InitializeArg const&) void sead::GameFrameworkNx::initialize(long *param_1)
```

_3 distinct call targets; 8 body lines_

### `sead::ForegroundBucketMgr::initialize`

- **Address**: `0x710139fb3c`  ·  **depth 1**
- **Body size**: 4 bytes
- **Role**: graphics
- **Observed signature**:

```c
void sead::ForegroundBucketMgr::initialize(void)
```

_1 distinct call targets; 6 body lines_

### `sead::Framework::InitializeArg`

- **Address**: `0x7100e69894`  ·  **depth 1**
- **Body size**: 12 bytes
- **Role**: —
- **Observed signature**:

```c
sead::Framework::InitializeArg::InitializeArg() void __thiscall sead::Framework::InitializeArg::InitializeArg(InitializeArg *this)
```

_1 distinct call targets; 8 body lines_

### `sead::GameFrameworkNx::initializeGraphicsSystem`

- **Address**: `0x7100e6738c`  ·  **depth 1**
- **Body size**: 2372 bytes
- **Role**: graphics bring-up
- **Observed signature**:

```c
nv::InitializeGraphics(pvVar11,(ulong)*(uint *)(this + 0xcc));
```

_35 distinct call targets; 27 indirect call site(s); 250 body lines_

### `sead::TaskBase::MgrTaskArg`

- **Address**: `0x7100e6b7bc`  ·  **depth 1**
- **Body size**: 308 bytes
- **Role**: —
- **Observed signature**:

```c
sead::TaskBase::MgrTaskArg::MgrTaskArg(sead::TaskClassID const&) void __thiscall sead::TaskBase::MgrTaskArg::MgrTaskArg(MgrTaskArg *this,undefined8 *param_1)
```

_1 distinct call targets; 87 body lines_

### `Lp::Sys::SysInit::nninitStartup`

- **Address**: `0x71011f5ab4`  ·  **depth 0**
- **Body size**: 108 bytes
- **Role**: boot entry / memory foundation
- **Observed signature**:

```c
Lp::Sys::SysInit::nninitStartup() void Lp::Sys::SysInit::nninitStartup(void)
```

_5 distinct call targets; 16 body lines_

### `_ZdaPv`

- **Address**: `0x7100e565b0`  ·  **depth 1**
- **Body size**: 100 bytes
- **Role**: —
- **Observed signature**:

```c
void operator_delete__(void *param_1)
```

_3 distinct call targets; 1 indirect call site(s); decompiler warnings present; 19 body lines_

### `_ZnwmPN4sead4HeapEi`

- **Address**: `0x7100e5629c`  ·  **depth 1**
- **Body size**: 116 bytes
- **Role**: —
- **Observed signature**:

```c
void * operator_new(size_t param_1,long *param_2,undefined4 param_3)
```

_4 distinct call targets; 1 indirect call site(s); decompiler warnings present; 19 body lines_

### `_ZnamPN4sead4HeapEi`

- **Address**: `0x7100e56310`  ·  **depth 1**
- **Body size**: 116 bytes
- **Role**: —
- **Observed signature**:

```c
void * operator_new__(size_t param_1,long *param_2,undefined4 param_3)
```

_3 distinct call targets; 1 indirect call site(s); decompiler warnings present; 19 body lines_

### `Lp::Sys::RootTask::parallelInitThreadFunc`

- **Address**: `0x71011fca28`  ·  **depth 0**
- **Body size**: 180 bytes
- **Role**: parallel-init orchestration
- **Observed signature**:

```c
Lp::Sys::RootTask::parallelInitThreadFunc(int) int __thiscall Lp::Sys::RootTask::parallelInitThreadFunc (undefined8 param_1_00,uint param_2,undefined8 param_3,undefined8 param_4, undefined8 param_5,undefined8 param_6,undefined8 param_7,undefined8 param_8)
```

_4 distinct call targets; 3 indirect call site(s); 29 body lines_

### `Lp::Sys::SysInit::printFromStartTime`

- **Address**: `0x71011f603c`  ·  **depth 1**
- **Body size**: 424 bytes
- **Role**: —
- **Observed signature**:

```c
Lp::Sys::SysInit::printFromStartTime(sead::SafeStringBase<char> const&) int Lp::Sys::SysInit::printFromStartTime(void)
```

_8 distinct call targets; 59 body lines_

### `sead::AssertConfig::registerCallback`

- **Address**: `0x7101397fac`  ·  **depth 1**
- **Body size**: 160 bytes
- **Role**: diagnostics / formatting
- **Observed signature**:

```c
void sead::AssertConfig::registerCallback(long param_1)
```

_3 distinct call targets; 1 indirect call site(s); 30 body lines_

### `Lp::Sys::WorkerThreadMgr::run`

- **Address**: `0x710123d8c0`  ·  **depth 1**
- **Body size**: 72 bytes
- **Role**: worker-thread dispatch
- **Observed signature**:

```c
Lp::Sys::WorkerThreadMgr::run(int, bool) undefined8 Lp::Sys::WorkerThreadMgr::run(long param_1,uint param_2)
```

_2 distinct call targets; 1 indirect call site(s); 21 body lines_

### `sead::Framework::RunArg`

- **Address**: `0x7100e698a0`  ·  **depth 1**
- **Body size**: 12 bytes
- **Role**: —
- **Observed signature**:

```c
sead::Framework::RunArg::RunArg() void __thiscall sead::Framework::RunArg::RunArg(RunArg *this)
```

_1 distinct call targets; 7 body lines_

### `Lp::Sys::RootTask::runParallelInitThread`

- **Address**: `0x71011fcb44`  ·  **depth 0**
- **Body size**: 96 bytes
- **Role**: parallel-init orchestration
- **Observed signature**:

```c
Lp::Sys::RootTask::runParallelInitThread(int) void __thiscall Lp::Sys::RootTask::runParallelInitThread(RootTask *this,undefined4 param_1)
```

_3 distinct call targets; 2 indirect call site(s); 17 body lines_

### `Lp::Utl::sleepCurThreadMilliSec`

- **Address**: `0x71012cdf50`  ·  **depth 1**
- **Body size**: 48 bytes
- **Role**: —
- **Observed signature**:

```c
Lp::Utl::sleepCurThreadMilliSec(long) void Lp::Utl::sleepCurThreadMilliSec(void)
```

_2 distinct call targets; 9 body lines_

### `Lp::Sys::RootTask::waitDoneParallelInitThread`

- **Address**: `0x71011fcba4`  ·  **depth 0**
- **Body size**: 56 bytes
- **Role**: parallel-init orchestration
- **Observed signature**:

```c
Lp::Sys::RootTask::waitDoneParallelInitThread() void __thiscall Lp::Sys::RootTask::waitDoneParallelInitThread(RootTask *this)
```

_2 distinct call targets; 12 body lines_

---

## Depth 2–3 — immediate support (73 functions)

### `__cxa_guard_acquire`

- **Address**: `0x7101412248`  ·  **depth 2**
- **Body size**: 13 bytes
- **Role**: —
- **Observed signature**:

```c
void __cxa_guard_acquire(void)
```

_1 distinct call targets; 6 body lines_

### `__cxa_guard_release`

- **Address**: `0x7101412258`  ·  **depth 2**
- **Body size**: 13 bytes
- **Role**: —
- **Observed signature**:

```c
void __cxa_guard_release(void)
```

_1 distinct call targets; 6 body lines_

### `__errno_location`

- **Address**: `0x7101413468`  ·  **depth 3**
- **Body size**: 13 bytes
- **Role**: —
- **Observed signature**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked int * __errno_location(void)
```

_1 distinct call targets; decompiler warnings present; 8 body lines_

### `sead::Heap::appendDisposer_`

- **Address**: `0x7100e7b29c`  ·  **depth 3**
- **Body size**: 120 bytes
- **Role**: —
- **Observed signature**:

```c
void __thiscall sead::Heap::appendDisposer_(Heap *this,long param_1)
```

_4 distinct call targets; 1 indirect call site(s); 20 body lines_

### `sead::DateUtil::calcWeekDay`

- **Address**: `0x7100ea8080`  ·  **depth 3**
- **Body size**: 192 bytes
- **Role**: time
- **Observed signature**:

```c
sead::DateUtil::calcWeekDay(sead::CalendarTime::Year const&, sead::CalendarTime::Month const&,
   sead::CalendarTime::Day const&) int sead::DateUtil::calcWeekDay(int *param_1,int *param_2,int *param_3)
```

_1 distinct call targets; 23 body lines_

### `sead::CalendarTime`

- **Address**: `0x7100ea75c4`  ·  **depth 2**
- **Body size**: 116 bytes
- **Role**: time
- **Observed signature**:

```c
sead::CalendarTime::CalendarTime(sead::CalendarTime::Year const&, sead::CalendarTime::Month
   const&, sead::CalendarTime::Day const&, sead::CalendarTime::Hour const&,
   sead::CalendarTime::Minute const&, sead::CalendarTime::Second const&) void __thiscall sead::CalendarTime::CalendarTime (Calen
```

_2 distinct call targets; 20 body lines_

### `sead::GraphicsNvn::convertNvnDebugLevel`

- **Address**: `0x7100e71100`  ·  **depth 2**
- **Body size**: 32 bytes
- **Role**: graphics
- **Observed signature**:

```c
sead::GraphicsNvn::convertNvnDebugLevel(unsigned int) undefined4 sead::GraphicsNvn::convertNvnDebugLevel(uint param_1)
```

_1 distinct call targets; 9 body lines_

### `sead::ThreadUtil::ConvertPrioritySeadToPlatform`

- **Address**: `0x7100e9a2ec`  ·  **depth 2**
- **Body size**: 4 bytes
- **Role**: —
- **Observed signature**:

```c
sead::ThreadUtil::ConvertPrioritySeadToPlatform(int) void sead::ThreadUtil::ConvertPrioritySeadToPlatform(void)
```

_1 distinct call targets; 6 body lines_

### `sead::FrameBufferNvn::create`

- **Address**: `0x7100e6ff90`  ·  **depth 2**
- **Body size**: 932 bytes
- **Role**: graphics
- **Observed signature**:

```c
void sead::FrameBufferNvn::create(long *param_1,undefined8 *param_2,uint param_3,uint param_4)
```

_7 distinct call targets; 92 body lines_

### `sead::ResourceMgr::createInstance`

- **Address**: `0x7100e8f150`  ·  **depth 3**
- **Body size**: 128 bytes
- **Role**: heap setup
- **Observed signature**:

```c
IDisposer * sead::ResourceMgr::createInstance(Heap *param_1)
```

_4 distinct call targets; 18 body lines_

### `sead::FileDeviceMgr::createInstance`

- **Address**: `0x7100e64760`  ·  **depth 3**
- **Body size**: 128 bytes
- **Role**: heap setup
- **Observed signature**:

```c
IDisposer * sead::FileDeviceMgr::createInstance(Heap *param_1)
```

_4 distinct call targets; 18 body lines_

### `sead::CriticalSection`

- **Address**: `0x7100e98ab0`  ·  **depth 2**
- **Body size**: 60 bytes
- **Role**: —
- **Observed signature**:

```c
sead::CriticalSection::CriticalSection() void __thiscall sead::CriticalSection::CriticalSection(CriticalSection *this)
```

_3 distinct call targets; 9 body lines_

### `sead::CalendarTime::Date`

- **Address**: `0x7100ea74e4`  ·  **depth 3**
- **Body size**: 72 bytes
- **Role**: time
- **Observed signature**:

```c
sead::CalendarTime::Date::Date(sead::CalendarTime::Year const&, sead::CalendarTime::Month const&,
   sead::CalendarTime::Day const&) void __thiscall sead::CalendarTime::Date::Date(Date *this,int *param_1,int *param_2,int *param_3)
```

_2 distinct call targets; 13 body lines_

### `sead::DateTime`

- **Address**: `0x7100ea7934`  ·  **depth 2**
- **Body size**: 8 bytes
- **Role**: time
- **Observed signature**:

```c
sead::DateTime::DateTime(unsigned long) void __thiscall sead::DateTime::DateTime(DateTime *this,undefined8 param_1)
```

_1 distinct call targets; 7 body lines_

### `sead::DelegateThread`

- **Address**: `0x7100e99804`  ·  **depth 2**
- **Body size**: 92 bytes
- **Role**: threading
- **Observed signature**:

```c
Thread::Thread((Thread *)this,param_1,param_3,param_4,param_5,param_6,param_7,param_8);
```

_2 distinct call targets; 17 body lines_

### `sead::DisplayBufferNvn`

- **Address**: `0x7100e70360`  ·  **depth 2**
- **Body size**: 56 bytes
- **Role**: graphics
- **Observed signature**:

```c
sead::DisplayBufferNvn::DisplayBufferNvn() void __thiscall sead::DisplayBufferNvn::DisplayBufferNvn(DisplayBufferNvn *this)
```

_1 distinct call targets; 21 body lines_

### `sead::DrawLockContext`

- **Address**: `0x7100eb9ed8`  ·  **depth 3**
- **Body size**: 28 bytes
- **Role**: —
- **Observed signature**:

```c
sead::DrawLockContext::DrawLockContext() void __thiscall sead::DrawLockContext::DrawLockContext(DrawLockContext *this)
```

_2 distinct call targets; 11 body lines_

### `Lp::Sys::WorkerThread::enqueue`

- **Address**: `0x710123ca44`  ·  **depth 2**
- **Body size**: 148 bytes
- **Role**: worker-thread dispatch
- **Observed signature**:

```c
undefined4 __thiscall Lp::Sys::WorkerThread::enqueue(WorkerThread *this,long param_1,ulong param_2)
```

_4 distinct call targets; 1 indirect call site(s); 26 body lines_

### `sead::ListNode::erase_`

- **Address**: `0x7100e56af4`  ·  **depth 2**
- **Body size**: 40 bytes
- **Role**: —
- **Observed signature**:

```c
sead::ListNode::erase_() void __thiscall sead::ListNode::erase_(ListNode *this)
```

_1 distinct call targets; 1 indirect call site(s); 14 body lines_

### `_ZNK4sead7HeapMgr15findContainHeapEPKv`

- **Address**: `0x7100e7c8f4`  ·  **depth 2**
- **Body size**: 504 bytes
- **Role**: heap query
- **Observed signature**:

```c
Heap * __thiscall sead::HeapMgr::findContainHeap(undefined8 param_1_00,undefined8 param_2)
```

_7 distinct call targets; 5 indirect call site(s); 111 body lines_

### `sead::Heap::findContainHeap_`

- **Address**: `0x7100e7b388`  ·  **depth 3**
- **Body size**: 200 bytes
- **Role**: heap query
- **Observed signature**:

```c
Heap * __thiscall sead::Heap::findContainHeap_(Heap *this,undefined8 param_1)
```

_1 distinct call targets; 5 indirect call site(s); 31 body lines_

### `free`

- **Address**: `0x7100dda114`  ·  **depth 2**
- **Body size**: 28 bytes
- **Role**: —
- **Observed signature**:

```c
void free(void *__ptr)
```

_2 distinct call targets; 9 body lines_

### `sead::GameFramework`

- **Address**: `0x7100e69c78`  ·  **depth 3**
- **Body size**: 100 bytes
- **Role**: —
- **Observed signature**:

```c
sead::GameFramework::GameFramework() void __thiscall sead::GameFramework::GameFramework(GameFramework *this)
```

_2 distinct call targets; 23 body lines_

### `sead::GameFrameworkNx`

- **Address**: `0x7100e67260`  ·  **depth 2**
- **Body size**: 224 bytes
- **Role**: —
- **Observed signature**:

```c
sead::GameFrameworkNx::GameFrameworkNx(sead::GameFrameworkNx::CreateArg const&) void __thiscall sead::GameFrameworkNx::GameFrameworkNx(GameFrameworkNx *this,void *param_1)
```

_5 distinct call targets; 34 body lines_

### `_ZNK4sead8DateTime15getCalendarTimeEPNS_12CalendarTimeE`

- **Address**: `0x7100ea7ce4`  ·  **depth 2**
- **Body size**: 480 bytes
- **Role**: time
- **Observed signature**:

```c
void __thiscall sead::DateTime::getCalendarTime(DateTime *this,CalendarTime *param_1)
```

_13 distinct call targets; 72 body lines_

### `_ZNK4sead7HeapMgr14getCurrentHeapEv`

- **Address**: `0x7100e7cf7c`  ·  **depth 2**
- **Body size**: 68 bytes
- **Role**: heap query
- **Observed signature**:

```c
sead::HeapMgr::getCurrentHeap() const undefined8 __thiscall sead::HeapMgr::getCurrentHeap(HeapMgr *this)
```

_2 distinct call targets; 1 indirect call site(s); 13 body lines_

### `sead::GraphicsNvn::getNewTextureId`

- **Address**: `0x7100e71018`  ·  **depth 3**
- **Body size**: 24 bytes
- **Role**: graphics
- **Observed signature**:

```c
sead::GraphicsNvn::getNewTextureId() void __thiscall sead::GraphicsNvn::getNewTextureId(GraphicsNvn *this)
```

_3 distinct call targets; 18 body lines_

### `sead::EnumUtil::getParseTextCS_`

- **Address**: `0x7100e7d734`  ·  **depth 3**
- **Body size**: 116 bytes
- **Role**: —
- **Observed signature**:

```c
sead::EnumUtil::getParseTextCS_() undefined * sead::EnumUtil::getParseTextCS_(void)
```

_5 distinct call targets; 12 body lines_

### `Lp::Sys::getThreadInfo`

- **Address**: `0x710123c29c`  ·  **depth 2**
- **Body size**: 384 bytes
- **Role**: —
- **Observed signature**:

```c
Lp::Sys::getThreadInfo(sead::SafeStringBase<char> const&) void __thiscall Lp::Sys::getThreadInfo(undefined4 *param_1,Sys *this)
```

_2 distinct call targets; 5 indirect call site(s); 67 body lines_

### `sead::Graphics`

- **Address**: `0x7100e9d050`  ·  **depth 3**
- **Body size**: 52 bytes
- **Role**: graphics
- **Observed signature**:

```c
sead::Graphics::Graphics() void __thiscall sead::Graphics::Graphics(Graphics *this)
```

_2 distinct call targets; 12 body lines_

### `sead::GraphicsNvn`

- **Address**: `0x7100e70d54`  ·  **depth 2**
- **Body size**: 192 bytes
- **Role**: graphics
- **Observed signature**:

```c
sead::GraphicsNvn::GraphicsNvn(sead::GraphicsNvn::CreateArg const&) void __thiscall sead::GraphicsNvn::GraphicsNvn(GraphicsNvn *this,undefined8 *param_1)
```

_3 distinct call targets; 1 indirect call site(s); decompiler warnings present; 38 body lines_

### `sead::Heap`

- **Address**: `0x7100e7ada8`  ·  **depth 3**
- **Body size**: 340 bytes
- **Role**: —
- **Observed signature**:

```c
IDisposer::IDisposer((IDisposer *)this,param_2,1);
```

_7 distinct call targets; 65 body lines_

### `sead::IDisposer`

- **Address**: `0x7100e76550`  ·  **depth 2**
- **Body size**: 144 bytes
- **Role**: —
- **Observed signature**:

```c
void __thiscall sead::IDisposer::IDisposer(IDisposer *this,Heap *param_1,uint param_2)
```

_4 distinct call targets; 34 body lines_

### `sead::GameFramework::initialize`

- **Address**: `0x7100e69fe4`  ·  **depth 2**
- **Body size**: 456 bytes
- **Role**: —
- **Observed signature**:

```c
sead::GameFramework::initialize(sead::Framework::InitializeArg const&) void sead::GameFramework::initialize(long *param_1)
```

_6 distinct call targets; 6 indirect call site(s); 54 body lines_

### `sead::PerformanceMgrNx::initialize`

- **Address**: `0x7100e68c44`  ·  **depth 2**
- **Body size**: 4 bytes
- **Role**: —
- **Observed signature**:

```c
sead::PerformanceMgrNx::initialize() void sead::PerformanceMgrNx::initialize(void)
```

_1 distinct call targets; 7 body lines_

### `sead::Graphics::initialize`

- **Address**: `0x7100e9d0ac`  ·  **depth 2**
- **Body size**: 116 bytes
- **Role**: graphics
- **Observed signature**:

```c
void __thiscall sead::Graphics::initialize(Graphics *this,long *param_1)
```

_5 distinct call targets; 4 indirect call site(s); 14 body lines_

### `sead::Framework::initialize`

- **Address**: `0x7100e698ac`  ·  **depth 3**
- **Body size**: 200 bytes
- **Role**: —
- **Observed signature**:

```c
sead::Framework::initialize(sead::Framework::InitializeArg const&) void sead::Framework::initialize(long *param_1)
```

_6 distinct call targets; 1 indirect call site(s); 29 body lines_

### `sead::PtrArrayImpl::insert`

- **Address**: `0x7100e57814`  ·  **depth 3**
- **Body size**: 132 bytes
- **Role**: —
- **Observed signature**:

```c
void __thiscall sead::PtrArrayImpl::insert(PtrArrayImpl *this,int param_1,undefined8 param_2)
```

_2 distinct call targets; 2 indirect call site(s); 17 body lines_

### `sead::ListNode::insertFront_`

- **Address**: `0x7100e56adc`  ·  **depth 2**
- **Body size**: 24 bytes
- **Role**: —
- **Observed signature**:

```c
void __thiscall sead::ListNode::insertFront_(ListNode *this,long *param_1)
```

_1 distinct call targets; 14 body lines_

### `sead::DateUtil::isLeapYear`

- **Address**: `0x7100ea8038`  ·  **depth 3**
- **Body size**: 72 bytes
- **Role**: time
- **Observed signature**:

```c
sead::DateUtil::isLeapYear(unsigned int) bool sead::DateUtil::isLeapYear(uint param_1)
```

_1 distinct call targets; 6 body lines_

### `sead::DrawLockContext::lock`

- **Address**: `0x7100eb9ef8`  ·  **depth 3**
- **Body size**: 8 bytes
- **Role**: —
- **Observed signature**:

```c
sead::DrawLockContext::lock() void __thiscall sead::DrawLockContext::lock(DrawLockContext *this)
```

_2 distinct call targets; 7 body lines_

### `sead::CriticalSection::lock`

- **Address**: `0x7100e98bd8`  ·  **depth 3**
- **Body size**: 8 bytes
- **Role**: —
- **Observed signature**:

```c
sead::CriticalSection::lock() void __thiscall sead::CriticalSection::lock(CriticalSection *this)
```

_2 distinct call targets; 7 body lines_

### `sead::CalendarTime::Month::makeFromValueOneOrigin`

- **Address**: `0x7100ea74bc`  ·  **depth 3**
- **Body size**: 8 bytes
- **Role**: time
- **Observed signature**:

```c
sead::CalendarTime::Month::makeFromValueOneOrigin(unsigned int) undefined4 sead::CalendarTime::Month::makeFromValueOneOrigin(undefined4 param_1)
```

_1 distinct call targets; 6 body lines_

### `malloc`

- **Address**: `0x7100dda0c0`  ·  **depth 2**
- **Body size**: 84 bytes
- **Role**: —
- **Observed signature**:

```c
void * malloc(size_t __size)
```

_3 distinct call targets; 16 body lines_

### `memcpy`

- **Address**: `0x7101412278`  ·  **depth 3**
- **Body size**: 13 bytes
- **Role**: —
- **Observed signature**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void * memcpy(void *__dest,void *__src,size_t __n)
```

_1 distinct call targets; decompiler warnings present; 8 body lines_

### `memset`

- **Address**: `0x7101412268`  ·  **depth 3**
- **Body size**: 13 bytes
- **Role**: —
- **Observed signature**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void * memset(void *__s,int __c,size_t __n)
```

_1 distinct call targets; decompiler warnings present; 8 body lines_

### `sead::EnumUtil::parseText_`

- **Address**: `0x7100e7d810`  ·  **depth 3**
- **Body size**: 248 bytes
- **Role**: —
- **Observed signature**:

```c
void sead::EnumUtil::parseText_(long param_1,byte *param_2,int param_3)
```

_1 distinct call targets; 67 body lines_

### `sead::ReadWriteLock`

- **Address**: `0x7100e998a8`  ·  **depth 2**
- **Body size**: 84 bytes
- **Role**: —
- **Observed signature**:

```c
sead::ReadWriteLock::ReadWriteLock() void __thiscall sead::ReadWriteLock::ReadWriteLock(ReadWriteLock *this)
```

_2 distinct call targets; 14 body lines_

### `sead::GraphicsNvn::registerDefaultCommandBuffer`

- **Address**: `0x7100e71048`  ·  **depth 2**
- **Body size**: 8 bytes
- **Role**: graphics
- **Observed signature**:

```c
sead::GraphicsNvn::registerDefaultCommandBuffer(GraphicsNvn *this,undefined8 param_1)
```

_1 distinct call targets; 8 body lines_

### `sead::GraphicsNvn::registerDisplayBufferNvn`

- **Address**: `0x7100e71050`  ·  **depth 2**
- **Body size**: 8 bytes
- **Role**: graphics
- **Observed signature**:

```c
void __thiscall sead::GraphicsNvn::registerDisplayBufferNvn(GraphicsNvn *this,undefined8 param_1)
```

_1 distinct call targets; 7 body lines_

### `sead::GraphicsNvn::registerQueue`

- **Address**: `0x7100e71040`  ·  **depth 2**
- **Body size**: 8 bytes
- **Role**: graphics
- **Observed signature**:

```c
void __thiscall sead::GraphicsNvn::registerQueue(GraphicsNvn *this,undefined8 param_1)
```

_1 distinct call targets; 7 body lines_

### `sead::Semaphore`

- **Address**: `0x7100eba538`  ·  **depth 3**
- **Body size**: 76 bytes
- **Role**: —
- **Observed signature**:

```c
sead::Semaphore::Semaphore(int, int) void __thiscall sead::Semaphore::Semaphore(Semaphore *this,int param_1,int param_2)
```

_3 distinct call targets; 9 body lines_

### `sead::Thread::setAffinity`

- **Address**: `0x7100e992cc`  ·  **depth 2**
- **Body size**: 56 bytes
- **Role**: threading
- **Observed signature**:

```c
sead::Thread::setAffinity(sead::CoreIdMask const&) void __thiscall sead::Thread::setAffinity(Thread *this,undefined4 *param_1)
```

_3 distinct call targets; 1 indirect call site(s); 11 body lines_

### `sead::HeapMgr::setCurrentHeap_`

- **Address**: `0x7100e7cfc0`  ·  **depth 3**
- **Body size**: 60 bytes
- **Role**: heap query
- **Observed signature**:

```c
undefined8 __thiscall sead::HeapMgr::setCurrentHeap_(undefined8 param_1_00,undefined8 param_2)
```

_2 distinct call targets; 1 indirect call site(s); 11 body lines_

### `sead::CalendarTime::setDate`

- **Address**: `0x7100ea7638`  ·  **depth 3**
- **Body size**: 60 bytes
- **Role**: time
- **Observed signature**:

```c
sead::CalendarTime::setDate(sead::CalendarTime::Date const&) void __thiscall sead::CalendarTime::setDate(CalendarTime *this,undefined8 *param_1)
```

_2 distinct call targets; 11 body lines_

### `sead::DateTime::setNow`

- **Address**: `0x7100ea7ec4`  ·  **depth 2**
- **Body size**: 204 bytes
- **Role**: time
- **Observed signature**:

```c
sead::DateTime::setNow() undefined8 __thiscall sead::DateTime::setNow(DateTime *this)
```

_12 distinct call targets; 39 body lines_

### `sead::DisplayBufferNvn::setPresentInterval`

- **Address**: `0x7100e70408`  ·  **depth 2**
- **Body size**: 36 bytes
- **Role**: graphics
- **Observed signature**:

```c
sead::DisplayBufferNvn::setPresentInterval(unsigned char) void __thiscall sead::DisplayBufferNvn::setPresentInterval(DisplayBufferNvn *this,DisplayBufferNvn param_2)
```

_1 distinct call targets; 2 indirect call site(s); decompiler warnings present; 14 body lines_

### `sead::DisplayBufferNvn::setTripleBuffer`

- **Address**: `0x7100e7042c`  ·  **depth 2**
- **Body size**: 20 bytes
- **Role**: graphics
- **Observed signature**:

```c
sead::DisplayBufferNvn::setTripleBuffer(bool) void __thiscall sead::DisplayBufferNvn::setTripleBuffer(DisplayBufferNvn *this,uint param_1)
```

_1 distinct call targets; 12 body lines_

### `sead::DateTime::setUnixTime`

- **Address**: `0x7100ea7940`  ·  **depth 3**
- **Body size**: 248 bytes
- **Role**: time
- **Observed signature**:

```c
sead::DateTime::setUnixTime(sead::CalendarTime::Year const&, sead::CalendarTime::Month const&,
   sead::CalendarTime::Day const&, sead::CalendarTime::Hour const&, sead::CalendarTime::Minute
   const&, sead::CalendarTime::Second const&) void __thiscall sead::DateTime::setUnixTime (DateTime *this,
```

_4 distinct call targets; 46 body lines_

### `sead::CalendarTime::Year::setValue`

- **Address**: `0x7100ea72dc`  ·  **depth 3**
- **Body size**: 8 bytes
- **Role**: time
- **Observed signature**:

```c
sead::CalendarTime::Year::setValue(unsigned int) void __thiscall sead::CalendarTime::Year::setValue(Year *this,undefined4 param_1)
```

_1 distinct call targets; 7 body lines_

### `sead::CalendarTime::Day::setValue`

- **Address**: `0x7100ea74c4`  ·  **depth 3**
- **Body size**: 8 bytes
- **Role**: time
- **Observed signature**:

```c
sead::CalendarTime::Day::setValue(unsigned int) void __thiscall sead::CalendarTime::Day::setValue(Day *this,undefined4 param_1)
```

_1 distinct call targets; 7 body lines_

### `sead::CalendarTime::Hour::setValue`

- **Address**: `0x7100ea74cc`  ·  **depth 3**
- **Body size**: 8 bytes
- **Role**: time
- **Observed signature**:

```c
sead::CalendarTime::Hour::setValue(unsigned int) void __thiscall sead::CalendarTime::Hour::setValue(Hour *this,undefined4 param_1)
```

_1 distinct call targets; 7 body lines_

### `sead::CalendarTime::Minute::setValue`

- **Address**: `0x7100ea74d4`  ·  **depth 3**
- **Body size**: 8 bytes
- **Role**: time
- **Observed signature**:

```c
sead::CalendarTime::Minute::setValue(unsigned int) void __thiscall sead::CalendarTime::Minute::setValue(Minute *this,undefined4 param_1)
```

_1 distinct call targets; 7 body lines_

### `sead::CalendarTime::Second::setValue`

- **Address**: `0x7100ea74dc`  ·  **depth 3**
- **Body size**: 8 bytes
- **Role**: time
- **Observed signature**:

```c
sead::CalendarTime::Second::setValue(unsigned int) void __thiscall sead::CalendarTime::Second::setValue(Second *this,undefined4 param_1)
```

_1 distinct call targets; 7 body lines_

### `sead::Thread::sleep`

- **Address**: `0x7100e99434`  ·  **depth 2**
- **Body size**: 20 bytes
- **Role**: threading
- **Observed signature**:

```c
sead::Thread::sleep(sead::TickSpan) void sead::Thread::sleep(void)
```

_3 distinct call targets; 8 body lines_

### `Lp::Sys::HeapGroup::Group::text_`

- **Address**: `0x71011f5908`  ·  **depth 2**
- **Body size**: 428 bytes
- **Role**: heap setup
- **Observed signature**:

```c
Lp::Sys::HeapGroup::Group::text_(int) undefined8 Lp::Sys::HeapGroup::Group::text_(uint param_1)
```

_9 distinct call targets; 2 indirect call site(s); 71 body lines_

### `sead::Thread`

- **Address**: `0x7100e98f50`  ·  **depth 3**
- **Body size**: 476 bytes
- **Role**: —
- **Observed signature**:

```c
IDisposer::IDisposer((IDisposer *)this);
```

_13 distinct call targets; 1 indirect call site(s); 67 body lines_

### `sead::CalendarTime::Time`

- **Address**: `0x7100ea752c`  ·  **depth 3**
- **Body size**: 28 bytes
- **Role**: time
- **Observed signature**:

```c
sead::CalendarTime::Time::Time(sead::CalendarTime::Hour const&, sead::CalendarTime::Minute
   const&, sead::CalendarTime::Second const&) void __thiscall sead::CalendarTime::Time::Time (Time *this,undefined4 *param_1,undefined4 *param_2,undefined4 *param_3)
```

_1 distinct call targets; 12 body lines_

### `sead::ExpHeap::tryCreate`

- **Address**: `0x7100e7678c`  ·  **depth 2**
- **Body size**: 696 bytes
- **Role**: heap setup
- **Observed signature**:

```c
Heap::Heap(pHVar5,param_2,param_3,pHVar5,uVar6,1,param_6 & 1);
```

_6 distinct call targets; 5 indirect call site(s); 131 body lines_

### `sead::DrawLockContext::unlock`

- **Address**: `0x7100eb9f00`  ·  **depth 3**
- **Body size**: 8 bytes
- **Role**: —
- **Observed signature**:

```c
sead::DrawLockContext::unlock() void __thiscall sead::DrawLockContext::unlock(DrawLockContext *this)
```

_2 distinct call targets; 7 body lines_

### `sead::CriticalSection::unlock`

- **Address**: `0x7100e98be8`  ·  **depth 3**
- **Body size**: 8 bytes
- **Role**: —
- **Observed signature**:

```c
sead::CriticalSection::unlock() void __thiscall sead::CriticalSection::unlock(CriticalSection *this)
```

_2 distinct call targets; 7 body lines_

### `sead::StringUtil::vsnprintf`

- **Address**: `0x7100e8b3b8`  ·  **depth 2**
- **Body size**: 148 bytes
- **Role**: —
- **Observed signature**:

```c
int sead::StringUtil::vsnprintf(long param_1,ulong param_2,undefined8 param_3,undefined8 *param_4)
```

_2 distinct call targets; 27 body lines_

### `Lp::Sys::WorkerThread`

- **Address**: `0x710123c920`  ·  **depth 3**
- **Body size**: 164 bytes
- **Role**: —
- **Observed signature**:

```c
Lp::Sys::WorkerThread::WorkerThread(Lp::Sys::WorkerThread::CreateArg const&) void __thiscall Lp::Sys::WorkerThread::WorkerThread(WorkerThread *this,long *param_1)
```

_5 distinct call targets; 1 indirect call site(s); decompiler warnings present; 26 body lines_

---

## Depth 4+ — deeper dependencies (22 functions)

### `sead::MessageQueue::allocate`

- **Address**: `0x7100eba35c`  ·  **depth 4**
- **Body size**: 108 bytes
- **Role**: —
- **Observed signature**:

```c
void __thiscall sead::MessageQueue::allocate(MessageQueue *this,ulong param_2_00,long *param_2)
```

_5 distinct call targets; 23 body lines_

### `sead::PtrArrayImpl::allocBuffer`

- **Address**: `0x7100e575e0`  ·  **depth 4**
- **Body size**: 84 bytes
- **Role**: —
- **Observed signature**:

```c
sead::PtrArrayImpl::allocBuffer(PtrArrayImpl *this,int param_1,long *param_2,undefined4 param_3)
```

_2 distinct call targets; 16 body lines_

### `sead::ThreadMgr::createInstance`

- **Address**: `0x7100e995d8`  ·  **depth 4**
- **Body size**: 136 bytes
- **Role**: heap setup
- **Observed signature**:

```c
ThreadMgr * sead::ThreadMgr::createInstance(Heap *param_1)
```

_4 distinct call targets; 18 body lines_

### `sead::GlobalRandom::createInstance`

- **Address**: `0x7100ea1f54`  ·  **depth 4**
- **Body size**: 136 bytes
- **Role**: heap setup
- **Observed signature**:

```c
Random * sead::GlobalRandom::createInstance(Heap *param_1)
```

_4 distinct call targets; 18 body lines_

### `sead::FileDeviceMgr`

- **Address**: `0x7100e64864`  ·  **depth 4**
- **Body size**: 204 bytes
- **Role**: filesystem
- **Observed signature**:

```c
sead::FileDeviceMgr::FileDeviceMgr() void __thiscall sead::FileDeviceMgr::FileDeviceMgr(FileDeviceMgr *this)
```

_8 distinct call targets; 32 body lines_

### `sead::FindContainHeapCache`

- **Address**: `0x7100e7d060`  ·  **depth 4**
- **Body size**: 8 bytes
- **Role**: —
- **Observed signature**:

```c
sead::FindContainHeapCache::FindContainHeapCache() void __thiscall sead::FindContainHeapCache::FindContainHeapCache(FindContainHeapCache *this)
```

_1 distinct call targets; 7 body lines_

### `sead::Framework`

- **Address**: `0x7100e696a4`  ·  **depth 4**
- **Body size**: 60 bytes
- **Role**: —
- **Observed signature**:

```c
sead::Framework::Framework() void __thiscall sead::Framework::Framework(Framework *this)
```

_1 distinct call targets; 20 body lines_

### `<no symbol>`

- **Address**: `0x710000019c`  ·  **depth 7**
- **Body size**: 8 bytes
- **Role**: —
- **Observed signature**:

```c
undefined8 FUN_710000019c(void)
```

_1 distinct call targets; 5 body lines_

### `sead::Random::init`

- **Address**: `0x7100ea202c`  ·  **depth 5**
- **Body size**: 96 bytes
- **Role**: —
- **Observed signature**:

```c
sead::Random::init() void __thiscall sead::Random::init(Random *this)
```

_2 distinct call targets; 17 body lines_

### `sead::HeapMgr::initialize`

- **Address**: `0x7100e7c6b8`  ·  **depth 4**
- **Body size**: 216 bytes
- **Role**: heap query
- **Observed signature**:

```c
void sead::HeapMgr::initialize(undefined8 *param_1)
```

_2 distinct call targets; 1 indirect call site(s); 29 body lines_

### `sead::ThreadMgr::initialize`

- **Address**: `0x7100e99eb4`  ·  **depth 4**
- **Body size**: 4 bytes
- **Role**: threading
- **Observed signature**:

```c
void __thiscall sead::ThreadMgr::initialize(ThreadMgr *this,long *param_1)
```

_8 distinct call targets; 1 indirect call site(s); 26 body lines_

### `sead::Arena::initialize`

- **Address**: `0x7100eb9f1c`  ·  **depth 5**
- **Body size**: 52 bytes
- **Role**: —
- **Observed signature**:

```c
sead::Arena::initialize(unsigned long) void __thiscall sead::Arena::initialize(Arena *this,long param_1)
```

_2 distinct call targets; 8 body lines_

### `sead::ThreadMgr::initMainThread_`

- **Address**: `0x7100e996b8`  ·  **depth 5**
- **Body size**: 184 bytes
- **Role**: threading
- **Observed signature**:

```c
void __thiscall sead::ThreadMgr::initMainThread_(ThreadMgr *this,long *param_1)
```

_8 distinct call targets; 1 indirect call site(s); 26 body lines_

### `sead::MainFileDevice`

- **Address**: `0x7100e656ac`  ·  **depth 5**
- **Body size**: 424 bytes
- **Role**: filesystem
- **Observed signature**:

```c
void __thiscall sead::MainFileDevice::MainFileDevice(MainFileDevice *this,long *param_1)
```

_6 distinct call targets; 3 indirect call site(s); 71 body lines_

### `memmove`

- **Address**: `0x7101412438`  ·  **depth 4**
- **Body size**: 13 bytes
- **Role**: —
- **Observed signature**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void * memmove(void *__dest,void *__src,size_t __n)
```

_1 distinct call targets; decompiler warnings present; 8 body lines_

### `sead::MessageQueue`

- **Address**: `0x7100eba350`  ·  **depth 4**
- **Body size**: 8 bytes
- **Role**: —
- **Observed signature**:

```c
sead::MessageQueue::MessageQueue() void __thiscall sead::MessageQueue::MessageQueue(MessageQueue *this)
```

_1 distinct call targets; 7 body lines_

### `sead::FileDeviceMgr::mount`

- **Address**: `0x7100e64990`  ·  **depth 5**
- **Body size**: 472 bytes
- **Role**: filesystem
- **Observed signature**:

```c
void __thiscall sead::FileDeviceMgr::mount(FileDeviceMgr *this,long param_1,long *param_2)
```

_4 distinct call targets; 9 indirect call site(s); 75 body lines_

### `sead::NinContentFileDevice`

- **Address**: `0x7100eb7150`  ·  **depth 6**
- **Body size**: 92 bytes
- **Role**: filesystem
- **Observed signature**:

```c
sead::NinContentFileDevice::NinContentFileDevice() void __thiscall sead::NinContentFileDevice::NinContentFileDevice(NinContentFileDevice *this)
```

_2 distinct call targets; 16 body lines_

### `sead::NinFileDeviceBase`

- **Address**: `0x7100eb734c`  ·  **depth 7**
- **Body size**: 392 bytes
- **Role**: filesystem
- **Observed signature**:

```c
sead::NinFileDeviceBase::NinFileDeviceBase(sead::SafeStringBase<char> const&,
   sead::SafeStringBase<char> const&) void __thiscall sead::NinFileDeviceBase::NinFileDeviceBase(NinFileDeviceBase *this,long *param_1,long param_2)
```

_4 distinct call targets; 6 indirect call site(s); 69 body lines_

### `_ZnamPN4sead4HeapEiRKSt9nothrow_t`

- **Address**: `0x7100e564d8`  ·  **depth 5**
- **Body size**: 116 bytes
- **Role**: —
- **Observed signature**:

```c
void * operator_new__(size_t param_1,long *param_2,undefined4 param_3)
```

_3 distinct call targets; 1 indirect call site(s); decompiler warnings present; 19 body lines_

### `sead::ResourceMgr`

- **Address**: `0x7100e8f238`  ·  **depth 4**
- **Body size**: 380 bytes
- **Role**: —
- **Observed signature**:

```c
sead::ResourceMgr::ResourceMgr() void __thiscall sead::ResourceMgr::ResourceMgr(ResourceMgr *this)
```

_8 distinct call targets; 1 indirect call site(s); 70 body lines_

### `sead::ThreadMgr`

- **Address**: `0x7100e99e68`  ·  **depth 5**
- **Body size**: 76 bytes
- **Role**: threading
- **Observed signature**:

```c
sead::ThreadMgr::ThreadMgr() void __thiscall sead::ThreadMgr::ThreadMgr(ThreadMgr *this)
```

_3 distinct call targets; 15 body lines_

---

## Notes

- Signatures are **observed**, not declared; argument naming and types are
  Ghidra's inference from the body.
- **Signature recovery is approximate for some functions.** Ghidra wraps the
  return type and the name/argument list across lines, and for functions with
  unusual prologues the reassembly can pick a body fragment instead. Entries
  whose signature looks like a statement rather than a declaration should be
  read from the raw pseudocode, which `tools/ghidra/ExtractDecompiled.py`
  regenerates on demand.
- **Names come from the address index, not Ghidra.** Ghidra prints the bare
  member name (`create`); the namespace-qualified name (`sead::ExpHeap::create`)
  is joined in from `engine-addrs-index.txt`.
- Depth is distance from the six boot roots in the decoded call graph.
  Depth 0–1 is what boot touches first — implement that band first.
- Full pseudocode is reproducible with `tools/ghidra/ExtractDecompiled.py`
  and is not committed, since it is Ghidra's rendering of Nintendo's code.
- Together with [PLATFORM_REFERENCE.md](PLATFORM_REFERENCE.md) this covers
  every named function in the boot closure (51 platform + 126 engine = 177).
