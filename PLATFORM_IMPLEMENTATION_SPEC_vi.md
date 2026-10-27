# Comment

How `main` actually calls each platform import, from a **whole-binary** scan:
**48 nhập khẩu, 1712 địa điểm cuộc gọi, 1191 gọi chức năng.**

Đây là tài liệu mà nền tảng 51 chức năng được viết chống lại.

**Tại sao lại gọi cho nơi này, chứ không phải chữ ký.** Việc thực hiện không nằm trong đống rác này--
Xem [PLATORM_LAYER_LOCE.md] (PLATORM_LAYER_LCORE.md).
thunks are 13-byte stubs that Ghidra frequently renders as `f(void)`, so their
Các địa điểm cuộc gọi không phải là hiếm.

Những người bạn: (PLATORM_CALL_SBES.md)
[PLATORM_REFERCE.md] (PLATORM_REFECE.md)
[ENGINE_REFERCE.md] (ENGINE_REFERCE.md) (các chức năng khởi động 126).

## Phương pháp

Mỗi nhập khẩu được gọi bằng một chiếc xe ba bánh, và người gọi gọi nó là một ** named**
function (Ghidra renders `nn::os::GetSystemTick()`). So the scan enumerates
tham chiếu đến mỗi địa chỉ truy cập ** của mỗi địa chỉ truy cập**, phân hủy mỗi cuộc gọi riêng biệt, và
giữ mật mã giả để gọi một nền tảng nhập khẩu.

Tất cả 50 Thunks có người gọi, do đó, điều này bao gồm các bộ nhập đầy đủ thay vì một
subset. Reproduce with `tools/ghidra/PlatformThunkCallers.java`.

## xếp hạng

|Nhập|Nơi gọi|Cuộc gọi|
|---|---:|---:|
| `GetSystemTick` | 677 | 615 |
| `GetTlsValue` | 264 | 246 |
| `LockMutex` | 171 | 161 |
| `UnlockMutex` | 170 | 160 |
| `GetCurrentCoreNumber` | 121 | 112 |
| `InitializeMutex` | 56 | 44 |
| `Initialize` | 46 | 29 |
| `SleepThread` | 23 | 22 |
| `ConvertToTimeSpan` | 21 | 17 |
| `GetCurrentThread` | 17 | 16 |
| `VSNPrintf` | 17 | 13 |
| `LogImpl` | 14 | 8 |
| `Allocate` | 11 | 9 |
| `ChangeThreadPriority` | 8 | 8 |
| `SetTlsValue` | 8 | 4 |
| `Free` | 7 | 5 |
| `InitializeMessageQueue` | 7 | 6 |
| `InitializeSemaphore` | 7 | 7 |
| `IsInitialized` | 5 | 4 |
| `GetCurrentTime` | 5 | 5 |
| `SetThreadCoreMask` | 4 | 4 |
| `QueryMemoryInfo` | 3 | 3 |
| `GetThreadAvailableCoreMask` | 3 | 3 |
| `GetThreadPriority` | 3 | 3 |
| `GetCurrentStackInfo` | 3 | 3 |
| `SetThreadName` | 3 | 3 |
| `GetThreadId` | 3 | 3 |
| `StandardAllocator` | 3 | 3 |
| `nvnBootstrapLoader` | 3 | 2 |
| `AllocateMemoryBlock` | 2 | 2 |
| `VCT_IsInitialized` | 2 | 2 |
| `networkInitialize` | 2 | 1 |
| `localInitialize` | 2 | 1 |
| `PacketBufferFree` | 2 | 1 |
| `PacketManagementObjectFree` | 2 | 1 |
| `AllocateTlsSlot` | 2 | 2 |
| `ToCalendarTime` | 2 | 2 |
| `QueryMountRomCacheSize` | 2 | 2 |
| `MountRom` | 2 | 2 |
| `SetMemoryHeapSize` | 1 | 1 |
| `nvnMemoryPoolInitialize` | 1 | 1 |
| `internetInitialize` | 1 | 1 |
| `InitializeGraphics` | 1 | 1 |
| `OpenDefaultDisplay` | 1 | 1 |
| `CreateLayer` | 1 | 1 |
| `SetLayerScalingMode` | 1 | 1 |
| `GetDisplayVsyncEvent` | 1 | 1 |
| `GetNativeWindow` | 1 | 1 |

---

## `GetSystemTick`

**677 địa điểm gọi điện trên 615 người gọi.**

Theo dõi gọi biểu thức:

- in `Actor` (71011eba24, 344 B)

  ```c
  uVar5 = nn::os::GetSystemTick();
  ```
- in `syncCacheStorageImpl` (7100004e60, 368 B)

  ```c
  nn::os::GetSystemTick();
  ```
- in `syncCacheStorageImpl` (7100004e60, 368 B)

  ```c
  lVar5 = nn::os::GetSystemTick();
  ```
- in `syncCacheStorageImpl` (7100004e60, 368 B)

  ```c
  lVar6 = nn::os::GetSystemTick();
  ```
- in `loadTest` (7100005c00, 168 B)

  ```c
  nn::os::GetSystemTick();
  ```
- in `tryAlloc` (7100ec3c34, 560 B)

  ```c
  nn::os::GetSystemTick();
  ```
- in `init` (7100ea202c, 96 B)

  ```c
  uVar3 = nn::os::GetSystemTick();
  ```
- in `NetworkTime` (710004aff4, 312 B)

  ```c
  uVar2 = nn::os::GetSystemTick();
  ```
- in `startSync` (710004b224, 120 B)

  ```c
  uVar3 = nn::os::GetSystemTick();
  ```
- in `checkSyncEnd` (710004b49c, 160 B)

  ```c
  lVar4 = nn::os::GetSystemTick();
  ```
- ... và 667 địa điểm cuộc gọi khác

---

## `GetTlsValue`

**264 địa điểm gọi điện cho 246 người.**

Theo dõi gọi biểu thức:

- in `run` (7100eaa644, 448 B)

  ```c
  lVar8 = nn::os::GetTlsValue(*(undefined4 *)puVar6);
  ```
- in `drawList` (710100bd64, 1036 B)

  ```c
  lVar4 = nn::os::GetTlsValue(*(undefined4 *)PTR_sCoreNumberTlsSlot_7102f9de68);
  ```
- in `drawList` (710100bd64, 1036 B)

  ```c
  lVar4 = nn::os::GetTlsValue(*(undefined4 *)puVar2);
  ```
- in `begin` (7100f3086c, 364 B)

  ```c
  lVar10 = nn::os::GetTlsValue(*(undefined4 *)PTR_sCoreNumberTlsSlot_7102f9de68);
  ```
