# Platform call sites observed in `main`

** Đây là dạng có thể thực hiện được của phần tham khảo nền tảng.** Việc thực hiện
of `nn::os` / `nn::mem` / `nn::init` / `nn::vi` are *not in this dump* (see
[PLATFORM_LAYER_LOCATION.md](PLATFORM_LAYER_LOCATION.md)) — `main` imports them and
Hệ thống cung cấp cho họ thời gian chạy.
**contract**, and the contract is observable exactly where `main` calls them.

Every entry below is a call site lifted from decompiled `main` code, with the
Ghidra đã bảo quản tên gọi, nên đây là những cái trực tiếp
quan sát, chứ không phải suy luận.

Sources: `engine-decompiled.txt`, `main-decompiled.txt`.
Những cuộc gọi thất bại: **41** · site cuộc gọi: **66**.

---

## `nn::os` — 22 functions, 41 call sites

### `nn::os::GetSystemTick`

Quan sát 6 nơi gọi:

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

Quan sát 4 nơi gọi:

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

Quan sát 4 nơi gọi:

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

Quan sát 3 nơi gọi:

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

Quan sát 3 nơi gọi:

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

Quan sát 2 nơi gọi:

- in `nninitStartup` (0x71011f5ab4):

  ```c
  nn::os::AllocateMemoryBlock(&local_18,0x2000000);
  ```
- in `initialize` (0x7100eb9f1c):

  ```c
  nn::os::AllocateMemoryBlock((ulong *)this,param_1 + 0x1fffffU & 0xffffffffffe00000);
  ```

### `nn::os::ChangeThreadPriority`

Quan sát 2 nơi gọi:

- in `initialize` (0x7100e99eb4):

  ```c
  nn::os::ChangeThreadPriority(pTVar5,0x10);
  ```
- in `initMainThread_` (0x7100e996b8):

  ```c
  nn::os::ChangeThreadPriority(pTVar5,0x10);
  ```

### `nn::os::GetThreadId`

Quan sát 2 nơi gọi:

- in `initialize` (0x7100e99eb4):

  ```c
  uVar2 = nn::os::GetThreadId(pTVar4);
  ```
- in `initMainThread_` (0x7100e996b8):

  ```c
  uVar2 = nn::os::GetThreadId(pTVar4);
  ```

### `nn::os::GetCurrentCoreNumber`

Quan sát 2 nơi gọi:

- in `initialize` (0x7100e99eb4):

  ```c
  iVar3 = nn::os::GetCurrentCoreNumber();
  ```
- in `initMainThread_` (0x7100e996b8):

  ```c
  iVar3 = nn::os::GetCurrentCoreNumber();
  ```

### `nn::os::SetMemoryHeapSize`

Quan sát 1 nơi gọi:

- in `nninitStartup` (0x71011f5ab4):

  ```c
  nn::os::SetMemoryHeapSize(uVar1);
  ```

### `nn::os::GetThreadAvailableCoreMask`

Quan sát 1 nơi gọi:

- in `setAffinity` (0x7100e992cc):

  ```c
  nn::os::GetThreadAvailableCoreMask();
  ```

### `nn::os::SetThreadCoreMask`

Quan sát 1 nơi gọi:

- in `setAffinity` (0x7100e992cc):

  ```c
  nn::os::SetThreadCoreMask(*(ThreadType **)(this + 0xe0),-1,(ulong)uVar1);
  ```

### `nn::os::ConvertToTimeSpan`

Quan sát 1 nơi gọi:

- in `sleep` (0x7100e99434):

  ```c
  nn::os::ConvertToTimeSpan();
  ```

### `nn::os::SleepThread`

Quan sát 1 nơi gọi:

- in `sleep` (0x7100e99434):

  ```c
  nn::os::SleepThread();
  ```

### `nn::os::InitializeMutex`

Quan sát 1 nơi gọi:

- in `CriticalSection` (0x7100e98ab0):

  ```c
  nn::os::InitializeMutex((MutexType *)(this + 0x20),true,0);
  ```

### `nn::os::LockMutex`

Quan sát 1 nơi gọi:

- in `lock` (0x7100e98bd8):

  ```c
  nn::os::LockMutex((MutexType *)(this + 0x20));
  ```

### `nn::os::UnlockMutex`

Quan sát 1 nơi gọi:

- in `unlock` (0x7100e98be8):

  ```c
  nn::os::UnlockMutex((MutexType *)(this + 0x20));
  ```

### `nn::os::InitializeSemaphore`

Quan sát 1 nơi gọi:

- in `Semaphore` (0x7100eba538):

  ```c
  nn::os::InitializeSemaphore((SemaphoreType *)(this + 0x20),param_1,param_2);
  ```

### `nn::os::CreateThread`

Quan sát 1 nơi gọi:

- in `Thread` (0x7100e98f50):

  ```c
  nn::os::CreateThread (pTVar3,(_func_void_void_ptr *)PTR_ninThreadFunc__7102fca3f0,this, *(void **)(this + 0xe8),(long)param_6,*(int *)(this + 0xf8));
  ```

### `nn::os::SetThreadName`

Quan sát 1 nơi gọi:

- in `Thread` (0x7100e98f50):

  ```c
  nn::os::SetThreadName(pTVar3,(char *)param_1[1]);
  ```

### `nn::os::InitializeMessageQueue`

Quan sát 1 nơi gọi:

- in `allocate` (0x7100eba35c):

  ```c
  nn::os::InitializeMessageQueue((MessageQueueType *)this,puVar2,(long)iVar3);
  ```

### `nn::os::AllocateTlsSlot`

Quan sát 1 nơi gọi:

- in `ThreadMgr` (0x7100e99e68):

  ```c
  nn::os::AllocateTlsSlot(this + 0x88,(_func_void_ulong *)0x0);
  ```

---

## `nn::vi` — 6 functions, 6 call sites

### `nn::vi::Initialize`

Quan sát 1 nơi gọi:

- in `initializeGraphicsSystem` (0x7100e6738c):

  ```c
  nn::vi::Initialize();
  ```

### `nn::vi::OpenDefaultDisplay`

Quan sát 1 nơi gọi:

- in `initializeGraphicsSystem` (0x7100e6738c):

  ```c
  nn::vi::OpenDefaultDisplay((Display **)(this + 0x1a0));
  ```

### `nn::vi::CreateLayer`

Quan sát 1 nơi gọi:

- in `initializeGraphicsSystem` (0x7100e6738c):

  ```c
  nn::vi::CreateLayer((Layer **)(this + 0x1a8),*(Display **)(this + 0x1a0));
  ```

### `nn::vi::SetLayerScalingMode`

Quan sát 1 nơi gọi:

- in `initializeGraphicsSystem` (0x7100e6738c):

  ```c
  nn::vi::SetLayerScalingMode(*(undefined8 *)(this + 0x1a8),2);
  ```

### `nn::vi::GetDisplayVsyncEvent`

Quan sát 1 nơi gọi:

- in `initializeGraphicsSystem` (0x7100e6738c):

  ```c
  nn::vi::GetDisplayVsyncEvent((SystemEventType *)(this + 0x1d8),*(Display **)(this + 0x1a0));
  ```

### `nn::vi::GetNativeWindow`

Quan sát 1 nơi gọi:

- in `initializeGraphicsSystem` (0x7100e6738c):

  ```c
  nn::vi::GetNativeWindow(&local_a0,*(Layer **)(this + 0x1a8));
  ```

---

## `nn::time` — 4 functions, 4 call sites

### `nn::time::IsInitialized`

Quan sát 1 nơi gọi:

- in `setNow` (0x7100ea7ec4):

  ```c
  uVar2 = nn::time::IsInitialized();
  ```

### `nn::time::Initialize`

Quan sát 1 nơi gọi:

- in `setNow` (0x7100ea7ec4):

  ```c
  nn::time::Initialize();
  ```

### `nn::time::StandardUserSystemClock::GetCurrentTime`

Quan sát 1 nơi gọi:

- in `setNow` (0x7100ea7ec4):

  ```c
  nn::time::StandardUserSystemClock::GetCurrentTime(aPStack_28);
  ```

