# Boot call graph: `SysInit::Init` and the startup path

Chuỗi khởi động bị giải mã/giải mã cho điểm mục nhập khuôn khổ, phục hồi tĩnh
from `main`. This is the ordered implementation checklist for the
[boot-to-menu mốc quan trọng] (BOOT_MILSTONE.md).

---

## và giới hạn của nó.

Bộ phân hủy của Ghidra chỉ sản xuất *"Re Đang di chuyển khối không thể tiếp cận"* cảnh báo và
khai báo biến cho các hàm này, bởi vì toàn bộ chương trình phân tích tự động
never completes on this binary (113,150 functions) and so `.text` is never
Không có hướng dẫn nào để nó bị phân hủy.

Biểu đồ cuộc gọi bên dưới đã được thu hồi bởi **decoding ARM64 chi nhánh
hướng dẫn trực tiếp từ nhị phân**:

- `BL` (`1001 01 | imm26`) and `B` (`0001 01 | imm26`) carry a PC-relative
  Ngay lập tức, vì vậy gọi cho mục tiêu là chính xác và chỉ yêu cầu một giải mã — không
  Cắt kết nối và không phân tích.
- Hàm giới hạn bởi địa chỉ biểu tượng **next** từ mô-đun
  Đây là âm thanh ở đây chính xác vì hệ nhị phân không phải
  stripped: 112,398 of the 113,150 symbols fall inside `.text`.

**Những mục tiêu đã được giải mã đã được giải quyết trên một xuất khẩu đích thực.
symbol from an independent source (`.dynsym`), which is strong evidence the
Giải mã là chính xác. Thứ tự * trong một chức năng là chính xác.

1. **Body giới hạn là xấp xỉ.** Một giới hạn là biểu tượng tiếp theo, có thể
   Cắt một hàm khi biểu tượng nhỏ hơn nằm bên trong một biểu tượng lớn hơn.
   Kích cỡ được báo cáo là giới hạn trên, không bao giờ thực tế.
2. **Indirect calls are unresolved.** `BLR` targets come from registers and do
   Mọi thông tin ảo trong mã này đều vô hình ở đây.

---

## Dây chuyền bắt đầu

### 1. `nn::init` — memory foundation (`0x71011f5ab4`, 108 bytes)

`Lp::Sys::SysInit::nninitStartup` is the first thing that runs, and it is purely
nói về việc thiết lập bộ nhớ:

```
bl  nn::os::QueryMemoryInfo        (0x71014141e8)
bl  nn::os::SetMemoryHeapSize      (0x71014141f8)
bl  nn::os::AllocateMemoryBlock    (0x7101413ec8)
bl  nn::init::InitializeAllocator  (0x7100dda018)
```

**This is the first thing to port.** Four functions, all `nn::os`/`nn::init`. If
Chúng không hoạt động, không có gì khác có thể phân bổ và nhị phân sẽ chết ngay lập tức.

### 2. `Lp::Sys::SysInit::Init` — framework bring-up (`0x71011f5b20`, 1308 bytes)

Điểm nhập thật sự. 37 chỉ dẫn chi nhánh, theo thứ tự này:

|Thứ tự|Mục tiêu|Mục đích|
|---:|---|---|
| 1 | `Lp::Utl::dumpDateTime` |nhãn thời gian bắt đầu|
| 2 | `nn::os::GetSystemTick` |thời gian|
| 3 | `Lp::Sys::getCpCallbackSeadAssert` |xác nhận ống nước|
| 4 | `sead::AssertConfig::registerCallback` |Đường biển khẳng định|
| 5 | `sead::Framework::InitializeArg` |** Chỉnh sửa trong đó args**|
| 6 | `nn::os::QueryMemoryInfo` |địa chất bộ nhớ|
| 7 | `sead::GameFrameworkNx::initialize` |** Xây dựng công việc**|
| 8 | `Lp::Utl::dumpMemoryInfo` |báo cáo chất đống|
| 9 | `sead::ForegroundBucketMgr::initialize` |**render xô**|
| 10 | `Lp::Sys::HeapGroup::createInstance` |nhóm chồng|
| 11 | `operator new[] / delete[]` |Vùng chọn|
| 12 | `Lp::Sys::HeapGroup::createHeap` |chồng trò chơi|
| 13 | `sead::ExpHeap::create` |đống biển|
| 14 | `Lp::Sys::Framework` (ctor) |Đối tượng khung trò chơi|
| 15 | `sead::GameFrameworkNx::initializeGraphicsSystem` |** Hình ảnh mang lên**|