- in `end` (7100f309d8, 176 B)

  ```c
  lVar3 = nn::os::GetTlsValue(*(undefined4 *)PTR_sCoreNumberTlsSlot_7102f9de68);
  ```
- in `calcStep1` (710100aafc, 1156 B)

  ```c
  lVar4 = nn::os::GetTlsValue(*(undefined4 *)PTR_sCoreNumberTlsSlot_7102f9de68);
  ```
- in `calcStep1` (710100aafc, 1156 B)

  ```c
  lVar4 = nn::os::GetTlsValue(*puVar12);
  ```
- in `BEGIN_CALC_LOAD` (710100af80, 136 B)

  ```c
  lVar2 = nn::os::GetTlsValue(*(undefined4 *)PTR_sCoreNumberTlsSlot_7102f9de68);
  ```
- in `END_CALC_LOAD` (710100b130, 172 B)

  ```c
  lVar2 = nn::os::GetTlsValue(*(undefined4 *)PTR_sCoreNumberTlsSlot_7102f9de68);
  ```
- in `calcStep2` (710100b1dc, 448 B)

  ```c
  lVar3 = nn::os::GetTlsValue(*(undefined4 *)PTR_sCoreNumberTlsSlot_7102f9de68);
  ```
- ... và 254 địa điểm cuộc gọi khác

---

## `LockMutex`

**171 nơi có cuộc gọi trên 161 người gọi.**

Theo dõi gọi biểu thức:

- in `FrameProcess` (7100e28bd8, 636 B)

  ```c
  nn::os::LockMutex((MutexType *)(this + 0x348));
  ```
- in `FrameProcess` (7100e28bd8, 636 B)

  ```c
  nn::os::LockMutex((MutexType *)(puVar4 + 0x768));
  ```
- in `FrameProcess` (7100e28bd8, 636 B)

  ```c
  nn::os::LockMutex(pMVar1);
  ```
- in `Run` (7100e2918c, 492 B)

  ```c
  nn::os::LockMutex((MutexType *)(param_1 + 0x4a0));
  ```
- in `Initialize` (710135e1e0, 1788 B)

  ```c
  nn::os::LockMutex((MutexType *)&DAT_7103698368);
  ```
- in `LogDeviceMemory` (7100cf48fc, 276 B)

  ```c
  nn::os::LockMutex((MutexType *)(this + 0x38));
  ```
- in `EmulatedCondition` (7100d0783c, 280 B)

  ```c
  nn::os::LockMutex((MutexType *)(*(long *)this + 0x18));
  ```
- in `CancelAll` (7100d07a00, 204 B)

  ```c
  nn::os::LockMutex((MutexType *)(*(long *)this + 0x18));
  ```
- in `WaitForEvent` (7100d07b8c, 620 B)

  ```c
  nn::os::LockMutex((MutexType *)(*(long *)this + 0x18));
  ```
- in `DetachMemoryPool` (7100e2085c, 264 B)

  ```c
  nn::os::LockMutex((MutexType *)(puVar2 + 0x768));
  ```
- ... và 161 địa điểm cuộc gọi khác

---

## `UnlockMutex`

**170 cuộc gọi trên 160 người gọi.**

Theo dõi gọi biểu thức:

- in `FrameProcess` (7100e28bd8, 636 B)

  ```c
  nn::os::UnlockMutex((MutexType *)(puVar3 + 0x768));
  ```
- in `FrameProcess` (7100e28bd8, 636 B)

  ```c
  nn::os::UnlockMutex(pMVar1);
  ```
- in `FrameProcess` (7100e28bd8, 636 B)

  ```c
  nn::os::UnlockMutex((MutexType *)(this + 0x348));
  ```
- in `Run` (7100e2918c, 492 B)

  ```c
  nn::os::UnlockMutex((MutexType *)(param_1 + 0x4a0));
  ```
- in `Initialize` (710135e1e0, 1788 B)

  ```c
  nn::os::UnlockMutex((MutexType *)&DAT_7103698368);
  ```
- in `EmulatedCondition` (7100d0783c, 280 B)

  ```c
  nn::os::UnlockMutex((MutexType *)(puVar3 + 0x18));
  ```
- in `CancelAll` (7100d07a00, 204 B)

  ```c
  nn::os::UnlockMutex((MutexType *)(puVar3 + 0x18));
  ```
- in `WaitForEvent` (7100d07b8c, 620 B)

  ```c
  nn::os::UnlockMutex((MutexType *)(pcVar9 + 0x18));
  ```
- in `DetachMemoryPool` (7100e2085c, 264 B)

  ```c
  nn::os::UnlockMutex((MutexType *)(puVar2 + 0x768));
  ```
- in `AttachMemoryPool` (7100e206d4, 224 B)

  ```c
  nn::os::UnlockMutex((MutexType *)(puVar2 + 0x768));
  ```
- ... và 160 địa điểm cuộc gọi khác

---

## `GetCurrentCoreNumber`

**121 nơi có cuộc gọi trên 112 người gọi.**

Theo dõi gọi biểu thức:

- in `run` (7100eaa644, 448 B)

  ```c
  uVar7 = nn::os::GetCurrentCoreNumber();
  ```
- in `drawList` (710100bd64, 1036 B)

  ```c
  iVar3 = nn::os::GetCurrentCoreNumber();
  ```
- in `begin` (7100f3086c, 364 B)

  ```c
  iVar9 = nn::os::GetCurrentCoreNumber();
  ```
- in `end` (7100f309d8, 176 B)

  ```c
  iVar1 = nn::os::GetCurrentCoreNumber();
  ```
- in `calcStep1` (710100aafc, 1156 B)

  ```c
  iVar3 = nn::os::GetCurrentCoreNumber();
  ```
- in `BEGIN_CALC_LOAD` (710100af80, 136 B)

  ```c
  iVar1 = nn::os::GetCurrentCoreNumber();
  ```
- in `END_CALC_LOAD` (710100b130, 172 B)

  ```c
  iVar1 = nn::os::GetCurrentCoreNumber();
  ```
- in `calcStep2` (710100b1dc, 448 B)

  ```c
  iVar2 = nn::os::GetCurrentCoreNumber();
  ```
- in `invoke` (710100b474, 976 B)

  ```c
  iVar5 = nn::os::GetCurrentCoreNumber();
  ```
- in `invoke` (710100b474, 976 B)

  ```c
  iVar6 = nn::os::GetCurrentCoreNumber();
  ```
- ... và 111 địa điểm cuộc gọi khác

---

## `InitializeMutex`

**56 cuộc gọi trên 44 người.**

