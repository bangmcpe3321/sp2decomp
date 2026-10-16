# Platform implementation reference

Observed contracts for the 51 platform functions in
[PORT_WORKLIST.md](PORT_WORKLIST.md), taken from the decompiled binary rather
than from a header.

**Why this matters:** `open-ead/nnsdk` ships no `include/nn/os/` headers, so
`nn::os` signatures are documented nowhere public. These signatures are read
off the shipped code, which makes them the authoritative contract.

Source: `platform-decompiled.txt` (Ghidra 12.1.2 via REA provider).
Functions: 51.

---

## Phase 1: `nn::os` — 24 functions

### `nn::os::AllocateMemoryBlock`

- **Address**: `0x7101413ec8`
- **Body size**: 13 bytes
- **Role**: allocator
- **Boot-closure callers**: Lp::Sys::SysInit::nninitStartup, sead::Arena::initialize
- **Observed signature**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void nn::os::AllocateMemoryBlock(ulong *param_1,ulong param_2)
```

_Body: 1 distinct call targets; contains decompiler warnings; 7 body lines_

### `nn::os::GetSystemTick`

- **Address**: `0x7101412298`
- **Body size**: 13 bytes
- **Role**: time
- **Boot-closure callers**: Lp::Sys::SysInit::Init, Lp::Sys::Framework, Lp::Sys::SysInit::printFromStartTime
- **Observed signature**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void nn::os::GetSystemTick(void)
```

_Body: 1 distinct call targets; contains decompiler warnings; 7 body lines_

### `nn::os::QueryMemoryInfo`

- **Address**: `0x71014141e8`
- **Body size**: 13 bytes
- **Role**: query / control
- **Boot-closure callers**: Lp::Sys::SysInit::nninitStartup, Lp::Sys::SysInit::Init, Lp::Utl::dumpMemoryInfo
- **Observed signature**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void nn::os::QueryMemoryInfo(MemoryInfo *param_1)
```

_Body: 1 distinct call targets; contains decompiler warnings; 7 body lines_

### `nn::os::SetMemoryHeapSize`

- **Address**: `0x71014141f8`
- **Body size**: 13 bytes
- **Role**: allocator
- **Boot-closure callers**: Lp::Sys::SysInit::nninitStartup
- **Observed signature**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void nn::os::SetMemoryHeapSize(ulong param_1)
```

_Body: 1 distinct call targets; contains decompiler warnings; 7 body lines_

### `nn::os::ConvertToTimeSpan`

- **Address**: `0x7101412c08`
- **Body size**: 13 bytes
- **Role**: time
- **Boot-closure callers**: sead::Thread::sleep
- **Observed signature**:

```c
void nn::os::ConvertToTimeSpan(void)
```

_Body: 1 distinct call targets; 6 body lines_

### `nn::os::GetThreadAvailableCoreMask`

- **Address**: `0x7101412d98`
- **Body size**: 13 bytes
- **Role**: query / control
- **Boot-closure callers**: sead::Thread::setAffinity, sead::Thread
- **Observed signature**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void nn::os::GetThreadAvailableCoreMask(void)
```

_Body: 1 distinct call targets; contains decompiler warnings; 7 body lines_

### `nn::os::GetTlsValue`

- **Address**: `0x71014125e8`
- **Body size**: 13 bytes
- **Role**: TLS slot management
- **Boot-closure callers**: _ZNK4sead7HeapMgr14getCurrentHeapEv, _ZNK4sead7HeapMgr15findContainHeapEPKv, sead::HeapMgr::setCurrentHeap_
- **Observed signature**:

```c
void nn::os::GetTlsValue(void)
```

_Body: 1 distinct call targets; 6 body lines_

### `nn::os::InitializeMutex`

- **Address**: `0x7101412b38`
- **Body size**: 13 bytes
- **Role**: initialiser
- **Boot-closure callers**: sead::CriticalSection
- **Observed signature**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void nn::os::InitializeMutex(MutexType *param_1,bool param_2,int param_3)
```

