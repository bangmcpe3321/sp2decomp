# sead coverage: what [open-ead/sead](https://github.com/open-ead/sead) gives the port

Assessment of how much of the `sead` engine layer in Splatoon 2 is covered by the
Sự phân hủy đã tồn tại, và những gì cần phải được viết từ đầu.

`sead` is the largest single component of the boot closure — **94 of 232
chức năng** — do đó, sự bao phủ của nó thay đổi hình dạng của cổng.

---

## 1, kho tàng là gì?

**[open-ead/sead](https://github.com/open-ead/sead)** — *"Decompilation of sead: the
Thư viện C++ tiêu chuẩn cho các trò chơi đầu tiên của Đảng Nintendo."

- Nó là một sự phân hủy**, không phải là sự hồi phục hoàn toàn. Tên đến từ việc gỡ lỗi
  Biểu tượng, khẳng định và tổ chức tập tin.
  *" Nhiều tên (đặc biệt cho gạch chân, mẫu) chỉ đơn giản
  Đoán."
- **Không có bằng lái.** Vấn đề là cho một dự án nhập cảng và nên được giải quyết
  Trước khi mã nào được dùng lại.
- Switch-first: `CMakeLists.txt` sets `SEAD_PLATFORM "nin"` as the **only permitted
  value**; Wii U (`cafe`) sources remain in-tree but are not compiled.
- **Not self-contained.** It links `NintendoSDK`/`nnSdk` and `nn_gfx`, and expects
  Nó không thể xây dựng đứng vững được.
- **Completeness is partial.** 178 headers but only 102 `.cpp` files. The README's
  module list is partly aspirational: **`audio`, `geom` and `message` do not exist
  "Các mô- đun bất tử hiện đang thất bại
  xây dựng cho công cụ chuyển đổi."* Không có hình ảnh hoàn chỉnh hàm có thể kiểm chứng được tồn tại.

### Bố trí (phần bổ sung từ phỏng đoán hiển nhiên)

```
include/<module>/...          NOT include/sead/<module>/...
modules/src/<module>/...      NOT src/...
```

18 modules: `basis, codec, container, controller, devenv, filedevice, framework,
gfx, heap, hostio, math, mc, prim, random, resource, stream, thread, time`.

---

## 2. Lớp bảo vệ chống lại sự đóng cửa của hệ nhị phân này.

Of the 39 `sead` subsystems the boot closure touches, **36 are PRESENT** in the
Kho:

|Hạng|Đường dẫn|
|---|---|
|Arena| `include/heap/seadArena.h` |
|AssertConfig| `include/devenv/seadAssertConfig.h` |
|BedStringBase| `include/prim/seadSafeString.h` |
|File tráo đổi vCalendar Comment| `include/time/seadCalendarTime.h` |
|Thiết lập nghiêm trọng| `include/thread/seadCriticalSection.h` |
|Ngày giờ/ Ngày| `include/time/seadDateTime.h`, `seadDateUtil.h` |
|Trang trí Cửa sổComment| `include/thread/seadDelegateThread.h` |
|Vẽ Văn bản Đảo| `include/gfx/seadDrawLockContext.h` |
|EnumUtit| `include/prim/seadEnum.h` |
|Exp Heap| `include/heap/seadExpHeap.h` |
|Name| `include/filedevice/seadFileDeviceMgr.h` |
|Khung làm việc / Trò chơiFramework| `include/framework/seadFramework.h` |
|Toàn cục Random / Ngẫu nhiên| `include/random/` |
|Heap / HeapMgr| `include/heap/` |
|Công cụ chính| `include/filedevice/seadMainFileDevice.h` |
|Thông điệpQue| `include/thread/seadMessageQueue.h` |
|Bản tóm tắt tập tin mật mã| `include/filedevice/nin/seadNinContentFileDeviceNin.h` |
|Name| `include/filedevice/nin/seadNinFileDeviceBaseNin.h` |
|Đọc WriteLock / Semaphore| `include/thread/` |
|Tài nguyên| `include/resource/seadResourceMgr.h` |
|Name| `include/prim/seadStringUtil.h` |
|Tác vụBase| `include/framework/seadTaskBase.h` |
|Thread / ThreadMgr / ThreadUtit| `include/thread/` |

`FindContainHeapCache`, `FormatFixedSafeString`, `IDisposer`, `ListNode`,
`PtrArrayImpl` and `ThreadMgr` have no dedicated file but are defined in adjacent
headers (`seadHeapMgr.h`, `seadSafeString.h`, `seadDisposer.h`, `seadListImpl.h`,
`seadPtrArray.h`, `seadThread.h`).

---

## 3. Khoảng cách — được kiểm tra để đối phó với hệ nhị phân, không giả định

Lớp NX cụ thể của kho là phần mà cổng này thực sự cần, và nó là
Phần còn thiếu.
and the actual symbol table of `main`.

|Hạng|Trong mở rộng / biển| In Splatoon 2 `main` |
|---|---|---|
| `GameFrameworkNx` | header only, **no `.cpp`** | **35 functions** — ctor, dtor, `initialize`, `initializeGraphicsSystem`, `presentAsync_`, `outOfMemoryCallback_` |
| `GraphicsNvn` | header only, **no `.cpp`** | **47 functions** — ctor, `initializeImpl`, `registerQueue`, `registerDefaultCommandBuffer`, `getNewTextureId` |
| `PerformanceMgrNx` |**ABENT**| **14 functions** — `initialize`, `setPerformanceConfiguration`, `isDockIn`, `setCPUPerformance1122MHz`, power measuring |
| `ForegroundBucketMgr` |**ABENT**| 1 function — `initialize(Heap*, u32, u32, bool)` |

Evidence from the binary (`main.elf` symbol table):

```
0x7100e6724c  sead::GameFrameworkNx::initialize(Framework::InitializeArg const&)
0x7100e6738c  sead::GameFrameworkNx::initializeGraphicsSystem(Heap*, Vector2<float> const&)
0x7100e67d2c  sead::GameFrameworkNx::presentAsync_(Thread*, long)
0x7100e70e1c  sead::GraphicsNvn::initializeImpl(Heap*)
0x7100e68c44  sead::PerformanceMgrNx::initialize()
0x7100e68c7c  sead::PerformanceMgrNx::isDockIn()
0x710139fb3c  sead::ForegroundBucketMgr::initialize(Heap*, u32, u32, bool)
```

Kho báu là nơi ít cần thiết nhất.
chuỗi, container, chỉ, thời gian, tài nguyên và lõi tập tin được bao phủ bởi -
nhưng các đồ họa và khuôn khổ mang lại đường dẫn, mà
Được xác định là bước cuối cùng và khó khăn nhất của
giày, chỉ có đầu hay vắng mặt.

---

## 4. Phiên bản ABI: rủi ro thực sự

`include/seadVersion.h` exposes the ABI-relevant differences as compile-time
tính năng vĩ mô, có định sẵn:

```
SEAD_VERSION_BOTW  1    (default)
SEAD_VERSION_SMO   2
SEAD_VERSION_SPL3  3
SEAD_VERSION_TOTK  4
SEAD_VERSION_SMBW  5
SEAD_VERSION_SMM2  6
SEAD_VERSION_CUSTOM 0
```

**Không có Slatoon 2 dự định trước.** Slaptoon 2 chỉ xuất hiện như một nguồn của biểu tượng
Các số liệu được ghi lại gần nhất năm 2017-era là BOTW (1) và SM (2).

Những lá cờ này thay đổi bố trí lớp học và thứ tự tranh cãi, đó là chính xác những gì phá vỡ một
Khớp ABI:

|Cờ|Hiệu ứng|
|---|---|
| `SEAD_SAFESTRING_NONVIRTUAL` | **adds or removes a vtable from `SafeStringBase`** |
| `SEAD_CRITICALSECTION_PURE` | removes `IDisposer` from `CriticalSection` |
| `SEAD_THREAD_GETFIBER` | adds virtual `getFiber()`, removes `getStackCheckStartAddress_()` — **shifts every Thread subclass vtable** |
| `SEAD_THREADMGR_MOVED_SINGLETON_DISPOSER` | moves `ThreadMgr`'s singleton-disposer member |
| `SEAD_FINDCONTAINHEAPCACHE_FIXED` |Sửa chữa 64-bit — ** gián tiếp liên quan đến AArch64**|
| `SEAD_HOSTIO_NONVIRTUAL`, `SEAD_HEAP_FREEANDGETALLOCATABLESIZE_VIRTUAL`, `SEAD_ARCHIVERES_ISCONST`, `SEAD_RTTI_CHECKDERIVEDRUNTIMETYPEINFO_RETURNS_INSTANCE` |hiệu ứng/ điều chỉnh được thêm|

** Cái nào đã có sẵn (nếu có) trùng khớp với Slatoon 2 là không biết**, và quan trọng là —
**not resolvable from assertion strings**: a direct scan of `main` found **zero**
occurrences of any `SEAD_VERSION_*` or `SEAD_*` flag identifier. These are
Các vĩ lệnh thời gian biên dịch mà không để lại dấu vết chuỗi. Các giá trị cần phải được xác định.
Thực tế từ bố trí của nhị phân (có thể kéo dài, bù đắp thành viên,
`sizeof` assertions).

One useful anchor the repository does provide: `seadGameFrameworkNx.h` carries
`static_assert(sizeof(GameFrameworkNx) == 0x210)` and
`static_assert(sizeof(CreateArg) == 0x48)`. Those give concrete numbers to test
chống lại những công trường xây dựng của hệ nhị phân này.

---

## 5, chuyển sang trái

** Dùng nó làm tài liệu tham khảo cấu trúc và như một nguồn cho các lớp không tạo hình.**
Do not treat it as a drop-in ABI-compatible `sead`.

**Những gì nó tiết kiệm cho bạn:** 36 lớp học được bao bọc — quản lý chất đống, dây đàn,
Hộp chứa, luồng nguyên thủy, thời gian, tài nguyên và lõi lưu trữ tập tin.
substantial share of the 94 `sead` functions in the closure, and because it is a
Sự phân hủy phù hợp với việc xây dựng thật, thứ tự thành viên và thứ tự tương ứng là
Rất có thể đúng cho bất kỳ định kiến nào đã được so sánh, biến nó thành một nhà tiên tri tốt cho
hợp lệ hoá các bù đắp lắp ráp của riêng bạn.

**Những gì nó không cứu bạn:** toàn bộ đồ họa chuyển đổi và mang lại khuôn khổ
path. `GameFrameworkNx`, `GraphicsNvn`, `PerformanceMgrNx` and `ForegroundBucketMgr`
Phải được tái tạo lại từ hệ nhị phân — và đó chính xác là chức năng
Nó đặt trên con đường quan trọng đến khung thứ nhất.

> ** Sự sửa đổi bộ phận.** Phần này đã kết thúc *" mơ hồ để viết
> entire graphics bring-up path yourself."* That holds for `sead`'s own graphics
> Lớp học, nhưng nó đã nói rõ vấn đề cho chồng bên dưới.
> to be a single dispatch table, and `nn::gfx` has a reference implementation in
> the companion repository `open-ead/nnsdk`. See
> **[GPRICS_NVN.md] (GPHICS_NVN.md)** cho hình ảnh được chỉnh sửa —
> reference-free layers are `nn::g3d` (292 functions) and `agl` (2,852), not the
> Toàn bộ đường dẫn đồ họa.

** Ba hang động để định cư trước khi dựa vào nó:**

1. Không có hồ sơ giấy phép trong kho chứa. Giải quyết trước khi sử dụng lại mã.
2. **ABI.** Quyết định giá trị cờ của 2 từ nhị phân; đừng giả định
   một sự sắp đặt sẵn.
3. **nSdk phụ thuộc.** Tòa nhà yêu cầu một nnSdk tương ứng, và khớp một với a
   nhị phân năm 2017 là vấn đề riêng biệt.

## Không rõ

- Whether `PerformanceMgrNx` / `ForegroundBucketMgr` are defined *inside* another
  Đầu trang trong kho. Không có tập tin như vậy tồn tại và không có tên nào xuất hiện trong kho
  Khung/gfx tiêu đề đã được đọc đầy đủ, nhưng một tìm kiếm văn bản toàn bộ là
  Không thể nào.
- Which `SEAD_VERSION` preset corresponds to Splatoon 2 — no statement exists.
- Bất cứ số liệu nào có thể định lượng được — cũng không có.
- Dù kho chứa này có xây dựng cho sự chuyển đổi ngày nay — một số mô-đun được viết ra
  Đừng.
