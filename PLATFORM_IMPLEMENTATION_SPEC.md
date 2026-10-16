# Platform implementation spec

How `main` actually calls each platform import, from a **whole-binary** scan:
**48 imports, 1712 call sites, 1191 calling functions.**

This is the document the 51-function platform layer is written against.

**Why call sites, not signatures.** The implementations are *not in this dump* —
see [PLATFORM_LAYER_LOCATION.md](PLATFORM_LAYER_LOCATION.md). And the platform
thunks are 13-byte stubs that Ghidra frequently renders as `f(void)`, so their
signatures do not give arity. The call sites do.

Companions: [PLATFORM_CALL_SITES.md](PLATFORM_CALL_SITES.md) (boot-closure subset),
[PLATFORM_REFERENCE.md](PLATFORM_REFERENCE.md) (declared ABI signatures),
[ENGINE_REFERENCE.md](ENGINE_REFERENCE.md) (the 126 boot engine functions).

## Method

Each import is invoked through a 13-byte thunk, and callers invoke it as a **named**
function (Ghidra renders `nn::os::GetSystemTick()`). So the scan enumerates
references to each thunk's **entry address**, decompiles every distinct caller, and
keeps the pseudocode lines that call a platform import.

All 50 thunks had callers, so this covers the complete import set rather than a
subset. Reproduce with `tools/ghidra/PlatformThunkCallers.java`.

## Usage ranking

| Import | Call sites | Callers |
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

**677 call sites across 615 callers.**

Observed call expressions:

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
- … and 667 more call sites

---

## `GetTlsValue`

**264 call sites across 246 callers.**

Observed call expressions:

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
- … and 254 more call sites

---

## `LockMutex`

**171 call sites across 161 callers.**

Observed call expressions:

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
- … and 161 more call sites

---

## `UnlockMutex`

**170 call sites across 160 callers.**

Observed call expressions:

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
- … and 160 more call sites

---

## `GetCurrentCoreNumber`

**121 call sites across 112 callers.**

Observed call expressions:

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
- … and 111 more call sites

---

## `InitializeMutex`

**56 call sites across 44 callers.**

Observed call expressions:

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
- … and 46 more call sites

---

## `Initialize`

**46 call sites across 29 callers.**

Observed call expressions:

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
- … and 36 more call sites

---

## `SleepThread`

**23 call sites across 22 callers.**

Observed call expressions:

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
- … and 13 more call sites

---

## `ConvertToTimeSpan`

**21 call sites across 17 callers.**

Observed call expressions:

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
- … and 11 more call sites

---

## `GetCurrentThread`

**17 call sites across 16 callers.**

Observed call expressions:

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
- … and 7 more call sites

---

## `VSNPrintf`

**17 call sites across 13 callers.**

Observed call expressions:

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
- … and 7 more call sites

---

## `LogImpl`

**14 call sites across 8 callers.**

Observed call expressions:

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
- … and 4 more call sites

---

## `Allocate`

**11 call sites across 9 callers.**

Observed call expressions:

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
- … and 1 more call site

---

## `ChangeThreadPriority`

**8 call sites across 8 callers.**

Observed call expressions:

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

**8 call sites across 4 callers.**

Observed call expressions:

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

**7 call sites across 5 callers.**

Observed call expressions:

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

**7 call sites across 6 callers.**

Observed call expressions:

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

**7 call sites across 7 callers.**

Observed call expressions:

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

**5 call sites across 4 callers.**

Observed call expressions:

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

**5 call sites across 5 callers.**

Observed call expressions:

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

**4 call sites across 4 callers.**

Observed call expressions:

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

**3 call sites across 3 callers.**

Observed call expressions:

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

**3 call sites across 3 callers.**

Observed call expressions:

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

**3 call sites across 3 callers.**

Observed call expressions:

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

**3 call sites across 3 callers.**

Observed call expressions:

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

**3 call sites across 3 callers.**

Observed call expressions:

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

**3 call sites across 3 callers.**

Observed call expressions:

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

**3 call sites across 3 callers.**

Observed call expressions:

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

**3 call sites across 2 callers.**

Observed call expressions:

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

**2 call sites across 2 callers.**

Observed call expressions:

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

**2 call sites across 2 callers.**