_Body: 1 distinct call targets; contains decompiler warnings; 7 body lines_

### `nn::os::SetThreadCoreMask`

- **Address**: `0x7101412da8`
- **Body size**: 13 bytes
- **Role**: query / control
- **Boot-closure callers**: sead::Thread::setAffinity, sead::Thread
- **Observed signature**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void nn::os::SetThreadCoreMask(ThreadType *param_1,int param_2,ulong param_3)
```

_Body: 1 distinct call targets; contains decompiler warnings; 7 body lines_

### `nn::os::SleepThread`

- **Address**: `0x7101412d48`
- **Body size**: 13 bytes
- **Role**: thread primitive
- **Boot-closure callers**: sead::Thread::sleep
- **Observed signature**:

```c
void nn::os::SleepThread(void)
```

_Body: 1 distinct call targets; 6 body lines_

### `nn::os::CreateThread`

- **Address**: `0x7101412ce8`
- **Body size**: 13 bytes
- **Role**: initialiser
- **Boot-closure callers**: sead::Thread
- **Observed signature**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void nn::os::CreateThread (ThreadType *param_1,_func_void_void_ptr *param_2,void *param_3,void *param_4, ulong param_5,int param_6)
```

_Body: 1 distinct call targets; contains decompiler warnings; 9 body lines_

### `nn::os::InitializeSemaphore`

- **Address**: `0x7101413ee8`
- **Body size**: 13 bytes
- **Role**: initialiser
- **Boot-closure callers**: sead::Semaphore
- **Observed signature**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void nn::os::InitializeSemaphore(SemaphoreType *param_1,int param_2,int param_3)
```

_Body: 1 distinct call targets; contains decompiler warnings; 7 body lines_

### `nn::os::LockMutex`

- **Address**: `0x7101412b48`
- **Body size**: 13 bytes
- **Role**: lock primitive
- **Boot-closure callers**: sead::CriticalSection::lock
- **Observed signature**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void nn::os::LockMutex(MutexType *param_1)
```

_Body: 1 distinct call targets; contains decompiler warnings; 7 body lines_

### `nn::os::SetThreadName`

- **Address**: `0x7101412cf8`
- **Body size**: 13 bytes
- **Role**: query / control
- **Boot-closure callers**: sead::Thread
- **Observed signature**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void nn::os::SetThreadName(ThreadType *param_1,char *param_2)
```

_Body: 1 distinct call targets; contains decompiler warnings; 7 body lines_

### `nn::os::UnlockMutex`

- **Address**: `0x7101412b68`
- **Body size**: 13 bytes
- **Role**: lock primitive
- **Boot-closure callers**: sead::CriticalSection::unlock
- **Observed signature**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void nn::os::UnlockMutex(MutexType *param_1)
```

_Body: 1 distinct call targets; contains decompiler warnings; 7 body lines_

### `nn::os::InitializeMessageQueue`

- **Address**: `0x7101412c48`
- **Body size**: 13 bytes
- **Role**: initialiser
- **Boot-closure callers**: sead::MessageQueue::allocate
- **Observed signature**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void nn::os::InitializeMessageQueue(MessageQueueType *param_1,ulong *param_2,ulong param_3)
```

_Body: 1 distinct call targets; contains decompiler warnings; 7 body lines_

### `nn::os::AllocateTlsSlot`

- **Address**: `0x7101413df8`
- **Body size**: 13 bytes
- **Role**: TLS slot management
- **Boot-closure callers**: sead::ThreadMgr
- **Observed signature**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void nn::os::AllocateTlsSlot(TlsSlot *param_1,_func_void_ulong *param_2)
```

_Body: 1 distinct call targets; contains decompiler warnings; 7 body lines_

### `nn::os::ChangeThreadPriority`