Theo dõi gọi biểu thức:

- in `Setup` (7101388418, 800 B)

  ```c
  nn::os::InitializeMutex(pMVar9,false,0);
  ```
- in `Initialize` (710135e1e0, 1788 B)

  ```c
  nn::os::InitializeMutex((MutexType *)&DAT_7103698368,false,0);
  ```
- in `GetInstance` (7100e284f4, 284 B)

  ```c
  nn::os::InitializeMutex((MutexType *)&DAT_71036580b8,true,0);
  ```
- in `GetInstance` (7100e284f4, 284 B)

  ```c
  nn::os::InitializeMutex((MutexType *)&DAT_71036580d8,true,0);
  ```
- in `GetInstance` (7100e284f4, 284 B)

  ```c
  nn::os::InitializeMutex((MutexType *)&DAT_7103658210,true,0);
  ```
- in `HardwareManager` (7100e1fbc4, 328 B)

  ```c
  nn::os::InitializeMutex((MutexType *)(this + 0x768),true,0);
  ```
- in `HardwareManager` (7100e1fbc4, 328 B)

  ```c
  nn::os::InitializeMutex((MutexType *)(this + 0x788),true,0);
  ```
- in `HardwareManager` (7100e1fbc4, 328 B)

  ```c
  nn::os::InitializeMutex((MutexType *)(this + 0x7a8),true,0);
  ```
- in `HardwareManager` (7100e1fbc4, 328 B)

  ```c
  nn::os::InitializeMutex((MutexType *)(this + 0x7c8),true,0);
  ```
- in `HardwareManager` (7100e1fbc4, 328 B)

  ```c
  nn::os::InitializeMutex((MutexType *)(this + 0x7e8),true,0);
  ```
- ... và 46 địa điểm cuộc gọi khác

---

## `Initialize`

**46 cuộc gọi trên 29 người gọi.**

Theo dõi gọi biểu thức:

- in `syncCacheStorageImpl` (7100004e60, 368 B)

  ```c
  uVar3 = nn::bcat::DeliveryCacheProgress::Initialize();
  ```
- in `startSync` (710004b224, 120 B)

  ```c
  nn::time::AsyncEnsureNetworkClockAvailabilityTask::Initialize(*(undefined8 *)(this + 0x60),1);
  ```
- in `listenPropertyEvent` (710004b684, 408 B)

  ```c
  nn::time::AsyncEnsureNetworkClockAvailabilityTask::Initialize(*(undefined8 *)(this + 0x60),1);
  ```
- in `Init` (71011f5b20, 1308 B)

  ```c
  nn::nifm::Initialize();
  ```
- in `AddAddonSoundArchive` (7100e3601c, 132 B)

  ```c
  atk::detail::AddonSoundArchiveContainer::Initialize(this_00,param_1,param_2,param_3);
  ```
- in `internetInitialize` (7101332a98, 520 B)

  ```c
  iVar2 = nn::nifm::Initialize();
  ```
- in `internetInitialize` (7101332a98, 520 B)

  ```c
  nn::socket::Initialize(*(void **)(*(long *)(*(long *)puVar1 + 8) + 0x70),0x600000,0x20000,0xe);
  ```
- in `networkInitialize` (7101332e88, 312 B)

  ```c
  iVar2 = nn::nifm::Initialize();
  ```
- in `networkInitialize` (7101332e88, 312 B)

  ```c
  nn::socket::Initialize(*(void **)(*(long *)(*(long *)puVar1 + 8) + 0x70),0x600000,0x20000,0xe);
  ```
- in `localStartUp` (7101334a7c, 132 B)

  ```c
  local_18[0] = nn::ldn::Initialize();
  ```
- ... và 36 địa điểm cuộc gọi khác

---

## `SleepThread`

**23 số điện thoại trên 22 người gọi.**

Theo dõi gọi biểu thức:

- in `Run` (7100e2918c, 492 B)

  ```c
  nn::os::SleepThread(5000000);
  ```
- in `sleep` (7100e99434, 20 B)

  ```c
  nn::os::SleepThread();
  ```
- in `sleep` (7100ca4504, 20 B)

  ```c
  nn::os::SleepThread();
  ```
- in `ThreadScrambler` (7100d07df8, 672 B)

  ```c
  nn::os::SleepThread(1000000);
  ```
- in `Launch` (7100cf8fd8, 172 B)

  ```c
  nn::os::SleepThread(1000000);
  ```
- in `SpinOnce` (7100cf9664, 188 B)

  ```c
  nn::os::SleepThread((ulong)*(uint *)(param_1 + 0x1c) * 1000000);
  ```
- in `WaitForBoolEvent` (7100cf3994, 480 B)

  ```c
  nn::os::SleepThread(1000000);
  ```
- in `Wait` (7100cf942c, 532 B)

  ```c
  nn::os::SleepThread(100000000);
  ```
- in `~Condition` (7100d076c0, 216 B)

  ```c
  nn::os::SleepThread(1000000);
  ```
- in `SystemCheck` (7100d03a24, 224 B)

  ```c
  nn::os::SleepThread(10000000);
  ```
- ... và 13 nơi gọi khác

---

## `ConvertToTimeSpan`

**21 gọi cho nơi có 17 người gọi.**

Theo dõi gọi biểu thức:

- in `PreprocessSinglePlay` (7100e36af0, 412 B)

  ```c
  (lVar3 = nn::os::ConvertToTimeSpan(lVar2 - *(long *)(local_58 + 0x110)), lVar3 < lVar7))
  ```
- in `calc` (710110ca58, 600 B)

  ```c
  lVar9 = nn::os::ConvertToTimeSpan(lVar7 - lVar9);
  ```
- in `calc` (710110ca58, 600 B)

  ```c
  lVar10 = nn::os::ConvertToTimeSpan(lVar5 - lVar10);
  ```
- in `calc` (710110ca58, 600 B)

  ```c
  lVar11 = nn::os::ConvertToTimeSpan(lVar3 - lVar11);
  ```
- in `calc` (710110ca58, 600 B)

  ```c
  lVar11 = nn::os::ConvertToTimeSpan(lVar4 - lVar1);
  ```
- in `calc` (710110ca58, 600 B)

  ```c
  lVar11 = nn::os::ConvertToTimeSpan(lVar6 - lVar2);
  ```
- in `CalcNextNetworkId` (710133b2e4, 92 B)

  ```c
  uVar2 = nn::os::ConvertToTimeSpan();
  ```
- in `vct_check_quality_alert_time` (7101355454, 176 B)

  ```c
  uVar6 = nn::os::ConvertToTimeSpan(lVar4 - lVar5);
  ```
