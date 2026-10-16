# Platform call sites observed in `main`

**This is the achievable form of the platform reference.** The implementations
of `nn::os` / `nn::mem` / `nn::init` / `nn::vi` are *not in this dump* (see
[PLATFORM_LAYER_LOCATION.md](PLATFORM_LAYER_LOCATION.md)) — `main` imports them and
the system provides them at runtime. What a port therefore needs is the
**contract**, and the contract is observable exactly where `main` calls them.

Every entry below is a call site lifted from decompiled `main` code, with the
enclosing caller. Ghidra preserved the callee names, so these are direct
observations, not inferences.

Sources: `engine-decompiled.txt`, `main-decompiled.txt`.
Distinct platform callees: **41** · call sites: **66**.

---

## `nn::os` — 22 functions, 41 call sites

### `nn::os::GetSystemTick`

Observed 6 call sites:

- in `Init` (0x71011f5b20):

  ```c
  uVar8 = nn::os::GetSystemTick();
  ```
- in `Init` (0x71011f5b20):

  ```c
  lVar13 = nn::os::GetSystemTick();
  ```
- in `Framework` (0x71011f44e4):

  ```c
  uVar2 = nn::os::GetSystemTick();
  ```
- in `printFromStartTime` (0x71011f603c):

  ```c
  lVar4 = nn::os::GetSystemTick();
  ```
- in `GameFrameworkNx` (0x7100e67260):

  ```c
  uVar2 = nn::os::GetSystemTick();
  ```
- in `init` (0x7100ea202c):

  ```c
  uVar3 = nn::os::GetSystemTick();
  ```

### `nn::os::GetCurrentThread`

Observed 4 call sites:

- in `initialize` (0x7100e99eb4):

  ```c
  pTVar4 = (ThreadType *)nn::os::GetCurrentThread();
  ```
- in `initialize` (0x7100e99eb4):

  ```c
  pTVar5 = (ThreadType *)nn::os::GetCurrentThread();
  ```
- in `initMainThread_` (0x7100e996b8):

  ```c
  pTVar4 = (ThreadType *)nn::os::GetCurrentThread();
  ```
- in `initMainThread_` (0x7100e996b8):

  ```c
  pTVar5 = (ThreadType *)nn::os::GetCurrentThread();
  ```

### `nn::os::SetTlsValue`

Observed 4 call sites:

- in `initialize` (0x7100e99eb4):

  ```c
  nn::os::SetTlsValue(*(undefined4 *)(this + 0x88),this_00);
  ```
- in `initialize` (0x7100e99eb4):

  ```c
  nn::os::SetTlsValue(uVar2,(long)(iVar3 + 1));
  ```
- in `initMainThread_` (0x7100e996b8):

  ```c
  nn::os::SetTlsValue(*(undefined4 *)(this + 0x88),this_00);
  ```
- in `initMainThread_` (0x7100e996b8):

  ```c
  nn::os::SetTlsValue(uVar2,(long)(iVar3 + 1));
  ```

### `nn::os::QueryMemoryInfo`

Observed 3 call sites:

- in `nninitStartup` (0x71011f5ab4):

  ```c
  nn::os::QueryMemoryInfo((MemoryInfo *)&local_58);
  ```
- in `Init` (0x71011f5b20):

  ```c
  nn::os::QueryMemoryInfo((MemoryInfo *)&local_138);
  ```
- in `dumpMemoryInfo` (0x71012cdccc):

  ```c
  nn::os::QueryMemoryInfo(aMStack_88);
  ```

### `nn::os::GetTlsValue`

Observed 3 call sites:

- in `getCurrentHeap` (0x7100e7cf7c):

  ```c
  lVar2 = nn::os::GetTlsValue(*(undefined4 *)(*(long *)PTR_sInstance_7102f9d280 + 0x88));
  ```
- in `findContainHeap` (0x7100e7c8f4):

  ```c
  (lVar4 = nn::os::GetTlsValue(*(undefined4 *)(*(long *)PTR_sInstance_7102f9d280 + 0x88)), lVar4 == 0)) { CriticalSection::lock((CriticalSection *)PTR_sHeapTreeLockCS_7102fca1b0);
  ```