- **Address**: `0x7101412d88`
- **Body size**: 13 bytes
- **Role**: query / control
- **Boot-closure callers**: sead::ThreadMgr::initMainThread_
- **Observed signature**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void nn::os::ChangeThreadPriority(ThreadType *param_1,int param_2)
```

_Body: 1 distinct call targets; contains decompiler warnings; 7 body lines_

### `nn::os::GetCurrentCoreNumber`

- **Address**: `0x71014126b8`
- **Body size**: 13 bytes
- **Role**: query / control
- **Boot-closure callers**: sead::ThreadMgr::initMainThread_
- **Observed signature**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void nn::os::GetCurrentCoreNumber(void)
```

_Body: 1 distinct call targets; contains decompiler warnings; 7 body lines_

### `nn::os::GetCurrentThread`

- **Address**: `0x7101412db8`
- **Body size**: 13 bytes
- **Role**: thread primitive
- **Boot-closure callers**: sead::ThreadMgr::initMainThread_
- **Observed signature**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void nn::os::GetCurrentThread(void)
```

_Body: 1 distinct call targets; contains decompiler warnings; 7 body lines_

### `nn::os::GetThreadId`

- **Address**: `0x7101413de8`
- **Body size**: 13 bytes
- **Role**: query / control
- **Boot-closure callers**: sead::ThreadMgr::initMainThread_
- **Observed signature**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void nn::os::GetThreadId(ThreadType *param_1)
```

_Body: 1 distinct call targets; contains decompiler warnings; 7 body lines_

### `nn::os::SetTlsValue`

- **Address**: `0x7101412d08`
- **Body size**: 13 bytes
- **Role**: TLS slot management
- **Boot-closure callers**: sead::ThreadMgr::initMainThread_
- **Observed signature**:

```c
void nn::os::SetTlsValue(void)
```

_Body: 1 distinct call targets; 6 body lines_

### `nn::os::GetCurrentStackInfo`

- **Address**: `0x7101412d28`
- **Body size**: 13 bytes
- **Role**: query / control
- **Boot-closure callers**: sead::Thread
- **Observed signature**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void nn::os::GetCurrentStackInfo(ulong *param_1,ulong *param_2)
```

_Body: 1 distinct call targets; contains decompiler warnings; 7 body lines_

### `nn::os::GetThreadPriority`

- **Address**: `0x7101412d18`
- **Body size**: 13 bytes
- **Role**: query / control
- **Boot-closure callers**: sead::Thread
- **Observed signature**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void nn::os::GetThreadPriority(ThreadType *param_1)
```

_Body: 1 distinct call targets; contains decompiler warnings; 7 body lines_

---

## Phase 4: `nn::vi` — 6 functions

### `nn::vi::CreateLayer`

- **Address**: `0x7101413d18`
- **Body size**: 13 bytes
- **Role**: initialiser
- **Boot-closure callers**: sead::GameFrameworkNx::initializeGraphicsSystem
- **Observed signature**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void nn::vi::CreateLayer(Layer **param_1,Display *param_2)
```

_Body: 1 distinct call targets; contains decompiler warnings; 7 body lines_

### `nn::vi::GetDisplayVsyncEvent`

- **Address**: `0x7101413d38`
- **Body size**: 13 bytes
- **Role**: display / video interface
- **Boot-closure callers**: sead::GameFrameworkNx::initializeGraphicsSystem
- **Observed signature**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void nn::vi::GetDisplayVsyncEvent(SystemEventType *param_1,Display *param_2)
```

_Body: 1 distinct call targets; contains decompiler warnings; 7 body lines_

### `nn::vi::GetNativeWindow`

- **Address**: `0x7101413d58`
- **Body size**: 13 bytes
- **Role**: display / video interface
- **Boot-closure callers**: sead::GameFrameworkNx::initializeGraphicsSystem
- **Observed signature**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void nn::vi::GetNativeWindow(void **param_1,Layer *param_2)
```

_Body: 1 distinct call targets; contains decompiler warnings; 7 body lines_

### `nn::vi::Initialize`

- **Address**: `0x7101413cf8`
- **Body size**: 13 bytes
- **Role**: initialiser
- **Boot-closure callers**: sead::GameFrameworkNx::initializeGraphicsSystem
- **Observed signature**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void nn::vi::Initialize(void)
```