- in `CalcJitterAndSkew` (7101355c50, 1292 B)

  ```c
  uVar10 = nn::os::ConvertToTimeSpan(lVar16 - *(long *)(this + 0xd0));
  ```
- in `VCT_GetDropFrequency` (7101354484, 728 B)

  ```c
  uVar5 = nn::os::ConvertToTimeSpan(lVar6 - (&DAT_7103686f68)[lVar7 * 0x24]);
  ```
- ... và 11 nơi gọi khác

---

## `GetCurrentThread`

**17 gọi cho nơi có 16 người gọi.**

Theo dõi gọi biểu thức:

- in `ThreadVariable` (7100d06918, 544 B)

  ```c
  uVar5 = nn::os::GetCurrentThread();
  ```
- in `ThreadVariable` (7100d06b38, 540 B)

  ```c
  uVar3 = nn::os::GetCurrentThread();
  ```
- in `SystemCheck` (7100d03a24, 224 B)

  ```c
  lVar2 = nn::os::GetCurrentThread();
  ```
- in `initMainThread_` (7100e996b8, 184 B)

  ```c
  pTVar4 = (ThreadType *)nn::os::GetCurrentThread();
  ```
- in `initMainThread_` (7100e996b8, 184 B)

  ```c
  pTVar5 = (ThreadType *)nn::os::GetCurrentThread();
  ```
- in `ObjectThreadProc` (7100cf8b60, 316 B)

  ```c
  lVar7 = nn::os::GetCurrentThread();
  ```
- in `CallObjectMethodWrapper` (7100cf8de4, 280 B)

  ```c
  uVar6 = nn::os::GetCurrentThread();
  ```
- in `initMainThread_` (7100ca47e0, 324 B)

  ```c
  pTVar4 = (ThreadType *)nn::os::GetCurrentThread();
  ```
- in `operator=` (7100d040dc, 332 B)

  ```c
  uVar3 = nn::os::GetCurrentThread();
  ```
- in `getCurrentThreadID_` (7100ca4924, 20 B)

  ```c
  nn::os::GetCurrentThread();
  ```
- ... và 7 nơi gọi nữa.

---

## `VSNPrintf`

**17 gọi điện cho 13 người.**

Theo dõi gọi biểu thức:

- in `vsnprintf` (7100e8b3b8, 148 B)

  ```c
  iVar1 = nn::util::VSNPrintf(param_1,param_2,param_3,&local_40);
  ```
- in `snprintf` (7100e8b44c, 252 B)

  ```c
  iVar1 = nn::util::VSNPrintf(param_1,param_2,param_3,&local_50);
  ```
- in `VPrintf` (7100c38ad4, 136 B)

  ```c
  uVar1 = nn::util::VSNPrintf(auStack_220,0x200,param_1,&local_240);
  ```
- in `Printf` (7100c38b5c, 248 B)

  ```c
  uVar1 = nn::util::VSNPrintf(auStack_220,0x200,param_1,&local_240);
  ```
- in `FormatV` (7100c3f790, 584 B)

  ```c
  uVar7 = nn::util::VSNPrintf(lVar14,uVar9 & 0xffffffff,param_1,&local_40);
  ```
- in `vsnprintf` (7100c9c914, 148 B)

  ```c
  iVar1 = nn::util::VSNPrintf(param_1,param_2,param_3,&local_40);
  ```
- in `snprintf` (7100c9c9a8, 252 B)

  ```c
  iVar1 = nn::util::VSNPrintf(param_1,param_2,param_3,&local_50);
  ```
- in `Write` (7100ceba34, 200 B)

  ```c
  nn::util::VSNPrintf(&DAT_710304ebf8,0x200,param_1,&local_60);
  ```
- in `CalculateVStringRect` (7100de3898, 336 B)

  ```c
  iVar2 = nn::util::VSNPrintf(auStack_2e0,0x200,param_2,&local_e0);
  ```
- in `VSNPrintf` (7100de3d8c, 64 B)

  ```c
  /* nn::font::TextWriterBase<char>::VSNPrintf(char*, unsigned long, char const*, std::__va_list) */
  ```
- ... và 7 nơi gọi nữa.

---

## `LogImpl`

**14 cuộc gọi trên 8 người gọi.**

Theo dõi gọi biểu thức:

- in `dumpMemoryInfo` (71012cdccc, 408 B)

  ```c
  nn::diag::detail::LogImpl((LogMetaData *)local_c8,&DAT_7102896165,local_80 >> 0x14);
  ```
- in `dumpMemoryInfo` (71012cdccc, 408 B)

  ```c
  nn::diag::detail::LogImpl((LogMetaData *)local_c8,&DAT_71028961a3,local_70 >> 0x14);
  ```
- in `dumpMemoryInfo` (71012cdccc, 408 B)

  ```c
  nn::diag::detail::LogImpl((LogMetaData *)local_c8,"%4ld MB: Program\n",local_68 >> 0x14);
  ```
- in `dumpMemoryInfo` (71012cdccc, 408 B)

  ```c
  nn::diag::detail::LogImpl((LogMetaData *)local_c8,"\n");
  ```
- in `SigloNetInit` (7100d1a664, 496 B)

  ```c
  nn::diag::detail::LogImpl((LogMetaData *)local_90,"Initializing socket.\n");
  ```
- in `SigloNetInit` (7100d1a664, 496 B)

  ```c
  nn::diag::detail::LogImpl((LogMetaData *)local_90,"Connecting to the network...\n");
  ```
- in `SigloNetInit` (7100d1a664, 496 B)

  ```c
  nn::diag::detail::LogImpl((LogMetaData *)local_90,"Network is not available.\n");
  ```
- in `SigloNetInit` (7100d1a664, 496 B)

  ```c
  nn::diag::detail::LogImpl((LogMetaData *)local_90,"Network is ready.\n");
  ```
- in `countupFinalTeamPixel` (710085054c, 676 B)

  ```c
  nn::diag::detail::LogImpl((LogMetaData *)local_a8," Count up final result ERROR log");
  ```
- in `Output` (7100cf4824, 108 B)

  ```c
  nn::diag::detail::LogImpl((LogMetaData *)local_50,"%s\n",param_2);
  ```
- ... và 4 vị trí cuộc gọi khác

---

## `Allocate`

**11 cuộc gọi trên 9 người gọi.**

Theo dõi gọi biểu thức:

- in `Allocate` (7100cf8080, 376 B)

  ```c
  /* nn::nex::PacketBufferMultiUnitHeap::Allocate(unsigned long, void (*)(void*)) */
  ```