Hình dạng rất rõ: **asserts bộ nhớ  phục hồi cơ sở đồ họa chồng lên nhau.** đồ họa
Khởi tạo là bước cuối cùng, đó là lý do tại sao thiết bị đồ họa là khó nhất
Ngăn chặn và nơi tự nhiên để chờ đợi bức tường cứng đầu đầu tiên.

### 3 Hệ thống phụ song song

Một khi khuôn khổ đã tồn tại, các fan hâm mộ sự khởi tạo trên toàn nhân viên
chỉ

```
RootTask::createParallelInitThread   (0x71011fcadc, 104 bytes)
    bl  Lp::Sys::WorkerThreadMgr::createWorker   (0x710123d4a0)

RootTask::runParallelInitThread      (0x71011fcb44, 96 bytes)
    bl  Lp::Sys::WorkerThreadMgr::enqueue        (0x710123d1a8)
    b   Lp::Sys::WorkerThreadMgr::run            (0x710123d8c0)

RootTask::parallelInitThreadFunc     (0x71011fca28, 180 bytes)
    bl  sead::FormatFixedSafeString
    bl  Lp::Sys::SysInit::printFromStartTime      (progress log)
    blr <indirect>                                (the actual task dispatch)

RootTask::waitDoneParallelInitThread (0x71011fcba4, 56 bytes)
    bl  Lp::Utl::sleepCurThreadMilliSec  (0x71012cdf50)
```

Hai hậu quả tạo nên cái cổng:

- **`WorkerThreadMgr` is on the critical path.** `enqueue` / `run` /
  `createWorker` must be real, not stubs — the framework's own initialisation is
  dispatched through them. A `return 0` stub here hangs startup rather than
  Thất bại trong sạch.
- **`waitDoneParallelInitThread` spin-waits with a sleep.** If subsystem init
  Không bao giờ báo cáo hoàn thành, chặn giày ở đây mãi mãi.
  nơi để nhìn thấy một cuộc treo cổ vô tận, và nơi đầu tiên để gắn kết một người gỡ lỗi.

---

## Danh sách tiến trình

Nó được chuyển trực tiếp từ dây xích phía trên, được đặt hàng khi cần.

| # |Hàm|Miền tên|Địa chỉ|
|---:|---|---|---|
| 1 | `nn::os::QueryMemoryInfo` | `nn::os` | `0x71014141e8` |
| 2 | `nn::os::SetMemoryHeapSize` | `nn::os` | `0x71014141f8` |
| 3 | `nn::os::AllocateMemoryBlock` | `nn::os` | `0x7101413ec8` |
| 4 | `nn::init::InitializeAllocator` | `nn::init` | `0x7100dda018` |
| 5 | `nn::os::GetSystemTick` | `nn::os` | `0x7101412298` |
| 6 | `sead::AssertConfig::registerCallback` | `sead` | `0x7101397fac` |
| 7 | `sead::Framework::InitializeArg` | `sead` | `0x7100e69894` |
| 8 | `sead::GameFrameworkNx::initialize` | `sead` | `0x7100e6724c` |
| 9 | `sead::ExpHeap::create` | `sead` | `0x7100e76784` |
| 10 | `sead::GameFrameworkNx::initializeGraphicsSystem` | `sead` | `0x7100e6738c` |
| 11 | `sead::ForegroundBucketMgr::initialize` | `sead` | `0x710139fb3c` |
| 12 | `Lp::Sys::HeapGroup::createInstance` | `Lp::Sys` | `0x71011f4ffc` |
| 13 | `Lp::Sys::HeapGroup::createHeap` | `Lp::Sys` | `0x71011f5130` |
| 14 | `Lp::Sys::WorkerThreadMgr::createWorker` | `Lp::Sys` | `0x710123d4a0` |
| 15 | `Lp::Sys::WorkerThreadMgr::enqueue` | `Lp::Sys` | `0x710123d1a8` |
| 16 | `Lp::Sys::WorkerThreadMgr::run` | `Lp::Sys` | `0x710123d8c0` |