_Body: 1 distinct call targets; contains decompiler warnings; 7 body lines_

### `nn::vi::OpenDefaultDisplay`

- **Address**: `0x7101413d08`
- **Body size**: 13 bytes
- **Role**: filesystem / romfs
- **Boot-closure callers**: sead::GameFrameworkNx::initializeGraphicsSystem
- **Observed signature**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void nn::vi::OpenDefaultDisplay(Display **param_1)
```

_Body: 1 distinct call targets; contains decompiler warnings; 7 body lines_

### `nn::vi::SetLayerScalingMode`

- **Address**: `0x7101413d28`
- **Body size**: 13 bytes
- **Role**: display / video interface
- **Boot-closure callers**: sead::GameFrameworkNx::initializeGraphicsSystem
- **Observed signature**:

```c
void nn::vi::SetLayerScalingMode(void)
```

_Body: 1 distinct call targets; 6 body lines_

---

## Phase 1: `nn::mem` — 5 functions

### `nn::mem::StandardAllocator`

- **Address**: `0x7101413038`
- **Body size**: 13 bytes
- **Role**: allocator
- **Boot-closure callers**: nn::init::InitializeAllocator
- **Observed signature**:

```c
void __thiscall nn::mem::StandardAllocator::StandardAllocator(StandardAllocator *this)
```

_Body: 1 distinct call targets; 6 body lines_

### `nn::mem::StandardAllocator`

- **Address**: `0x7101413cd8`
- **Body size**: 13 bytes
- **Role**: allocator
- **Boot-closure callers**: sead::GameFrameworkNx::initializeGraphicsSystem
- **Observed signature**:

```c
nn::mem::StandardAllocator::StandardAllocator(StandardAllocator *this,void *param_1,ulong param_2)
```

_Body: 1 distinct call targets; 7 body lines_

### `nn::mem::StandardAllocator::Initialize`

- **Address**: `0x7101413008`
- **Body size**: 13 bytes
- **Role**: initialiser
- **Boot-closure callers**: nn::init::InitializeAllocator
- **Observed signature**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void nn::mem::StandardAllocator::Initialize(void *param_1,ulong param_2)
```

_Body: 1 distinct call targets; contains decompiler warnings; 7 body lines_

### `nn::mem::StandardAllocator::Allocate`

- **Address**: `0x7101412ee8`
- **Body size**: 13 bytes
- **Role**: allocator
- **Boot-closure callers**: malloc
- **Observed signature**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void nn::mem::StandardAllocator::Allocate(ulong param_1)
```

_Body: 1 distinct call targets; contains decompiler warnings; 7 body lines_

### `nn::mem::StandardAllocator::Free`

- **Address**: `0x7101412ef8`
- **Body size**: 13 bytes
- **Role**: allocator
- **Boot-closure callers**: free
- **Observed signature**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void nn::mem::StandardAllocator::Free(void *param_1)
```

_Body: 1 distinct call targets; contains decompiler warnings; 7 body lines_

---

## Phase 4: `nv / nvn` — 5 functions

### `nv::InitializeGraphics`

- **Address**: `0x7101413cc8`
- **Body size**: 13 bytes
- **Role**: initialiser
- **Boot-closure callers**: sead::GameFrameworkNx::initializeGraphicsSystem
- **Observed signature**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void nv::InitializeGraphics(void *param_1,ulong param_2)
```

_Body: 1 distinct call targets; contains decompiler warnings; 7 body lines_

### `nv::SetGraphicsAllocator`

- **Address**: `0x7101413cb8`
- **Body size**: 13 bytes
- **Role**: allocator
- **Boot-closure callers**: sead::GameFrameworkNx::initializeGraphicsSystem
- **Observed signature**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void nv::SetGraphicsAllocator (_func_void_ptr_ulong_ulong_void_ptr *param_1,_func_void_void_ptr_void_ptr *param_2, _func_void_ptr_void_ptr_ulong_void_ptr *param_3,void *param_4)
```