### `nn::time::ToCalendarTime`

Quan sát 1 nơi gọi:

- in `setNow` (0x7100ea7ec4):

  ```c
  nn::time::ToCalendarTime((CalendarTime *)&local_30,(CalendarAdditionalInfo *)0x0,aPStack_28);
  ```

---

## `nn::mem` — 3 functions, 3 call sites

### `nn::mem::StandardAllocator::StandardAllocator`

Quan sát 1 nơi gọi:

- in `initializeGraphicsSystem` (0x7100e6738c):

  ```c
  nn::mem::StandardAllocator::StandardAllocator(this_00,pvVar11,(ulong)*(uint *)(this + 0xd0));
  ```

### `nn::mem::StandardAllocator::Allocate`

Quan sát 1 nơi gọi:

- in `malloc` (0x7100dda0c0):

  ```c
  pvVar1 = (void *)nn::mem::StandardAllocator::Allocate(0x71036563a0);
  ```

### `nn::mem::StandardAllocator::Free`

Quan sát 1 nơi gọi:

- in `free` (0x7100dda114):

  ```c
  nn::mem::StandardAllocator::Free(&DAT_71036563a0);
  ```

---

## `nn::fs` — 2 functions, 2 call sites

### `nn::fs::QueryMountRomCacheSize`

Quan sát 1 nơi gọi:

- in `FileDeviceMgr` (0x7100e64864):

  ```c
  nn::fs::QueryMountRomCacheSize(&local_28);
  ```

### `nn::fs::MountRom`

Quan sát 1 nơi gọi:

- in `FileDeviceMgr` (0x7100e64864):

  ```c
  nn::fs::MountRom("content",pvVar3,local_28);
  ```

---

## `nn::init` — 1 function, 1 call site

### `nn::init::InitializeAllocator`

Quan sát 1 nơi gọi:

- in `nninitStartup` (0x71011f5ab4):

  ```c
  nn::init::InitializeAllocator(local_18);
  ```

---

## `nn::nifm` — 1 function, 1 call site

### `nn::nifm::Initialize`

Quan sát 1 nơi gọi:

- in `Init` (0x71011f5b20):

  ```c
  nn::nifm::Initialize();
  ```

---

## `nn::diag` — 1 function, 7 call sites

### `nn::diag::detail::LogImpl`

Quan sát 7 nơi gọi:

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

Quan sát 1 nơi gọi:

- in `vsnprintf` (0x7100e8b3b8):

  ```c
  iVar1 = nn::util::VSNPrintf(param_1,param_2,param_3,&local_40);
  ```

---

## Cách sử dụng cái này

Đối với mỗi chức năng, cổng phải thực hiện:

1. Hãy đọc những địa điểm được gọi ở đây — họ cho thấy có bao nhiêu lý lẽ được thông qua và những gì
   họ là**, đó là một phần mà chỉ riêng chữ ký không thể giải quyết được.
2. Đối chiếu chéo chữ ký ABI quan sát được trong
   [PLATORM_REFERCE.md] (PLATORM_REFERCE.md) cho hình dạng đã được công bố.
3. Read the enclosing caller in full via `tools/ghidra/ExtractDecompiled.java` to
   Hãy xem kết quả thế nào.

## Giới hạn

- **Chỉ có những người tự gọi cho mình trong việc đóng cửa giày mới được che đậy.** Những người này đến
  từ chức năng của máy 126 và rễ khởi động; còn lại là ~113.000 chức năng trong
  `main` were not decompiled, so their call sites are not listed here.
- **Những kiểu thức nhận dạng là suy luận của Ghidra.** Những tham số có tên như
  `param_1` are unnamed in the output.
- **A gọi nơi Mạng hiển thị giao diện, không phải hành vi.** Những gì người gọi làm với
  lập luận của nó vẫn phải được suy ra từ kỳ vọng của người gọi.
- **Không có việc thực hiện nào trong số này được phục hồi**, bởi vì không có gì tồn tại trong
  & Bỏ đi. Tài liệu này không thay đổi điều đó.