Items 1–5 are the true foundation and belong to `nn::os` / `nn::init`. Note that
items 6–11 are **`sead`**, not `nn::` — the engine layer is reached before the
game framework, so `sead` must work early (it has public prior art, which helps).

## Bước tiếp theo

Lặp lại cùng giải mã này một cấp sâu hơn — lấy 16 chức năng trên và giải mã
Những cuộc gọi của họ, để phát triển danh sách xuống khung thứ nhất.
vảy: mỗi đi qua là một đọc ràng buộc của các bộ phận chức năng cụ thể, và cần không
Phân tích toàn bộ chương trình.

---

## Việc đóng cửa quan hệ phụ thuộc (làm xong — và nó nhỏ)

BFS đã được chạy. đi bộ đồ thị cuộc gọi được giải mã bên ngoài từ các gốc sáu khởi động:

|Độ sâu|Hàm|
|---:|---:|
|0 (roots)| 6 |
| 1 | 31 |
| 2 | 54 |
| 3 | 51 |
| 4 | 20 |
| 5 | 11 |
| 6 | 8 |
| 7 | 3 |
|**Sự kết thúc hoàn toàn**| **184** |

Những lớp sâu nhất bị thu hẹp hơn là mở rộng, và không
new subsystems appear. Composition: `sead` 94, `nn` 46, `Lp` 22, `nv` 3, plus 19
Mục nhập cục bộ/ tĩnh, không có biểu tượng.

** Đây là kết quả tiêu đề: đạt được khung thứ nhất yêu cầu 184 chức năng,
Không phải 113, 150. ♪ Dưới chiến lược viết vá đó là toàn bộ
Thực hiện bề mặt cho cột mốc này.

> Con số này đã được báo cáo trước đó là **232** sai rồi:
> the traversal counted every unconditional `B` as a call, including three
> *intra-function branch targets* inside `SysInit::Init` (`0x71011f5bd0`,
> `0x71011f5c08`, `0x71011f5e8c`) which are not functions at all. Verified by
> Quét gốc cho các hướng dẫn chi nhánh và kiểm tra mỗi mục tiêu chống lại các
> symbol table: an unconditional `B` is a tail call only when it lands on a symbol
> start. With that rule, depth 1 is 31 = 30 `BL` targets + exactly one real tail
> call (`Lp::Sys::WorkerThreadMgr::run`), and the total is 184. The fix is in
> `tools/static/boot-closure.mjs`.

### Các hàm số 51 trên con đường quan trọng

Đây là những chức năng không thể
bảng đầu tư đầy đủ, với mỗi
trang cá nhân bằng cách khởi động, ở trong **[PORT_WORKIST.md] (PORT_WORKLST.md).

**`nn::os` — threading and time (24)**

```
nn::os::QueryMemoryInfo              nn::os::CreateThread
nn::os::SetMemoryHeapSize            nn::os::GetCurrentThread
nn::os::AllocateMemoryBlock          nn::os::GetCurrentCoreNumber
nn::os::AllocateTlsSlot              nn::os::SetThreadCoreMask
nn::os::GetTlsValue                  nn::os::GetThreadAvailableCoreMask
nn::os::SetTlsValue                  nn::os::GetThreadPriority
nn::os::InitializeMutex              nn::os::ChangeThreadPriority
nn::os::LockMutex                    nn::os::SetThreadName
nn::os::UnlockMutex                  nn::os::SleepThread
nn::os::InitializeSemaphore          nn::os::GetThreadId
nn::os::InitializeMessageQueue       nn::os::GetCurrentStackInfo
nn::os::GetSystemTick                nn::os::ConvertToTimeSpan
```

**`nn::mem` + `nn::init` — allocation (6)**

```
nn::mem::StandardAllocator           nn::mem::StandardAllocator::Allocate
nn::mem::StandardAllocator::Initialize   nn::mem::StandardAllocator::Free
nn::init::InitializeAllocator
```

**`nn::vi` — display (5)**

```
nn::vi::Initialize                   nn::vi::CreateLayer
nn::vi::OpenDefaultDisplay           nn::vi::SetLayerScalingMode
nn::vi::GetDisplayVsyncEvent
```

**`nv` / NVN — graphics bootstrap (4)**

```
nv::InitializeGraphics               nv::SetGraphicsAllocator
nv::SetGraphicsDevtoolsAllocator     nvnBootstrapLoader / nvnLoadCProcs
```