_Body: 1 distinct call targets; contains decompiler warnings; 9 body lines_

### `nv::SetGraphicsDevtoolsAllocator`

- **Address**: `0x7101413ce8`
- **Body size**: 13 bytes
- **Role**: allocator
- **Boot-closure callers**: sead::GameFrameworkNx::initializeGraphicsSystem
- **Observed signature**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void nv::SetGraphicsDevtoolsAllocator (_func_void_ptr_ulong_ulong_void_ptr *param_1,_func_void_void_ptr_void_ptr *param_2, _func_void_ptr_void_ptr_ulong_void_ptr *param_3,void *param_4)
```

_Body: 1 distinct call targets; contains decompiler warnings; 9 body lines_

### `nvnBootstrapLoader`

- **Address**: `0x7101413d48`
- **Body size**: 13 bytes
- **Role**: NVN bootstrap
- **Boot-closure callers**: sead::GameFrameworkNx::initializeGraphicsSystem
- **Observed signature**:

```c
void nvnBootstrapLoader(void)
```

_Body: 1 distinct call targets; 6 body lines_

### `nvnLoadCProcs`

- **Address**: `0x7100ddd6e4`
- **Body size**: 12712 bytes
- **Role**: NVN bootstrap
- **Boot-closure callers**: sead::GameFrameworkNx::initializeGraphicsSystem
- **Observed signature**:

```c
void nvnLoadCProcs(undefined8 param_1,undefined *param_2)
```

_Body: 1 distinct call targets; 913 body lines_

---

## Phase 2: `nn::time` — 4 functions

### `nn::time::Initialize`

- **Address**: `0x7101413048`
- **Body size**: 13 bytes
- **Role**: initialiser
- **Boot-closure callers**: sead::DateTime::setNow
- **Observed signature**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void nn::time::Initialize(void)
```

_Body: 1 distinct call targets; contains decompiler warnings; 7 body lines_

### `nn::time::IsInitialized`

- **Address**: `0x7101413e28`
- **Body size**: 13 bytes
- **Role**: query / control
- **Boot-closure callers**: sead::DateTime::setNow
- **Observed signature**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void nn::time::IsInitialized(void)
```

_Body: 1 distinct call targets; contains decompiler warnings; 7 body lines_

### `nn::time::StandardUserSystemClock::GetCurrentTime`

- **Address**: `0x7101412eb8`
- **Body size**: 13 bytes
- **Role**: time
- **Boot-closure callers**: sead::DateTime::setNow
- **Observed signature**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void nn::time::StandardUserSystemClock::GetCurrentTime(PosixTime *param_1)
```

_Body: 1 distinct call targets; contains decompiler warnings; 7 body lines_

### `nn::time::ToCalendarTime`

- **Address**: `0x7101412ec8`
- **Body size**: 13 bytes
- **Role**: time
- **Boot-closure callers**: sead::DateTime::setNow
- **Observed signature**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void nn::time::ToCalendarTime (CalendarTime *param_1,CalendarAdditionalInfo *param_2,PosixTime *param_3)
```

_Body: 1 distinct call targets; contains decompiler warnings; 8 body lines_

---

## Phase 3: `nn::fs` — 2 functions

### `nn::fs::MountRom`

- **Address**: `0x7101413ca8`
- **Body size**: 13 bytes
- **Role**: filesystem / romfs
- **Boot-closure callers**: sead::FileDeviceMgr
- **Observed signature**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void nn::fs::MountRom(char *param_1,void *param_2,ulong param_3)
```

_Body: 1 distinct call targets; contains decompiler warnings; 7 body lines_

### `nn::fs::QueryMountRomCacheSize`