Observed call expressions:

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

**2 call sites across 1 caller.**

Observed call expressions:

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

**2 call sites across 1 caller.**

Observed call expressions:

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

**2 call sites across 1 caller.**

Observed call expressions:

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

**2 call sites across 1 caller.**

Observed call expressions:

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

**2 call sites across 2 callers.**

Observed call expressions:

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

**2 call sites across 2 callers.**

Observed call expressions:

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

**2 call sites across 2 callers.**

Observed call expressions:

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

**2 call sites across 2 callers.**

Observed call expressions:

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

**1 call site across 1 caller.**

Observed call expressions:

- in `nninitStartup` (71011f5ab4, 108 B)

  ```c
  nn::os::SetMemoryHeapSize(uVar1);
  ```

---

## `nvnMemoryPoolInitialize`

**1 call site across 1 caller.**

Observed call expressions:

- in `initialize` (7100ec3104, 284 B)

  ```c
  driver::NVNMgr::nvnMemoryPoolInitialize(*(undefined8 *)PTR_sInstance_7102f9df58,this,auStack_80);
  ```

---

## `internetInitialize`

**1 call site across 1 caller.**

Observed call expressions:

- in `internetInitialize` (7101332a98, 520 B)

  ```c
  /* enl::NinInetMatchingManagerPlatformImpl::internetInitialize() */
  ```

---

## `InitializeGraphics`

**1 call site across 1 caller.**

Observed call expressions:

- in `initializeGraphicsSystem` (7100e6738c, 2372 B)

  ```c
  nv::InitializeGraphics(pvVar11,(ulong)*(uint *)(this + 0xcc));
  ```

---

## `OpenDefaultDisplay`

**1 call site across 1 caller.**

Observed call expressions:

- in `initializeGraphicsSystem` (7100e6738c, 2372 B)

  ```c
  nn::vi::OpenDefaultDisplay((Display **)(this + 0x1a0));
  ```

---

## `CreateLayer`

**1 call site across 1 caller.**

Observed call expressions:

- in `initializeGraphicsSystem` (7100e6738c, 2372 B)

  ```c
  nn::vi::CreateLayer((Layer **)(this + 0x1a8),*(Display **)(this + 0x1a0));
  ```

---

## `SetLayerScalingMode`

**1 call site across 1 caller.**

Observed call expressions:

- in `initializeGraphicsSystem` (7100e6738c, 2372 B)

  ```c
  nn::vi::SetLayerScalingMode(*(undefined8 *)(this + 0x1a8),2);
  ```

---

## `GetDisplayVsyncEvent`

**1 call site across 1 caller.**

Observed call expressions:

- in `initializeGraphicsSystem` (7100e6738c, 2372 B)

  ```c
  nn::vi::GetDisplayVsyncEvent((SystemEventType *)(this + 0x1d8),*(Display **)(this + 0x1a0));
  ```

---

## `GetNativeWindow`

**1 call site across 1 caller.**

Observed call expressions:

- in `initializeGraphicsSystem` (7100e6738c, 2372 B)

  ```c
  nn::vi::GetNativeWindow(&local_a0,*(Layer **)(this + 0x1a8));
  ```

---

## How to use this

For each import the port must implement:

1. **Read the call expressions here.** They give arity and the shape of each
   argument, which the thunk signature cannot.
2. **Note the caller and its size.** A heavily-used import (e.g. `GetSystemTick` at
   753 sites) is on the hot path; a rarely-used one can be implemented later.
3. **Cross-reference the declared form** in [PLATFORM_REFERENCE.md](PLATFORM_REFERENCE.md).
4. **Regenerate any caller in full** with `tools/ghidra/ExtractDecompiled.java` to see
   what it does with the result.

## Limits

- **Call expressions are single pseudocode lines**, truncated by the scanner's regex
  match. A call whose arguments span lines appears partially.
- **Argument types are Ghidra's inference**, with parameters named `param_N`.
- **A call site shows the interface, not the behaviour.** What the callee does with
  its arguments is still inferred from the caller's expectations.
- **Imports are matched by name from the thunk map.** An import reached through a
  computed pointer rather than the thunk would be missed.
- **No implementation of any of these was recovered** — none exists in the dump.
