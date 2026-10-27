# Danh sách công việc cổng: khởi động tới trình đơn chính

Tiểu Yến Tử!

Tạo ra từ đồ thị cuộc gọi được giải mã.
Đóng cửa khởi động thực sự gọi điện, với tất cả các trang báo động khởi động, do đó,
Thực hiện có thể được viết ngược lại quan sát sử dụng thay vì đoán
Chữ ký.

> `open-ead/nnsdk` ships **no `include/nn/os/` headers**, so `nn::os` contracts
> không được ghi lại ở bất cứ nơi nào công cộng. Các địa điểm cuộc gọi dưới đây là
> Hợp đồng có thẩm quyền.

Bảo mật: 184 chức năng. Các chức năng nền được gọi là 51.

## Giai đoạn 1 — Nền tảng bộ nhớ và hệ điều hành (phải làm việc đầu tiên; chấm ở đây treo khởi động)

### `nn::os` — 24 functions

|Địa chỉ|Hàm|Nơi cuộc gọi bị bỏ hoang|
|---|---|---|
| `0x7101413ec8` | `nn::os::AllocateMemoryBlock` | `Lp::Sys::SysInit::nninitStartup`<br>`sead::Arena::initialize` |
| `0x7101412298` | `nn::os::GetSystemTick` | `Lp::Sys::SysInit::Init`<br>`Lp::Sys::SysInit::Init`<br>`Lp::Sys::Framework`<br>`Lp::Sys::SysInit::printFromStartTime`<br>+2 more |
| `0x71014141e8` | `nn::os::QueryMemoryInfo` | `Lp::Sys::SysInit::nninitStartup`<br>`Lp::Sys::SysInit::Init`<br>`Lp::Utl::dumpMemoryInfo` |
| `0x71014141f8` | `nn::os::SetMemoryHeapSize` | `Lp::Sys::SysInit::nninitStartup` |
| `0x7101412c08` | `nn::os::ConvertToTimeSpan` | `sead::Thread::sleep` |
| `0x7101412d98` | `nn::os::GetThreadAvailableCoreMask` | `sead::Thread::setAffinity`<br>`sead::Thread` |
| `0x71014125e8` | `nn::os::GetTlsValue` | `_ZNK4sead7HeapMgr14getCurrentHeapEv`<br>`_ZNK4sead7HeapMgr15findContainHeapEPKv`<br>`sead::HeapMgr::setCurrentHeap_` |
| `0x7101412b38` | `nn::os::InitializeMutex` | `sead::CriticalSection`<br>`sead::CriticalSection` |
| `0x7101412da8` | `nn::os::SetThreadCoreMask` | `sead::Thread::setAffinity`<br>`sead::Thread` |
| `0x7101412d48` | `nn::os::SleepThread` | `sead::Thread::sleep` |
| `0x7101412ce8` | `nn::os::CreateThread` | `sead::Thread` |
| `0x7101413ee8` | `nn::os::InitializeSemaphore` | `sead::Semaphore` |
| `0x7101412b48` | `nn::os::LockMutex` | `sead::CriticalSection::lock` |
| `0x7101412cf8` | `nn::os::SetThreadName` | `sead::Thread` |
| `0x7101412b68` | `nn::os::UnlockMutex` | `sead::CriticalSection::unlock` |
| `0x7101412c48` | `nn::os::InitializeMessageQueue` | `sead::MessageQueue::allocate` |
| `0x7101413df8` | `nn::os::AllocateTlsSlot` | `sead::ThreadMgr` |
| `0x7101412d88` | `nn::os::ChangeThreadPriority` | `sead::ThreadMgr::initMainThread_` |
| `0x71014126b8` | `nn::os::GetCurrentCoreNumber` | `sead::ThreadMgr::initMainThread_` |
| `0x7101412db8` | `nn::os::GetCurrentThread` | `sead::ThreadMgr::initMainThread_`<br>`sead::ThreadMgr::initMainThread_` |
| `0x7101413de8` | `nn::os::GetThreadId` | `sead::ThreadMgr::initMainThread_` |
| `0x7101412d08` | `nn::os::SetTlsValue` | `sead::ThreadMgr::initMainThread_`<br>`sead::ThreadMgr::initMainThread_` |
| `0x7101412d28` | `nn::os::GetCurrentStackInfo` | `sead::Thread` |
| `0x7101412d18` | `nn::os::GetThreadPriority` | `sead::Thread` |

### `nn::mem` — 5 functions

|Địa chỉ|Hàm|Nơi cuộc gọi bị bỏ hoang|
|---|---|---|
| `0x7101413038` | `nn::mem::StandardAllocator` | `nn::init::InitializeAllocator` |
| `0x7101413cd8` | `nn::mem::StandardAllocator` | `sead::GameFrameworkNx::initializeGraphicsSystem` |
| `0x7101413008` | `nn::mem::StandardAllocator::Initialize` | `nn::init::InitializeAllocator` |
| `0x7101412ee8` | `nn::mem::StandardAllocator::Allocate` | `malloc` |
| `0x7101412ef8` | `nn::mem::StandardAllocator::Free` | `free` |

### `nn::init` — 1 function

|Địa chỉ|Hàm|Nơi cuộc gọi bị bỏ hoang|
|---|---|---|
| `0x7100dda018` | `nn::init::InitializeAllocator` | `Lp::Sys::SysInit::nninitStartup` |