- **Address**: `0x7101413c98`
- **Body size**: 13 bytes
- **Role**: filesystem / romfs
- **Boot-closure callers**: sead::FileDeviceMgr
- **Observed signature**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void nn::fs::QueryMountRomCacheSize(ulong *param_1)
```

_Body: 1 distinct call targets; contains decompiler warnings; 7 body lines_

---

## Phase 1: `nn::init` — 1 function

### `nn::init::InitializeAllocator`

- **Address**: `0x7100dda018`
- **Body size**: 80 bytes
- **Role**: initialiser
- **Boot-closure callers**: Lp::Sys::SysInit::nninitStartup
- **Observed signature**:

```c
void nn::init::InitializeAllocator(ulong param_1)
```

_Body: 3 distinct call targets; 9 body lines_

---

## Phase 2: `nn::nifm` — 1 function

### `nn::nifm::Initialize`

- **Address**: `0x7101413268`
- **Body size**: 13 bytes
- **Role**: initialiser
- **Boot-closure callers**: Lp::Sys::SysInit::Init
- **Observed signature**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void nn::nifm::Initialize(void)
```

_Body: 1 distinct call targets; contains decompiler warnings; 7 body lines_

---

## Phase 2: `nn::diag` — 1 function

### `nn::diag::detail::LogImpl`

- **Address**: `0x7101412708`
- **Body size**: 13 bytes
- **Role**: logging
- **Boot-closure callers**: Lp::Utl::dumpDateTime, Lp::Utl::dumpMemoryInfo
- **Observed signature**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void nn::diag::detail::LogImpl(LogMetaData *param_1,char *param_2,...)
```

_Body: 1 distinct call targets; contains decompiler warnings; 7 body lines_

---

## Phase 2: `nn::oe` — 1 function

### `nn::oe::Initialize`

- **Address**: `0x71014121c8`
- **Body size**: 13 bytes
- **Role**: initialiser
- **Boot-closure callers**: sead::PerformanceMgrNx::initialize
- **Observed signature**:

```c
WARNING: Unknown calling convention -- yet parameter storage is locked void nn::oe::Initialize(void)
```

_Body: 1 distinct call targets; contains decompiler warnings; 7 body lines_

---

## Phase 2: `nn::util` — 1 function

### `nn::util::VSNPrintf`

- **Address**: `0x7101412a78`
- **Body size**: 13 bytes
- **Role**: logging
- **Boot-closure callers**: sead::StringUtil::vsnprintf
- **Observed signature**:

```c
void nn::util::VSNPrintf(void)
```

_Body: 1 distinct call targets; 6 body lines_

---

## Notes

### Read the signatures with care

**A thunk's signature is not the SDK's signature.** These functions are 13-byte
import stubs that forward through a pointer, and the stub itself declares no
parameters. Ghidra therefore renders many of them as `f(void)` — for example
`void nn::os::GetTlsValue(void)` — even though the real SDK function takes
arguments.

**The real ABI is in the pointer type, not the stub.** A stub looks like:

```c
void nn::os::GetSystemTick(void)
{
  (*(code *)PTR_GetSystemTick_7102f9a700)();
}
```

The actual parameter list belongs to `PTR_GetSystemTick_*`. To recover a true
signature, read the pointer's declared type at that address in the analysis, or
inspect a **call site** in a caller function, where arguments are actually
passed. `PORT_WORKLIST.md` lists those callers for every entry.

Signatures rendered with named parameters — for instance
`nn::init::InitializeAllocator(ulong param_1)` or
`nn::mem::StandardAllocator::StandardAllocator(StandardAllocator *this)` — came
from functions that do have real bodies, and those are trustworthy.

### Other caveats

- Signatures are **observed** from the decompiled body, not declared in a
  header. Naming may differ from the original SDK declaration; the ABI should
  not.
- Full pseudocode for every function is reproducible with
  `tools/ghidra/ExtractDecompiled.py`; it is not committed here.
- Functions marked **platform service (stub candidate)** should be stubbed
  rather than implemented for the offline boot milestone.
- **The platform layer is not implemented in `main`.** These 51 are imports; the
  real implementations live in the `sdk` module (confirmed present there for
  `nn::os` and `nn::mem::StandardAllocator`). See the finding in
  [DECOMPILED_BODIES.md](DECOMPILED_BODIES.md) and analyse `sdk` before writing
  any of this from scratch.