- in `setCurrentHeap_` (0x7100e7cfc0):

  ```c
  lVar1 = nn::os::GetTlsValue(*(undefined4 *)(*(long *)PTR_sInstance_7102f9d280 + 0x88));
  ```

### `nn::os::AllocateMemoryBlock`

Observed 2 call sites:

- in `nninitStartup` (0x71011f5ab4):

  ```c
  nn::os::AllocateMemoryBlock(&local_18,0x2000000);
  ```
- in `initialize` (0x7100eb9f1c):

  ```c
  nn::os::AllocateMemoryBlock((ulong *)this,param_1 + 0x1fffffU & 0xffffffffffe00000);
  ```

### `nn::os::ChangeThreadPriority`

Observed 2 call sites:

- in `initialize` (0x7100e99eb4):

  ```c
  nn::os::ChangeThreadPriority(pTVar5,0x10);
  ```
- in `initMainThread_` (0x7100e996b8):

  ```c
  nn::os::ChangeThreadPriority(pTVar5,0x10);
  ```

### `nn::os::GetThreadId`

Observed 2 call sites:

- in `initialize` (0x7100e99eb4):

  ```c
  uVar2 = nn::os::GetThreadId(pTVar4);
  ```
- in `initMainThread_` (0x7100e996b8):

  ```c
  uVar2 = nn::os::GetThreadId(pTVar4);
  ```

### `nn::os::GetCurrentCoreNumber`

Observed 2 call sites:

- in `initialize` (0x7100e99eb4):

  ```c
  iVar3 = nn::os::GetCurrentCoreNumber();
  ```
- in `initMainThread_` (0x7100e996b8):

  ```c
  iVar3 = nn::os::GetCurrentCoreNumber();
  ```

### `nn::os::SetMemoryHeapSize`

Observed 1 call site:

- in `nninitStartup` (0x71011f5ab4):

  ```c
  nn::os::SetMemoryHeapSize(uVar1);
  ```

### `nn::os::GetThreadAvailableCoreMask`

Observed 1 call site:

- in `setAffinity` (0x7100e992cc):

  ```c
  nn::os::GetThreadAvailableCoreMask();
  ```

### `nn::os::SetThreadCoreMask`

Observed 1 call site:

- in `setAffinity` (0x7100e992cc):

  ```c
  nn::os::SetThreadCoreMask(*(ThreadType **)(this + 0xe0),-1,(ulong)uVar1);
  ```

### `nn::os::ConvertToTimeSpan`

Observed 1 call site:

- in `sleep` (0x7100e99434):

  ```c
  nn::os::ConvertToTimeSpan();
  ```

### `nn::os::SleepThread`

Observed 1 call site:

- in `sleep` (0x7100e99434):

  ```c
  nn::os::SleepThread();
  ```

### `nn::os::InitializeMutex`

Observed 1 call site:

- in `CriticalSection` (0x7100e98ab0):

  ```c
  nn::os::InitializeMutex((MutexType *)(this + 0x20),true,0);
  ```

### `nn::os::LockMutex`

Observed 1 call site:

- in `lock` (0x7100e98bd8):

  ```c
  nn::os::LockMutex((MutexType *)(this + 0x20));
  ```

### `nn::os::UnlockMutex`

Observed 1 call site:

- in `unlock` (0x7100e98be8):

  ```c
  nn::os::UnlockMutex((MutexType *)(this + 0x20));
  ```

### `nn::os::InitializeSemaphore`

Observed 1 call site:

- in `Semaphore` (0x7100eba538):

  ```c
  nn::os::InitializeSemaphore((SemaphoreType *)(this + 0x20),param_1,param_2);
  ```

### `nn::os::CreateThread`

Observed 1 call site:

- in `Thread` (0x7100e98f50):

  ```c
  nn::os::CreateThread (pTVar3,(_func_void_void_ptr *)PTR_ninThreadFunc__7102fca3f0,this, *(void **)(this + 0xe8),(long)param_6,*(int *)(this + 0xf8));
  ```