- in `Allocate` (7101394058, 100 B)

  ```c
  /* nn::atk::SoundHeap::Allocate(unsigned long) */
  ```
- in `Allocate` (7101394058, 100 B)

  ```c
  long * __thiscall nn::atk::SoundHeap::Allocate(SoundHeap *this,long param_1)
  ```
- in `Allocate` (7101394130, 116 B)

  ```c
  /* nn::atk::SoundHeap::Allocate(unsigned long, void (*)(void*), void*) */
  ```
- in `Allocate` (7101394130, 116 B)

  ```c
  nn::atk::SoundHeap::Allocate(SoundHeap *this,long param_1,long param_2,long param_3)
  ```
- in `malloc` (7100dda0c0, 84 B)

  ```c
  pvVar1 = (void *)nn::mem::StandardAllocator::Allocate(0x71036563a0);
  ```
- in `CurlCallocCallback` (7100d1a554, 68 B)

  ```c
  __s = (void *)nn::mem::StandardAllocator::Allocate(0x7103650008);
  ```
- in `CurlStrdupCallback` (7100d1a598, 84 B)

  ```c
  __dest = (void *)nn::mem::StandardAllocator::Allocate(0x7103650008);
  ```
- in `calloc` (7100dda130, 120 B)

  ```c
  __s = (void *)nn::mem::StandardAllocator::Allocate(0x71036563a0);
  ```
- in `AllocateThreadSafe` (7100cf4e98, 28 B)

  ```c
  nn::mem::StandardAllocator::Allocate(*(long *)PTR_s_pGv_7102fc6f58 + 0x230);
  ```
- ... và 1 nơi gọi nữa.

---

## `ChangeThreadPriority`

**8 nơi có 8 người gọi.**

Theo dõi gọi biểu thức:

- in `ScramblingThread` (7100d080ac, 540 B)

  ```c
  nn::os::ChangeThreadPriority((ThreadType *)**(undefined8 **)(lVar4 + 0x18),iVar5);
  ```
- in `initMainThread_` (7100e996b8, 184 B)

  ```c
  nn::os::ChangeThreadPriority(pTVar5,0x10);
  ```
- in `ObjectThreadProc` (7100cf8b60, 316 B)

  ```c
  nn::os::ChangeThreadPriority(*(ThreadType **)local_28[3],(int)local_28[5]);
  ```
- in `CallObjectMethodWrapper` (7100cf8de4, 280 B)

  ```c
  nn::os::ChangeThreadPriority((ThreadType *)**(undefined8 **)(this + 0x18),*(int *)(this + 0x28));
  ```
- in `setPriority` (7100ca45ac, 32 B)

  ```c
  nn::os::ChangeThreadPriority(*(ThreadType **)(this + 0xd0),param_1);
  ```
- in `SetPriority` (7100cf9410, 16 B)

  ```c
  nn::os::ChangeThreadPriority((ThreadType *)**(undefined8 **)(this + 0x18),param_1);
  ```
- in `SetPriority` (7100e32714, 8 B)

  ```c
  nn::os::ChangeThreadPriority((ThreadType *)(this + 8),param_1);
  ```
- in `setPriority` (7100e994e0, 32 B)

  ```c
  nn::os::ChangeThreadPriority(*(ThreadType **)(this + 0xe0),param_1);
  ```

---

## `SetTlsValue`

**8 nơi có 4 người gọi.**

Theo dõi gọi biểu thức:

- in `initMainThread_` (7100e996b8, 184 B)

  ```c
  nn::os::SetTlsValue(*(undefined4 *)(this + 0x88),this_00);
  ```
- in `initMainThread_` (7100e996b8, 184 B)

  ```c
  nn::os::SetTlsValue(uVar2,(long)(iVar3 + 1));
  ```
- in `initMainThread_` (7100ca47e0, 324 B)

  ```c
  nn::os::SetTlsValue(*(undefined4 *)(this + 0x88),this_00);
  ```
- in `initMainThread_` (7100ca47e0, 324 B)

  ```c
  nn::os::SetTlsValue(uVar2,(long)(iVar3 + 1));
  ```
- in `ninThreadFunc_` (7100ca4274, 112 B)

  ```c
  nn::os::SetTlsValue(*(undefined4 *)(*(long *)PTR_sInstance_7102fc5728 + 0x88),param_1);
  ```
- in `ninThreadFunc_` (7100ca4274, 112 B)

  ```c
  nn::os::SetTlsValue(uVar1,(long)(iVar2 + 1));
  ```
- in `ninThreadFunc_` (7100e9912c, 132 B)

  ```c
  nn::os::SetTlsValue(*(undefined4 *)(*(long *)PTR_sInstance_7102f9d280 + 0x88),param_1);
  ```
- in `ninThreadFunc_` (7100e9912c, 132 B)

  ```c
  nn::os::SetTlsValue(uVar3,(long)(iVar2 + 1));
  ```

---

## `Free`

**7 cuộc gọi trên 5 người gọi.**

Theo dõi gọi biểu thức:

- in `downloadCoconutImpl` (710018eb1c, 1496 B)

  ```c
  nn::nex::MemoryManager::Free((long)local_198);
  ```
- in `downloadCoconutImpl` (710018eb1c, 1496 B)

  ```c
  nn::nex::MemoryManager::Free(local_1b0);
  ```
- in `downloadCoconutImpl` (710018eb1c, 1496 B)

  ```c
  nn::nex::MemoryManager::Free(local_158);
  ```
- in `free` (7100dda114, 28 B)

  ```c
  nn::mem::StandardAllocator::Free(&DAT_71036563a0);
  ```
- in `FreeThreadSafe` (7100cf4eb4, 28 B)

  ```c
  nn::mem::StandardAllocator::Free((void *)(*(long *)PTR_s_pGv_7102fc6f58 + 0x230));
  ```
- in `CurlFreeCallback` (7100d1a51c, 24 B)

  ```c
  nn::mem::StandardAllocator::Free(&DAT_7103650008);
  ```
- in `DefaultDeallocatorForThreadLocal` (7100dda0a4, 28 B)

  ```c
  nn::mem::StandardAllocator::Free(&DAT_71036563a0);
  ```

---

## `InitializeMessageQueue`

**7 cuộc gọi trên 6 người gọi.**

Theo dõi gọi biểu thức:

- in `SoundThread` (7100e28428, 204 B)

  ```c
  nn::os::InitializeMessageQueue((MessageQueueType *)(this + 0x1f8),(ulong *)(this + 0x240),0x20);
  ```
- in `TaskManager` (7100e2954c, 92 B)

  ```c
  nn::os::InitializeMessageQueue((MessageQueueType *)(this + 0x60),(ulong *)(this + 0xa8),0x20);
  ```