## Giai đoạn 2: Xe đạp cứu sinh, thời gian, việc khai thác gỗ

### `nn::time` — 4 functions

|Địa chỉ|Hàm|Nơi cuộc gọi bị bỏ hoang|
|---|---|---|
| `0x7101413048` | `nn::time::Initialize` | `sead::DateTime::setNow` |
| `0x7101413e28` | `nn::time::IsInitialized` | `sead::DateTime::setNow` |
| `0x7101412eb8` | `nn::time::StandardUserSystemClock::GetCurrentTime` | `sead::DateTime::setNow` |
| `0x7101412ec8` | `nn::time::ToCalendarTime` | `sead::DateTime::setNow` |

### `nn::nifm` — 1 function

|Địa chỉ|Hàm|Nơi cuộc gọi bị bỏ hoang|
|---|---|---|
| `0x7101413268` | `nn::nifm::Initialize` | `Lp::Sys::SysInit::Init` |

### `nn::diag` — 1 function

|Địa chỉ|Hàm|Nơi cuộc gọi bị bỏ hoang|
|---|---|---|
| `0x7101412708` | `nn::diag::detail::LogImpl` | `Lp::Utl::dumpDateTime`<br>`Lp::Utl::dumpMemoryInfo`<br>`Lp::Utl::dumpMemoryInfo`<br>`Lp::Utl::dumpMemoryInfo`<br>+3 more |

### `nn::oe` — 1 function

|Địa chỉ|Hàm|Nơi cuộc gọi bị bỏ hoang|
|---|---|---|
| `0x71014121c8` | `nn::oe::Initialize` | `sead::PerformanceMgrNx::initialize` |

### `nn::util` — 1 function

|Địa chỉ|Hàm|Nơi cuộc gọi bị bỏ hoang|
|---|---|---|
| `0x7101412a78` | `nn::util::VSNPrintf` | `sead::StringUtil::vsnprintf` |

## Giai đoạn 3 — Hệ thống tập tin (rômfs trở nên hữu hình)

### `nn::fs` — 2 functions

|Địa chỉ|Hàm|Nơi cuộc gọi bị bỏ hoang|
|---|---|---|
| `0x7101413ca8` | `nn::fs::MountRom` | `sead::FileDeviceMgr` |
| `0x7101413c98` | `nn::fs::QueryMountRomCacheSize` | `sead::FileDeviceMgr` |

## Giai đoạn 4 — Hiển thị và khởi động NVN

### `nn::vi` — 6 functions

|Địa chỉ|Hàm|Nơi cuộc gọi bị bỏ hoang|
|---|---|---|
| `0x7101413d18` | `nn::vi::CreateLayer` | `sead::GameFrameworkNx::initializeGraphicsSystem` |
| `0x7101413d38` | `nn::vi::GetDisplayVsyncEvent` | `sead::GameFrameworkNx::initializeGraphicsSystem` |
| `0x7101413d58` | `nn::vi::GetNativeWindow` | `sead::GameFrameworkNx::initializeGraphicsSystem` |
| `0x7101413cf8` | `nn::vi::Initialize` | `sead::GameFrameworkNx::initializeGraphicsSystem` |
| `0x7101413d08` | `nn::vi::OpenDefaultDisplay` | `sead::GameFrameworkNx::initializeGraphicsSystem` |
| `0x7101413d28` | `nn::vi::SetLayerScalingMode` | `sead::GameFrameworkNx::initializeGraphicsSystem` |

### `nv` — 3 functions

|Địa chỉ|Hàm|Nơi cuộc gọi bị bỏ hoang|
|---|---|---|
| `0x7101413cc8` | `nv::InitializeGraphics` | `sead::GameFrameworkNx::initializeGraphicsSystem` |
| `0x7101413cb8` | `nv::SetGraphicsAllocator` | `sead::GameFrameworkNx::initializeGraphicsSystem` |
| `0x7101413ce8` | `nv::SetGraphicsDevtoolsAllocator` | `sead::GameFrameworkNx::initializeGraphicsSystem` |

### `nvn` — 2 functions

|Địa chỉ|Hàm|Nơi cuộc gọi bị bỏ hoang|
|---|---|---|
| `0x7101413d48` | `nvnBootstrapLoader` | `sead::GameFrameworkNx::initializeGraphicsSystem`<br>`sead::GameFrameworkNx::initializeGraphicsSystem` |
| `0x7100ddd6e4` | `nvnLoadCProcs` | `sead::GameFrameworkNx::initializeGraphicsSystem`<br>`sead::GameFrameworkNx::initializeGraphicsSystem` |

## Ghi chú

- **Addresses are module-absolute** with image base `0x7100000000`.
- ** Đếm số điện thoại đến từ việc đóng cửa khởi động.** Một chức năng có thể có
  Nhiều người gọi khác trong nhị phân; những người này không có trên đường đi giày.
- **Stub policy:** `nn::os`, `nn::mem` and `nn::init` must be real. A
  `return 0` stub in the thread or allocator layer hangs boot silently rather
  than failing loudly, because `Lp::Sys::RootTask` dispatches initialisation
  through `WorkerThreadMgr` onto those primitives.
- **`nn::nifm` should be stubbed, not implemented** — it is the network
  Bộ quản lý giao diện và được đạt ngay cả trên đường dẫn khởi động ngoại tuyến.