### `nn::os::SetThreadName`

Observed 1 call site:

- in `Thread` (0x7100e98f50):

  ```c
  nn::os::SetThreadName(pTVar3,(char *)param_1[1]);
  ```

### `nn::os::InitializeMessageQueue`

Observed 1 call site:

- in `allocate` (0x7100eba35c):

  ```c
  nn::os::InitializeMessageQueue((MessageQueueType *)this,puVar2,(long)iVar3);
  ```

### `nn::os::AllocateTlsSlot`

Observed 1 call site:

- in `ThreadMgr` (0x7100e99e68):

  ```c
  nn::os::AllocateTlsSlot(this + 0x88,(_func_void_ulong *)0x0);
  ```

---

## `nn::vi` — 6 functions, 6 call sites

### `nn::vi::Initialize`

Observed 1 call site:

- in `initializeGraphicsSystem` (0x7100e6738c):

  ```c
  nn::vi::Initialize();
  ```

### `nn::vi::OpenDefaultDisplay`

Observed 1 call site:

- in `initializeGraphicsSystem` (0x7100e6738c):

  ```c
  nn::vi::OpenDefaultDisplay((Display **)(this + 0x1a0));
  ```

### `nn::vi::CreateLayer`

Observed 1 call site:

- in `initializeGraphicsSystem` (0x7100e6738c):

  ```c
  nn::vi::CreateLayer((Layer **)(this + 0x1a8),*(Display **)(this + 0x1a0));
  ```

### `nn::vi::SetLayerScalingMode`

Observed 1 call site:

- in `initializeGraphicsSystem` (0x7100e6738c):

  ```c
  nn::vi::SetLayerScalingMode(*(undefined8 *)(this + 0x1a8),2);
  ```

### `nn::vi::GetDisplayVsyncEvent`

Observed 1 call site:

- in `initializeGraphicsSystem` (0x7100e6738c):

  ```c
  nn::vi::GetDisplayVsyncEvent((SystemEventType *)(this + 0x1d8),*(Display **)(this + 0x1a0));
  ```

### `nn::vi::GetNativeWindow`

Observed 1 call site:

- in `initializeGraphicsSystem` (0x7100e6738c):

  ```c
  nn::vi::GetNativeWindow(&local_a0,*(Layer **)(this + 0x1a8));
  ```

---

## `nn::time` — 4 functions, 4 call sites

### `nn::time::IsInitialized`

Observed 1 call site:

- in `setNow` (0x7100ea7ec4):

  ```c
  uVar2 = nn::time::IsInitialized();
  ```

### `nn::time::Initialize`

Observed 1 call site:

- in `setNow` (0x7100ea7ec4):

  ```c
  nn::time::Initialize();
  ```

### `nn::time::StandardUserSystemClock::GetCurrentTime`

Observed 1 call site:

- in `setNow` (0x7100ea7ec4):

  ```c
  nn::time::StandardUserSystemClock::GetCurrentTime(aPStack_28);
  ```

### `nn::time::ToCalendarTime`

Observed 1 call site:

- in `setNow` (0x7100ea7ec4):

  ```c
  nn::time::ToCalendarTime((CalendarTime *)&local_30,(CalendarAdditionalInfo *)0x0,aPStack_28);
  ```

---

## `nn::mem` — 3 functions, 3 call sites

### `nn::mem::StandardAllocator::StandardAllocator`

Observed 1 call site:

- in `initializeGraphicsSystem` (0x7100e6738c):

  ```c
  nn::mem::StandardAllocator::StandardAllocator(this_00,pvVar11,(ulong)*(uint *)(this + 0xd0));
  ```

### `nn::mem::StandardAllocator::Allocate`

Observed 1 call site:

- in `malloc` (0x7100dda0c0):

  ```c
  pvVar1 = (void *)nn::mem::StandardAllocator::Allocate(0x71036563a0);
  ```

### `nn::mem::StandardAllocator::Free`

Observed 1 call site:

- in `free` (0x7100dda114):

  ```c
  nn::mem::StandardAllocator::Free(&DAT_71036563a0);
  ```