NVN là Vulkan mỏng của Nintendo, do đó, các bản đồ lớp tương đối trực tiếp
trên Vulkan.

**`nn::fs` — filesystem (2, but load-bearing)**

```
nn::fs::MountRom                     nn::fs::QueryMountRomCacheSize
```

`MountRom` is how `romfs` becomes visible. Nothing loads without it.

**Một vòng lặp sự sống / đồng hồ / misc (9)**

```
nn::oe::Initialize                   nn::nifm::Initialize
nn::time::Initialize                 nn::time::IsInitialized
nn::time::StandardUserSystemClock::GetCurrentTime
nn::time::ToCalendarTime             nn::util::VSNPrintf
nn::diag::detail::LogImpl            nn::os::GetCurrentStackInfo
```

> `nn::nifm` is the network interface manager — reached even for offline boot.
> Nó nên được dập, không được thực hiện.

### The `sead` surface

39 `sead` subsystems are touched, including `HeapMgr`, `ExpHeap`, `Arena`,
`ThreadMgr`, `MessageQueue`, `Semaphore`, `CriticalSection`, `ReadWriteLock`,
`FileDeviceMgr`, `MainFileDevice`, `NinContentFileDevice`, `GameFrameworkNx`,
`GraphicsNvn`, `FrameBufferNvn`, `DisplayBufferNvn`, `PerformanceMgrNx`,
`ResourceMgr`, `TaskBase`, `DrawLockContext`, `ForegroundBucketMgr`.

`sead` is the dominant part of the closure (94 of 232), but it has public prior
Nghệ thuật, vì vậy nó là một nhiệm vụ tái tạo thay vì một nhiệm vụ nghiên cứu.

### Điều này có nghĩa gì cho cảng

Các cột mốc đã sụp đổ từ "không thể" đến **" tan biến 46 nền tảng
functions and port 39 `sead` subsystems."** The `nn::os` and `nn::mem` groups
(~26 chức năng) là nền tảng thật và nên được thực hiện đầu tiên và đúng cách —
`WorkerThreadMgr` dispatches through them, and a `return 0` stub will hang boot
thay vì thất bại lớn tiếng.

**Đừng tin vào con số 232 là hoàn thành.** Hai điểm mù nổi tiếng
Không có gì ngoài công việc:

- `BLR` register-indirect calls are invisible to this method, so **all virtual
  Thông điệp bị mất từ đồ thị. Sự đóng cửa thật lớn hơn.
- 49 mục đóng cửa không có biểu tượng và không được mở rộng, bởi vì cơ thể của chúng
  không thể bị trói buộc.

Sự đóng cửa là một sự ràng buộc của **lower vào công việc, và một sự xác định rõ ràng.

---

## Đóng khoảng cách không biểu tượng (làm xong)

Viên đạn thứ hai bị săn đuổi, và hóa ra là **hầu hết là giả
Báo động** — đáng để ghi âm, vì nó thay đổi cách đọc bản dịch 282.

Tất cả **50** Những người gọi không có biểu tượng đều được phân loại.
`.text`; none were imports or out-of-text stubs. Measuring where each falls within
biểu tượng chứa nó:

|Hiệu quả trong việc bao gồm biểu tượng|Số lượng|Giải thích|
|---|---:|---|
|▪ 0x40 (ở trong một cơ thể chức năng)| **45** |Mục tiêu chi nhánh trong cơ thể|
|< 0x40 (bắt đầu chức năng)| 5 |Hạ cánh hoặc hạ cánh|

Median offset is `0xF4` — deep inside the containing function, not at its start.
Năm vụ gần bắt đầu được kiểm tra từng cá nhân:

```
0x7100e698d8  inside sead::Framework::initialize      +0x2c
0x7100e6a01c  inside sead::GameFramework::initialize  +0x38
0x7100e7b2d0  inside sead::Heap::appendDisposer_      +0x34
0x7100e7d84c  inside sead::EnumUtil::parseText_       +0x3c
0x710000019c  inside _fini                            +0x3c
```

Each is a `BL` target reached from code *elsewhere*, but the address sits inside an
Chức năng hiện có. Đó là dấu hiệu của một cú hạ cánh **brunch** — một cú nhảy có thể
Điểm đến, bãi đáp, hoặc tối ưu hóa đuôi — không phải của một chức năng riêng biệt.