- in `Initialize` (7100e27460, 148 B)

  ```c
  nn::os::InitializeMessageQueue((MessageQueueType *)(this + 0x18),(ulong *)(this + 0x60),0x20);
  ```
- in `Initialize` (7100e27460, 148 B)

  ```c
  nn::os::InitializeMessageQueue((MessageQueueType *)(this + 0x168),(ulong *)(this + 0x1b0),0x21);
  ```
- in `DeviceOutRecorder` (7100e32ccc, 180 B)

  ```c
  nn::os::InitializeMessageQueue((MessageQueueType *)(this + 0x218),(ulong *)(this + 0x260),1);
  ```
- in `allocate` (7100eba35c, 108 B)

  ```c
  nn::os::InitializeMessageQueue((MessageQueueType *)this,puVar2,(long)iVar3);
  ```
- in `allocate` (7100ca3d80, 180 B)

  ```c
  nn::os::InitializeMessageQueue((MessageQueueType *)this,puVar2,(long)(int)param_1);
  ```

---

## `InitializeSemaphore`

**7 cuộc gọi trên 7 người gọi.**

Theo dõi gọi biểu thức:

- in `Semaphore` (7100eba538, 76 B)

  ```c
  nn::os::InitializeSemaphore((SemaphoreType *)(this + 0x20),param_1,param_2);
  ```
- in `Semaphore` (7100eba4f8, 64 B)

  ```c
  nn::os::InitializeSemaphore((SemaphoreType *)(this + 0x20),param_1,param_1);
  ```
- in `initialize` (7100eba584, 8 B)

  ```c
  nn::os::InitializeSemaphore((SemaphoreType *)(this + 0x20),param_1,param_2);
  ```
- in `Semaphore` (7100eba5c0, 68 B)

  ```c
  nn::os::InitializeSemaphore((SemaphoreType *)(this + 0x20),param_2,param_2);
  ```
- in `Semaphore` (7100eba604, 80 B)

  ```c
  nn::os::InitializeSemaphore((SemaphoreType *)(this + 0x20),param_2,param_3);
  ```
- in `Semaphore` (7100eba684, 64 B)

  ```c
  nn::os::InitializeSemaphore((SemaphoreType *)(this + 0x20),param_3,param_3);
  ```
- in `Semaphore` (7100eba6c4, 76 B)

  ```c
  nn::os::InitializeSemaphore((SemaphoreType *)(this + 0x20),param_3,param_4);
  ```

---

## `IsInitialized`

**5 nơi có 4 người gọi.**

Theo dõi gọi biểu thức:

- in `Initialize` (7101350070, 416 B)

  ```c
  bVar3 = chat::IsInitialized();
  ```
- in `Initialize` (7101350070, 416 B)

  ```c
  (bVar3 = transport::IsInitialized(), puVar2 = PTR_s_pVoiceProtocol_7102fd7528,
  ```
- in `setNow` (7100ea7ec4, 204 B)

  ```c
  uVar2 = nn::time::IsInitialized();
  ```
- in `DateTime` (7100ea7be0, 200 B)

  ```c
  uVar2 = nn::time::IsInitialized();
  ```
- in `initializeSystemTimeModule` (7100ea7ca8, 60 B)

  ```c
  uVar2 = nn::time::IsInitialized();
  ```

---

## `GetCurrentTime`

**5 cuộc gọi trên 5 người gọi.**

Theo dõi gọi biểu thức:

- in `setNow` (7100ea7ec4, 204 B)

  ```c
  nn::time::StandardUserSystemClock::GetCurrentTime(aPStack_28);
  ```
- in `GetSystemTime` (7100cf1bb8, 496 B)

  ```c
  iVar6 = nn::time::StandardUserSystemClock::GetCurrentTime((PosixTime *)&local_18);
  ```
- in `GetLocalSystemTime` (7100cf1da8, 144 B)

  ```c
  iVar1 = nn::time::StandardUserSystemClock::GetCurrentTime(aPStack_18);
  ```
- in `setNow` (7100ebc1f8, 48 B)

  ```c
  nn::time::StandardUserSystemClock::GetCurrentTime((PosixTime *)&local_18);
  ```
- in `diffToNow` (7100ebc254, 64 B)

  ```c
  nn::time::StandardUserSystemClock::GetCurrentTime((PosixTime *)&local_18);
  ```

---

## `SetThreadCoreMask`

**4 cuộc gọi trên 4 người.**

Theo dõi gọi biểu thức:

- in `setAffinity` (7100e992cc, 56 B)

  ```c
  nn::os::SetThreadCoreMask(*(ThreadType **)(this + 0xe0),-1,(ulong)uVar1);
  ```
- in `Thread` (7100e991b0, 284 B)

  ```c
  nn::os::SetThreadCoreMask(*(ThreadType **)(this + 0xe0),-1,(ulong)uVar2);
  ```
- in `setAffinity` (7100ca45d4, 48 B)

  ```c
  nn::os::SetThreadCoreMask(*(ThreadType **)(this + 0xd0),-1,(ulong)uVar1);
  ```
- in `SetAffinityMask` (7100e32810, 12 B)

  ```c
  nn::os::SetThreadCoreMask((ThreadType *)(this + 8),param_1,param_2 & 0xffffffff);
  ```

---

## `QueryMemoryInfo`

**3 cuộc gọi trên 3 người gọi.**

Theo dõi gọi biểu thức:

- in `nninitStartup` (71011f5ab4, 108 B)

  ```c
  nn::os::QueryMemoryInfo((MemoryInfo *)&local_58);
  ```
- in `Init` (71011f5b20, 1308 B)

  ```c
  nn::os::QueryMemoryInfo((MemoryInfo *)&local_138);
  ```
- in `dumpMemoryInfo` (71012cdccc, 408 B)

  ```c
  nn::os::QueryMemoryInfo(aMStack_88);
  ```

---

## `GetThreadAvailableCoreMask`

**3 cuộc gọi trên 3 người gọi.**

Theo dõi gọi biểu thức:

- in `setAffinity` (7100e992cc, 56 B)

  ```c
  nn::os::GetThreadAvailableCoreMask();
  ```
- in `Thread` (7100e991b0, 284 B)

  ```c
  nn::os::GetThreadAvailableCoreMask();
  ```
- in `setAffinity` (7100ca45d4, 48 B)

  ```c
  nn::os::GetThreadAvailableCoreMask();
  ```

---

## `GetThreadPriority`

**3 cuộc gọi trên 3 người gọi.**

Theo dõi gọi biểu thức:

- in `Thread` (7100e991b0, 284 B)

  ```c
  uVar4 = nn::os::GetThreadPriority(param_2);
  ```
- in `initMainThread_` (7100ca47e0, 324 B)

  ```c
  uVar2 = nn::os::GetThreadPriority(pTVar4);
  ```
- in `Thread` (7100ca42e4, 236 B)

  ```c
  uVar2 = nn::os::GetThreadPriority(param_2);
  ```

---

## `GetCurrentStackInfo`

**3 cuộc gọi trên 3 người gọi.**

Theo dõi gọi biểu thức:

- in `Thread` (7100e991b0, 284 B)

  ```c
  nn::os::GetCurrentStackInfo((ulong *)&local_38,(ulong *)local_48);
  ```
- in `initMainThread_` (7100ca47e0, 324 B)

  ```c
  nn::os::GetCurrentStackInfo(&local_38,(ulong *)local_48);
  ```
- in `Thread` (7100ca42e4, 236 B)

  ```c
  nn::os::GetCurrentStackInfo(&local_38,(ulong *)local_48);
  ```

---

## `SetThreadName`

**3 cuộc gọi trên 3 người gọi.**

Theo dõi gọi biểu thức:

- in `Thread` (7100e98f50, 476 B)

  ```c
  nn::os::SetThreadName(pTVar3,(char *)param_1[1]);
  ```
- in `LaunchImpl` (7100cf909c, 624 B)

  ```c
  nn::os::SetThreadName((ThreadType *)**(undefined8 **)(this + 0x18),pcVar14);
  ```
- in `Thread` (7100ca4044, 560 B)

  ```c
  nn::os::SetThreadName(pTVar5,(char *)param_1[1]);
  ```

---

## `GetThreadId`

**3 cuộc gọi trên 3 người gọi.**

Theo dõi gọi biểu thức:

- in `initMainThread_` (7100e996b8, 184 B)

  ```c
  uVar2 = nn::os::GetThreadId(pTVar4);
  ```
- in `ninThreadFunc_` (7100e9912c, 132 B)

  ```c
  uVar3 = nn::os::GetThreadId(*(ThreadType **)(param_1 + 0xe0));
  ```
- in `start` (7100e9944c, 80 B)

  ```c
  uVar1 = nn::os::GetThreadId(*(ThreadType **)(this + 0xe0));
  ```

---

## `StandardAllocator`

**3 cuộc gọi trên 3 người gọi.**

Theo dõi gọi biểu thức:

- in `GlobalVariables` (7100d06704, 532 B)

  ```c
  nn::mem::StandardAllocator::StandardAllocator((StandardAllocator *)(this + 0x230));
  ```
- in `InitializeAllocator` (7100dda018, 80 B)

  ```c
  nn::mem::StandardAllocator::StandardAllocator((StandardAllocator *)&DAT_71036563a0);
  ```
- in `initializeGraphicsSystem` (7100e6738c, 2372 B)

  ```c
  nn::mem::StandardAllocator::StandardAllocator(this_00,pvVar11,(ulong)*(uint *)(this + 0xd0));
  ```

---

## `nvnBootstrapLoader`

**3 cuộc gọi trên 2 người gọi.**

Theo dõi gọi biểu thức:

- in `initializeGraphicsSystem` (7100e6738c, 2372 B)

  ```c
  pcVar12 = (code *)nvnBootstrapLoader("nvnDeviceInitialize");
  ```
- in `initializeGraphicsSystem` (7100e6738c, 2372 B)

  ```c
  puVar13 = (undefined *)nvnBootstrapLoader("nvnDeviceGetProcAddress");
  ```
- in `Initialize` (710135d8d8, 192 B)

  ```c
  puVar2 = (undefined *)nvnBootstrapLoader("nvnDeviceGetProcAddress");
  ```

---

## `AllocateMemoryBlock`

**2 cuộc gọi từ 2 vị khách.**

Theo dõi gọi biểu thức:

- in `nninitStartup` (71011f5ab4, 108 B)

  ```c
  nn::os::AllocateMemoryBlock(&local_18,0x2000000);
  ```
- in `initialize` (7100eb9f1c, 52 B)

  ```c
  nn::os::AllocateMemoryBlock((ulong *)this,param_1 + 0x1fffffU & 0xffffffffffe00000);
  ```

---

## `VCT_IsInitialized`

**2 cuộc gọi từ 2 vị khách.**

Theo dõi gọi biểu thức:

- in `VCT_SendAudioEx` (71013528f0, 636 B)

  ```c
  bVar5 = VCT_IsInitialized();
  ```
- in `Dispatch` (710134f738, 344 B)

  ```c
  (bVar2 = VCT_IsInitialized(), (bVar2 & 1) == 0)) {
  ```

---

## `networkInitialize`

**2 cuộc gọi từ 1 người gọi.**

Theo dõi gọi biểu thức:

- in `networkInitialize` (7101332e88, 312 B)

  ```c
  /* enl::NinLanMatchingManagerPlatformImpl::networkInitialize() */
  ```
- in `networkInitialize` (7101332e88, 312 B)

  ```c
  enl::NinLanMatchingManagerPlatformImpl::networkInitialize(NinLanMatchingManagerPlatformImpl *this)
  ```

---

## `localInitialize`

**2 cuộc gọi từ 1 người gọi.**

Theo dõi gọi biểu thức:

- in `localInitialize` (71013349e8, 92 B)

  ```c
  /* enl::NinLocalMatchingManagerPlatformImpl::localInitialize() */
  ```
- in `localInitialize` (71013349e8, 92 B)

  ```c
  enl::NinLocalMatchingManagerPlatformImpl::localInitialize(NinLocalMatchingManagerPlatformImpl *this)
  ```

---

## `PacketBufferFree`

**2 cuộc gọi từ 1 người gọi.**

Theo dõi gọi biểu thức:

- in `PacketBufferFree` (7100cf81f8, 284 B)

  ```c
  /* nn::nex::PacketBufferManager::PacketBufferFree(void*) */
  ```
- in `PacketBufferFree` (7100cf81f8, 284 B)

  ```c
  void nn::nex::PacketBufferManager::PacketBufferFree(undefined8 *param_1)
  ```

---

## `PacketManagementObjectFree`

**2 cuộc gọi từ 1 người gọi.**

Theo dõi gọi biểu thức:

- in `PacketManagementObjectFree` (7100cf8324, 284 B)

  ```c
  /* nn::nex::PacketBufferManager::PacketManagementObjectFree(void*) */
  ```