---

## `nn::fs` — 2 functions, 2 call sites

### `nn::fs::QueryMountRomCacheSize`

Observed 1 call site:

- in `FileDeviceMgr` (0x7100e64864):

  ```c
  nn::fs::QueryMountRomCacheSize(&local_28);
  ```

### `nn::fs::MountRom`

Observed 1 call site:

- in `FileDeviceMgr` (0x7100e64864):

  ```c
  nn::fs::MountRom("content",pvVar3,local_28);
  ```

---

## `nn::init` — 1 function, 1 call site

### `nn::init::InitializeAllocator`

Observed 1 call site:

- in `nninitStartup` (0x71011f5ab4):

  ```c
  nn::init::InitializeAllocator(local_18);
  ```

---

## `nn::nifm` — 1 function, 1 call site

### `nn::nifm::Initialize`

Observed 1 call site:

- in `Init` (0x71011f5b20):

  ```c
  nn::nifm::Initialize();
  ```

---

## `nn::diag` — 1 function, 7 call sites

### `nn::diag::detail::LogImpl`

Observed 7 call sites:

- in `dumpDateTime` (0x71012cdbf4):

  ```c
  nn::diag::detail::LogImpl ((LogMetaData *)local_80,"### %s [%02d:%02d:%02d] ###",param_1,(ulong)local_30, (ulong)local_2c,(ulong)uStack_28);
  ```
- in `dumpMemoryInfo` (0x71012cdccc):

  ```c
  nn::diag::detail::LogImpl ((LogMetaData *)local_c8,"<><><><><><><><> dumpMemoryInfo [ %s ] <><><><><><><><>\n", param_1);
  ```
- in `dumpMemoryInfo` (0x71012cdccc):

  ```c
  nn::diag::detail::LogImpl((LogMetaData *)local_c8,&DAT_7102896165,local_80 >> 0x14);
  ```
- in `dumpMemoryInfo` (0x71012cdccc):

  ```c
  nn::diag::detail::LogImpl((LogMetaData *)local_c8,&DAT_71028961a3,local_70 >> 0x14);
  ```
- in `dumpMemoryInfo` (0x71012cdccc):

  ```c
  nn::diag::detail::LogImpl((LogMetaData *)local_c8,"%4ld MB: Program\n",local_68 >> 0x14);
  ```
- in `dumpMemoryInfo` (0x71012cdccc):

  ```c
  nn::diag::detail::LogImpl ((LogMetaData *)local_c8,&DAT_71028961f3, ((local_80 >> 0x14) - (local_70 >> 0x14)) - (local_68 >> 0x14));
  ```
- in `dumpMemoryInfo` (0x71012cdccc):

  ```c
  nn::diag::detail::LogImpl((LogMetaData *)local_c8,"\n");
  ```

---

## `nn::util` — 1 function, 1 call site

### `nn::util::VSNPrintf`

Observed 1 call site:

- in `vsnprintf` (0x7100e8b3b8):

  ```c
  iVar1 = nn::util::VSNPrintf(param_1,param_2,param_3,&local_40);
  ```

---

## How to use this

For each function the port must implement:

1. Read the call sites here — they show **how many arguments are passed and what
   they are**, which is the part a signature alone cannot settle.
2. Cross-reference the observed ABI signature in
   [PLATFORM_REFERENCE.md](PLATFORM_REFERENCE.md) for the declared shape.
3. Read the enclosing caller in full via `tools/ghidra/ExtractDecompiled.java` to
   see what it does with the result.

## Limits

- **Only callers that are themselves in the boot closure are covered.** These come
  from the 126 engine functions and the boot roots; the other ~113,000 functions in
  `main` were not decompiled, so their call sites are not listed here.
- **Argument types are Ghidra's inference.** Named parameters such as
  `param_1` are unnamed in the output.
- **A call site shows the interface, not the behaviour.** What the callee does with
  its arguments still has to be inferred from the caller's expectations.
- **No implementation of any of these was recovered**, because none exists in the
  dump. This document does not change that.