** Kết thúc: không có hàm ẩn đằng sau mục nhập không có biểu tượng.**
Vì vậy, kết thúc node tài khoản cho cơ bản tất cả các mã có thể đạt thông qua
Đó là một tuyên bố mạnh mẽ hơn so với trước đó.
"Từ từ hơn với 49 ẩn số", nghĩa là xương sống có thể mở rộng hoàn thành.

**The remaining gap is exclusively virtual dispatch.** `sead` is built on
Đại biểu, biểu đồ nhiệm vụ và giao diện ảo, vì vậy sự đóng cửa thực sự lớn hơn
23 — nhưng công việc thêm là * các mục tiêu gửi động lực *, không bỏ lỡ tĩnh
chức năng. Định lượng mà cần thiết phân tích con trỏ/ kiểu (nhận diện vtables
và các vị trí cuộc gọi bị hủy bỏ, đó là một dự án riêng biệt từ cuộc gọi tĩnh
Giải mã và không cố gắng ở đây.

---

## Định lượng bề mặt cuộc gọi gián tiếp

Dự án đó đã được bắt đầu, bởi vì "sự đóng cửa thực sự là lớn hơn" không phải là một
có ích tuyên bố không có số.

Method: AArch64 ELF dynamic relocations of type `R_AARCH64_RELATIVE` store a
Con trỏ vào khe. Khi con trỏ mã, khe là mục nhập có thể tự động truy cập.
một mục nhập bảng điểm hàm số, hoặc một tham chiếu theo nghĩa đen — trong cả ba trường hợp
the target is **address-taken** and therefore reachable without any `BL`.

Census of `.rela.dyn` (255,043 entries):

|Định hướng|Số lượng|
|---|---:|
| `R_AARCH64_RELATIVE` | 251,653 |
| `R_AARCH64_ABS64` | 3,362 |
| `R_AARCH64_GLOB_DAT` | 28 |
| **`R_AARCH64_RELATIVE` pointing into `.text`** | **218,729** |
|**Các mục tiêu chức năng bẩm sinh**| **60,025** |

**60, 025 chức năng khác nhau là chiếm địa chỉ.** Đó là 53% của 113, 150
chức năng trong nhị phân. Cụm mục tiêu gián tiếp nhiều nhất trong chính xác
hệ thống con mong đợi của một động cơ C++ ảo:

|Miền tên|Mục tiêu gián tiếp|
|---|---:|
| `nn::nex` | 2,721 |
| `Lp::Sys` | 2,400 |
| `nn::pia` | 2,209 |
| `Game::Coop` | 1,723 |
| `<no symbol>` | 2,075 |

### Điều này thực sự có nghĩa gì

**The BL đóng cửa (232) là một tầng, không phải là một ước tính tổng số công việc.** Hơn một nửa
hệ nhị phân là địa chỉ lấy, vì vậy một phần lớn của nó là vô hình để tĩnh cuộc gọi
Đang giải mã.

Hai khả năng trung thực, vì vậy 60, 025 cũng không đọc quá nhiều.

1. ** Không phải mọi mật mã lấy địa chỉ là một cuộc gọi ảo thật sự.** Một con trỏ trên bảng
   không phải là bằng chứng của việc gửi đi; có thể là một cuộc gọi lại, đăng ký hoặc một cuộc gọi theo nghĩa đen
   Hằng số hồ bơi. 60, 025 là một trên ràng buộc trên *interter* mục tiêu, không phải một đếm
   phương pháp ảo.
2. **Không phải tất cả đều có thể bắt kịp.** Hầu hết 60,025 trong đó thuộc về trò chơi
   Các hệ thống phụ trực tuyến mà khởi động không bao giờ chạm đến.
   không rõ mà không cần phục hồi kiểu vtable.

**Vì vậy, dấu ngoặc trung thực cho việc đóng cửa khởi động thực sự là: :  vội232 ( cuộc gọi trực tiếp
sàn) và dưới 60, 025 (tất cả các địa chỉ- lấy mã).** Thu hẹp nó cần được bật
Nhận diện và loại bỏ các địa điểm gọi khởi động — điều tự nhiên tiếp theo
Bước phân tích, và điều quan trọng cuối cùng chưa được biết trong việc nghiên cứu cột mốc này.