- in `PacketManagementObjectFree` (7100cf8324, 284 B)

  ```c
  void nn::nex::PacketBufferManager::PacketManagementObjectFree(undefined8 *param_1)
  ```

---

## `AllocateTlsSlot`

**2 cuộc gọi từ 2 vị khách.**

Theo dõi gọi biểu thức:

- in `configure` (7100ea8ec0, 176 B)

  ```c
  nn::os::AllocateTlsSlot(PTR_sCoreNumberTlsSlot_7102f9de68,(_func_void_ulong *)0x0);
  ```
- in `ThreadMgr` (7100e99e68, 76 B)

  ```c
  nn::os::AllocateTlsSlot(this + 0x88,(_func_void_ulong *)0x0);
  ```

---

## `ToCalendarTime`

**2 cuộc gọi từ 2 vị khách.**

Theo dõi gọi biểu thức:

- in `setNow` (7100ea7ec4, 204 B)

  ```c
  nn::time::ToCalendarTime((CalendarTime *)&local_30,(CalendarAdditionalInfo *)0x0,aPStack_28);
  ```
- in `GetLocalSystemTime` (7100cf1da8, 144 B)

  ```c
  (iVar1 = nn::time::ToCalendarTime((CalendarTime *)&local_28,aCStack_40,aPStack_18), iVar1 == 0)
  ```

---

## `QueryMountRomCacheSize`

**2 cuộc gọi từ 2 vị khách.**

Theo dõi gọi biểu thức:

- in `FileDeviceMgr` (7100e64864, 204 B)

  ```c
  nn::fs::QueryMountRomCacheSize(&local_28);
  ```
- in `mount_` (7100e64930, 96 B)

  ```c
  nn::fs::QueryMountRomCacheSize(&local_28);
  ```

---

## `MountRom`

**2 cuộc gọi từ 2 vị khách.**

Theo dõi gọi biểu thức:

- in `FileDeviceMgr` (7100e64864, 204 B)

  ```c
  nn::fs::MountRom("content",pvVar3,local_28);
  ```
- in `mount_` (7100e64930, 96 B)

  ```c
  nn::fs::MountRom("content",pvVar1,local_28);
  ```

---

## `SetMemoryHeapSize`

**1 cuộc gọi qua 1 người gọi.**

Theo dõi gọi biểu thức:

- in `nninitStartup` (71011f5ab4, 108 B)

  ```c
  nn::os::SetMemoryHeapSize(uVar1);
  ```

---

## `nvnMemoryPoolInitialize`

**1 cuộc gọi qua 1 người gọi.**

Theo dõi gọi biểu thức:

- in `initialize` (7100ec3104, 284 B)

  ```c
  driver::NVNMgr::nvnMemoryPoolInitialize(*(undefined8 *)PTR_sInstance_7102f9df58,this,auStack_80);
  ```

---

## `internetInitialize`

**1 cuộc gọi qua 1 người gọi.**

Theo dõi gọi biểu thức:

- in `internetInitialize` (7101332a98, 520 B)

  ```c
  /* enl::NinInetMatchingManagerPlatformImpl::internetInitialize() */
  ```

---

## `InitializeGraphics`

**1 cuộc gọi qua 1 người gọi.**

Theo dõi gọi biểu thức:

- in `initializeGraphicsSystem` (7100e6738c, 2372 B)

  ```c
  nv::InitializeGraphics(pvVar11,(ulong)*(uint *)(this + 0xcc));
  ```

---

## `OpenDefaultDisplay`

**1 cuộc gọi qua 1 người gọi.**

Theo dõi gọi biểu thức:

- in `initializeGraphicsSystem` (7100e6738c, 2372 B)

  ```c
  nn::vi::OpenDefaultDisplay((Display **)(this + 0x1a0));
  ```

---

## `CreateLayer`

**1 cuộc gọi qua 1 người gọi.**

Theo dõi gọi biểu thức:

- in `initializeGraphicsSystem` (7100e6738c, 2372 B)

  ```c
  nn::vi::CreateLayer((Layer **)(this + 0x1a8),*(Display **)(this + 0x1a0));
  ```

---

## `SetLayerScalingMode`

**1 cuộc gọi qua 1 người gọi.**

Theo dõi gọi biểu thức:

- in `initializeGraphicsSystem` (7100e6738c, 2372 B)

  ```c
  nn::vi::SetLayerScalingMode(*(undefined8 *)(this + 0x1a8),2);
  ```

---

## `GetDisplayVsyncEvent`

**1 cuộc gọi qua 1 người gọi.**

Theo dõi gọi biểu thức:

- in `initializeGraphicsSystem` (7100e6738c, 2372 B)

  ```c
  nn::vi::GetDisplayVsyncEvent((SystemEventType *)(this + 0x1d8),*(Display **)(this + 0x1a0));
  ```

---

## `GetNativeWindow`

**1 cuộc gọi qua 1 người gọi.**

Theo dõi gọi biểu thức:

- in `initializeGraphicsSystem` (7100e6738c, 2372 B)

  ```c
  nn::vi::GetNativeWindow(&local_a0,*(Layer **)(this + 0x1a8));
  ```

---

## Cách sử dụng cái này

Đối với mỗi nhập khẩu, cổng phải thực hiện:

1. ** Đọc các biểu hiện ở đây. ** Chúng mang lại sự hiếm hoi và hình dạng của mỗi người
   lập luận, điều mà chữ ký tunk không thể.
2. **Note the caller and its size.** A heavily-used import (e.g. `GetSystemTick` at
   753 địa điểm đang trên con đường nóng; một địa điểm hiếm khi được sử dụng có thể được thực hiện sau này.
3. **Cross - tham khảo dạng đã tuyên bố** trong [PLATORM_REFERCE.md] (PLATORM_REFERCE.md).
4. **Regenerate any caller in full** with `tools/ghidra/ExtractDecompiled.java` to see
   Nó làm gì với kết quả.

## Giới hạn

- ** Gọi cho các biểu thức là một dòng pseudo code**, bị cắt đứt bởi regex của máy quét
  Một cuộc gọi có đường dây liên tiếp xuất hiện.
- **Argument types are Ghidra's inference**, with parameters named `param_N`.
- **A gọi nơi Mạng hiển thị giao diện, không phải hành vi.** Những gì người gọi làm với
  những lập luận của nó vẫn còn bị suy ra từ sự mong đợi của người gọi.
- **Imports được khớp với tên từ bản đồ thunk.** Một nhập khẩu đã đạt qua a
  Con trỏ tính toán hơn là con bọ chét sẽ bị bỏ qua.
- ** Không có việc thực hiện nào trong số này được phục hồi** — không có gì tồn tại trong bãi rác.
