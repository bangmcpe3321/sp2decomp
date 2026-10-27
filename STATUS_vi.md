# Đọc theo thứ tự và tình trạng trung thực

This repository grew out of one question: *can Splatoon 2's `main` be decompiled well
đủ để chuyển đường dẫn khởi động tới PC? * Trang này nói những gì đã được trả lời, những gì không, và
đọc cái gì trước.

---

## Phiên bản ngắn

|Hỏi|Trả lời|
|---|---|
|Một kẻ phá hoại có thể bị điều khiển chống lại mục tiêu này không?|**Có** (DECOMPIED.md) (DECOMPILEPIE + Ghidra on Linux/WSL.)|
|Đường đi giày đã được giải mã chưa?|**Có** (Tiếng Châu Phi) (Tiếng Châu Phi)|
|Các chức năng thực sự có sẵn không?| **Yes** for `main` â 5 decompiled, sizes match hand-decoding exactly ([DECOMPILED_BODIES.md](DECOMPILED_BODIES.md)) |
| Is `main`'s platform layer in the game dump? |**Nó được nhập khẩu và giải quyết bởi hệ thống vào lúc chạy ([PLATORM_LAYER_LCAD.md] (PLATORM_LAYER_LCORE.M.M)|
| Can the platform layer be decompiled from `sdk`? | **No.** `sdk` is the filesystem service â 233 `nn::fs` exports, zero `nn::mem`/`nn::init`/`nn::vi`/`nn::time` |
|Có nguồn cung cấp nào từ đó đến cảng không?|**Không.** Các chức năng 51 nền phải được viết|
|Hợp đồng cho họ có thể hồi phục không?| **Yes** â from call sites in `main`. [PLATFORM_IMPLEMENTATION_SPEC.md](PLATFORM_IMPLEMENTATION_SPEC.md) |
|Cổng đã khởi động chưa?| **Yes.** `port/` builds a tested `nn::os` subset â 21 contract checks passing |

** Kết quả thực tế:** Nền tảng của cổng là một lớp mới thực hiện lại của
chính xác 51 chức năng**, không phải là cổng mã đã có. Đó là một chức năng nhỏ hơn và tốt hơn định nghĩa
nhưng đó không phải là một nhiệm vụ triệt tiêu.

**Status of the port itself:** `port/` implements the 5 hottest imports
(`GetSystemTick`, `GetTlsValue`, `LockMutex`/`UnlockMutex`, `GetCurrentCoreNumber`, plus
`InitializeMutex` and friends) against the call-site spec. It compiles under GCC 15.2,
C Make 4,2 và Ninja trong WSL và thông qua 21 hợp đồng kiểm tra xác nhận các thuộc tính của nó
Cần thiết người gọi. Còn lại ~46 nhập khẩu chưa được viết.

---

## Thứ tự đọc

### 1, bắt đầu ở đây.

- **[REDME.md] (README.md)**_BAR_Mục tiêu nhận dạng mục tiêu, bản đồ bộ nhớ, khảo sát hệ thống phụ.
- **[sub System-map.txt] (sub System-map.txt)**_BAR_Các hệ thống hệ thống con bị hỏng (2.7 MB).

### Kế hoạch cổng số 2.

- ♪ Phạm vi và chiến lược.
- **[Không có thông tin cá nhân. md] (Không có thông tin gì về việc thu hẹp mục tiêu: khởi động trình đơn.
- **[Tiếng nhạc] [Tiếng nhạc] [Tiếng nhạc] [Tiếng nhạc] [Tiếng nhạc] [Tiếng nhạc] [Tiếng nhạc] [Tiếng nhạc] [Tiếng nhạc] [Tiếng nhạc] [Tiếng nhạc] [Tiếng nhạc] [Tiếng nhạc] [Tiếng nhạc] [Tiếng nhạc] [Tiếng nhạc] [Tiếng nhạc] [Tiếng nhạc] [Tiếng tắt] [Tiếng nhạc] [Tiếng nhạc] [Tiếng nhạc] [Tiếng nhạc] [Tiếng nhạc] [Tiếng tắt] [Tiếng máy] [Tiếng máy] [Tiếng máy] [Tiếng nhạc] [Tiếng nhạc] [Tiếng nhạc] [Tiếng nhạc] [Tiếng tắt] [Tiếng máy] [Tiếng máy] [Tiếng nhạc] [Tiếng lên] [Tiếng lên] [Tiếng máy] [Tiếng máy] [Tiếng] [Tiếng] [Tiếng] [ (Tiếng lên] [Tiếng máy] [Tiếng lên] [Tiếng] [Tiếng] [Tiếng máy] [Tiếng] [Tiếng] [Tiếng] [Tiếng] [Tiếng] [ (Tiếng] [Tiếng]] [ (Tiếng] [Tiếng]] [ tiếng máy]] [ (Tiếng máy]]] [ (Tiếng máy]]] [Tiếng máy]] [ (Tiếng] [Tiếng] [
  Kết thúc chức năng 184.
- **[PORT_WORKLST.md] (PORT_WORKLST.md)**** Bản danh sách thực thi khởi động 51 chức năng.
  Địa chỉ địa chỉ của nó có khe cắm, không phải mã số** Xem "Những khuyết tật tri thức" bên dưới.

### 3. Sự phân hủy

- **[DDCOMPIAPIE_UNBLED.MD] [DECOMPILEPIEDEDEDEPEDEDEDEDEDEDEDEDEDEDEDEDEDEDED.DEDEDEPEPED.DEDEDEPEDED.EDED.ED.ED.ED.ED.ED.ED.ED.EDED.ED.ED.ED.ED.ED.ED.E.E.E.E.E.E.E.ED.E.E.E.E.E.E.E.E.E.E.E.E.E.E.E.E.E.E.E.E.E.E.E.E.E.E.E.E.D.E.E.E.E.E.E.E.E.E.E.E.E.E.E.E.E.E.E.E.
  Làm cho nhà cung cấp Ghidra của REA sử dụng mục tiêu này.
- **[DEDCOMPILEED_BOD.md] (DCOMPILEED_DES.med)*****Người phá vỡ đầu tiên
  bodies from `main`, and the cross-check that validated the hand-decoded work.
- **[VERIFIATETE.md] (VERFIRICation.md)**, **[VTable_VERIFIAD.md] (VERIFIE_VERICHEN.md)**
  Bố trí và xác minh được chống lại hệ nhị phân.

### 4. các tham số thực hiện

Đây là những tài liệu một cổng được viết ngược lại:

|Tài liệu|Những gì nó mang lại cho bạn|
|---|---|
|**[PLATORM_ CALL_SBERS.md] (PLATORM_CALL_SBES.md)**| **How `main` calls each platform function** â 41 callees, 66 call sites. Arity and argument shape. |
|**[PLATORM_REFERCE.md] (PLATORM_REFERCE.md)**| Observed ABI signatures of the 51 imports declared in `main`. |
|**[ENGINE_REFERCE.md] (ENGINE_REFERCE.md)**|Phiên động cơ khởi động 126 với dấu hiệu và vai trò, được băng bó bằng độ sâu.|

### Tại sao lớp nền bị thiếu

- **[FIRWEDEEEEEEEE.ALY.MD] (FIRMWEED_ALY.md)** tuyến đường phần mềm: những gì nó cung cấp, và tại sao nó không sản xuất lớp nền tảng.
- **[PLATORM_LAYER_LCORE.md] (PLATORM_LAYER_LCING.md)** Phát hiện quyết định,
  với bằng chứng.
- **[IMPORT_MAPPING.md](IMPORT_MAPPING.md)** â how `main` resolves imports (PLT
  lười biếng kết hợp), và tại sao không có bản đồ tĩnh.
- **[SDK_ANALYSIS.md](SDK_ANALYSIS.md)** â the `sdk` investigation log, including the
  Kết quả tiêu cực.
- **[SDK_REFERENCE.md](SDK_REFERENCE.md)** â 10 genuinely recovered `sdk` functions
  (không phải là lớp nền)

### Hệ thống sinh thái và đồ họa

- **[ECOSYSTEM.md](ECOSYSTEM.md)** â all 16 `open-ead` repositories surveyed.
- **[SEDEDED_CEREPER.md]**, **[AGL_CERRSE.md] (AGL_CERVE.md.md)**,
  **[NWEEEEES.md] (NNWEED_CERER.md)** Cái gì đã bị xóa bỏ.
- **[GPRICS_NVN.md] (GPHICS_NVN.md)** Tại sao bảng thông tin đơn của NVN làm cho GPU
  tiết kiệm được.

### Năm, động cơ được tái tạo.

- **[RECOMP_NVN_NOT_LINKED.md](RECOMP_NVN_NOT_LINKED.md)** - **architectural decision point**: NVN is **NOT** linked into Splatoon 2 (`nvnBootstrapLoader` is an IMPORT) and the game makes **ZERO** `nvdrv`/`nvhost` calls. Ryujinx's ioctl layer is the **wrong layer** -> reuse is impossible. But **`nvnLoadCProcs` IS in-binary**, so **453 stubs behind one resolver** is the whole boot surface. No Vulkan, no shaders needed to boot.
- **[RECOMP_BOOTSTRAP_3OF5.md](RECOMP_BOOTSTRAP_3OF5.md)** - the four steps IMPLEMENTED: **1/5 lock ?, 2/5 arena ?, 3/5 root heap ?** (`0x5001000000`). Fault now only at 4/5 `setCurrentHeap_` because `HeapMgr::sInstance` is null.
- **[RECOMP_BOOTSTRAP_SHAPE.md](RECOMP_BOOTSTRAP_SHAPE.md)** - the bootstrap shape, read: `HeapMgr::initialize(size)` starts with **`CriticalSection::lock()`**, then `Arena::initialize(size)`. **Nothing is allocated before the lock** -- so the sequence is lock -> arena -> heap -> install. `initializeImpl_` was not in this path (explains its `(nil)` fault).
- **[RECOMP_NO_PARENT_HEAP.md](RECOMP_NO_PARENT_HEAP.md)** - **first working heap creation**: `ExpHeap::tryCreate(buf,size,name,bool)` -- the **4-arg NO-PARENT overload** -- returns a real root heap (`0x5001000000`). Bootstrap now one layer deeper: `HeapMgr::sInstance` does not exist.
- **[RECOMP_HEAP_SIZE_NOT_ENOUGH.md](RECOMP_HEAP_SIZE_NOT_ENOUGH.md)** - the measured 3218 MB heap was **applied and the fault is IDENTICAL** -> the size was never the blocker. Also **RETRACTS** the `sdk+0x86868` caller claim (`bl` targets elsewhere).
- **[RECOMP_HEAP_SIZE_MEASURED.md](RECOMP_HEAP_SIZE_MEASURED.md)** - **THE REAL HEAP SIZE IS MEASURED**: `0xC9200000` = **3218 MB**, caller `sdk+0x86868`. The port gave 512 MB. Size derives from `TotalMemoryAvailable - 67 MB`, using a value the port already returns.
- **[RECOMP_RYUJINX_GDB.md](RECOMP_RYUJINX_GDB.md)** - **ground truth**: attached gdb to the real game in Ryujinx via a **reverse bridge** (defeats WSL->Windows inbound block without admin). **`sdk_base = 0xbdd2000` verified two ways**, `svcSetHeapSize = 0xbe70660`. Static offsets confirmed against the live module.
- **[RECOMP_STARTUP_SEQUENCE.md](RECOMP_STARTUP_SEQUENCE.md)** - **the real start-up, read**: entry is `main+0x24` after the MOD0 header; `main` has **ZERO** SVCs; `sdk` has a 1:1 stub table with `svcSetHeapSize` at **`sdk+0x9e660`**; `rtld` does **no** heap setup. The remaining question is one lookup: **who calls that stub**.
- **[RECOMP_BOOTSTRAP_ATTEMPTED.md](RECOMP_BOOTSTRAP_ATTEMPTED.md)** - the bootstrap was **IMPLEMENTED** and the engine **REJECTED it**: `tryCreate(buf,size,name,nullptr,false)` returns null. The null-parent assumption is **FALSIFIED**. Guessing signatures is exhausted; the game's own start-up must be read.
- **[RECOMP_BOOP_CARR_CIRLLLLL.Md] (RECOMP_ CAP_CIRRLLLLLL.md)** - đấu trường đã bị săn đuổi: lỗi IDisposer (heap=null) bởi vì ** cần phải tạo ra đống thứ đầu tiên**. Đây là một phụ thuộc vòng tròn ** chứ không phải là một con bọ_BAR_ phương pháp thử nghiệm đã kiệt sức; những gì vẫn còn là một nhiệm vụ xây dựng.
- **[RECOMP_ONE_INPUT_REFUTED.md](RECOMP_ONE_INPUT_REFUTED.md)** - the one-input hypothesis is **REFUTED**: supplying a size moves the fault to `sead::Heap::Heap` (null arena). This is a **multi-step framework bootstrap**, not a missing number.
- **[RECOMP_ZERO_SOURCE.md](RECOMP_ZERO_SOURCE.md)** - the zero is TRACED: `Framework::initialize` receives an `InitializeArg` whose two size fields are **both zero** (`+102`..`+141`). One defect, two symptoms.
- **[RECOMP_SYSINFO_RULED_OUT.md](RECOMP_SYSINFO_RULED_OUT.md)** - all 10 `svcGetInfo` types logged: type 16 is **never queried**, so `system_resource_size` (my `0x0` field) is **ELIMINATED**. The guess would have cost a round; the measurement cost one rebuild.
- **[RECOMP_HEAPMGR_ZERO.md](RECOMP_HEAPMGR_ZERO.md)** - the post-`nnMain` blocker identified: the game calls `HeapMgr::initialize(size=0x0)`, so `createRootHeap_` never runs and `getCurrentHeap()` faults. Leading cause: a memory query returning 0.
- **[RECOMP_NMAIN_REACHED.md] (RECOMP_NMAIN_REACHD.md) - **?
nMain IS REACHED** của trò chơi là Lp:::Sys Init:: nó chạy và đi ra biển:: GamesFrameworkNx::initize. Động cơ mới: biển:get hepMgr:get Heap() không có chồng. ** Mục tiêu chính của mục tiêu là đạt được**
- **[RECOMP_DOUBLE_CTOR_ROOT_CAUSE.md](RECOMP_DOUBLE_CTOR_ROOT_CAUSE.md)** - **ROOT CAUSE FOUND**: `init_module` ran every constructor TWICE (`_init` + the `init_array` loop), which produced the duplicate PGV registration and the self-link. **PGV hang FIXED**; failure moved to `sead::ExpHeap::tryCreate`.
- **[RECOMP_NOT_BETTER.md] (RECOMP_NOT_BETTER.md)** - ** Quyết định tiêu cực**: đồ thị tĩnh-ini của pto là IDENTical để bán lẻ (202 vs 202 PGV type, 121 vs
Đổi nhà chẳng mua được gì cả.
- **[RECOMP_PROTO_AND_HEAP.md](RECOMP_PROTO_AND_HEAP.md)** - March-2017 proto extracted (SDK 0.12.17.0, 7 modules, shifted numbering, debug menu); NPDM shows `svcSetHeapSize` is the real memory mechanism and it is **never called** (0x). Heap moved into guest space -- **principled, but the hang is unchanged**.
- **[RECOMP_FINAL_R12.md] (RECOMP_FINAL_R12.md)** - **FINAL**: giả thuyết tổng hợp lại là **REFUTEED** (cur= x19), cmp x0,x19 là một Kiểm tra hoá lặt vặt **; recomper là ** tại trang web này. Tóm tắt đầy đủ các câu hỏi mở.
- **[RECOMP_MISP_CMP.md] (RECOMP_MISING_CMP.md)** - **MEPDEPREPREPY**: khách Addvariable có 2 bộ đã so sánh; bộ trả lại chỉ có 2 lần so sánh, cả hai lần với 0. Có thể **recompilation**-- - * khả năng kết hợp bởi một bộ ghi.
- **[RECOMP_TWO_EXIT.md] (RECOMP_TWO_EXIT_EXT.md)** - ** Khách mời có hai loại thử ra** (cmp x 0, x 0, x19 + cbz x0); vòng lặp không hiển thị chỉ số không. Hoặc là một lỗi hỗ trợ ** hoặc là bản đồ của tôi không đầy đủ - chưa được phân biệt.
- **[RECOMP_AARCH64_EXIT.md](RECOMP_AARCH64_EXIT.md)** - real guest code read: `SetNext(node, nullptr)` is explicit, so the list is **NULL-TERMINATED**; the circular reading is WEAKENED and the recompilation-defect hypothesis DISPROVED. Also: `exefs/main` is LZ4 -- never read it at computed offsets.
- **[RECOMP_SECOND_REG_CTOR.md](RECOMP_SECOND_REG_CTOR.md)** - backtrace: the second registration comes from a LEGITIMATE `init_array` ctor (#1364). Port does not double-run. **Promotes the CIRCULAR-LIST reading to leading** -- the exit test compares to literal 0.
- **[RECOMP_DUPLATE_PROVEN.md] (RECOMP_DUPLATE_P_PROVEN.md)** - ** Tự phức tạp hoá bởi gdb**: 0x7103fb90 TWICE đã đăng ký (thứ hai đóng chuỗi thành một chu kỳ). Init_rayar là CLEAN (16, 0up), do đó nguyên nhân khác là. Cũng rút ra yêu cầu vòng 5 bị phá vỡ.
- **[RECOMP_CURSOR_RESOLVED.md] (RECOMP_CURROR_ RESOLVED.md)** - COR: con trỏ là khách truy cập x20 = 0x710304fb90, vậy vòng 2 vòng 2 vòng đầu của 5 được rút lại. Sự thật mới: đối tượng được đăng ký là một trong những (0x71650210), do đó, tự liên kết tự gọi này.
- **[RECOMP_CHAIN_BROKEN.md](RECOMP_CHAIN_BROKEN.md)** - the chain does NOT walk (`next = 0x3d`, not a pointer); the real PGV list head is not located and round 2's pointer path is put IN DOUBT.
- **[RECOMP_CHAIN_CORRECTION.md](RECOMP_CHAIN_CORRECTION.md)** - CORRECTIONS: the list head is NOT the node (round 3 retracted); `call_preserving` hooks MISS direct recompiled calls; `+0x2fc75b0` is not a count.
- **[RECOMP_DUPLICATE_REGISTRATION.md](RECOMP_DUPLICATE_REGISTRATION.md)** - root cause hypothesis: DUPLICATE REGISTRATION makes `tail->SetNext(new_node)` link a node to itself. `SetNext` writes +8, confirmed. Also retracts my round-2 overlap worry.
- **[RECOMP_GETNEXT_PROVEN.md](RECOMP_GETNEXT_PROVEN.md)** - mechanism FULLY PROVEN: vtable slot +0x28 resolves to `GetNext()`, which is literally `return *(this+8)`, and that field is the node itself. Bad node is `PseudoGlobalVariable<SendMultiParameter>`.
- **[RECOMP_GETNEXT_MECHANISM.md](RECOMP_GETNEXT_MECHANISM.md)** - mechanism identified: the node is in **.bss** (zero at load) so its self-pointer was WRITTEN AT RUNTIME; `GetNext()`/`SetNext()` exist and the walk advances on `GetNext()`.
- **[RECOMP_PGV_CTOR.md] (RECOMP_PGV_CTOR.md)** - trình diễn sẽ khởi động nút; cả hai ứng cử viên vòng- 13 loại bỏ. nút xấu trước khi gọi này và là một đối tượng khác.
- **[RECOMP_ADDVARIABLE.md](RECOMP_ADDVARIABLE.md)** - `AddVariable` IS the spinning function; its empty-list branch is CORRECT, eliminating self-linking. Defect narrowed to node initialisation.
- **[RECOMP_EXIT_CONDITION.md](RECOMP_EXIT_CONDITION.md)** - the EXIT CONDITION read: the walk stops when a callee returns null; the node's `next` is itself, so null never comes. Resolves round 12's fork.
- **[RECOMP_LER_CYCLE.md] (RECOMP_LST_CYCLE.md)** - chu trình CONFIRED bởi bộ nhớ: một danh sách mà có
Ext chỉ đến chính nó; vòng lặp đọc lại một con trỏ chưa thay đổi.
- **[RECOMP_PP_ NAMED.md] (RECOMP_P_NAMED.md)** - với gdb đã cài đặt, xoay là NAMED:
n::nex::PseudoGlobalvariableList::: AddVialingable trong một danh sách.
- **[RECOMP_PP_DIAGNOED.md] (RECOMP_SP_DIAGENDED.md)** - Cuộc treo cổ là một SPIN (Sstate R, wchan 0), allocator dispROVED tại 512 MB; hai sợi công nhân đang ngủ.
- **[RECOMP_HANG_LCING.md] (RECOMP_HANG_LCED.md)** - 10 phút chạy chứng minh vòng 9 là một đoạn, chứ không phải là chậm, và xác định nó:
n:nex::PseudoGlobalvariable [Stream Settings> tor, chính #1367.
- **[RECOMP_ALLOCATOR.md] (RECOMP_ALLOCATOR.md)** - ** the Allocator chưa bao giờ được cài đặt**; mọi thứ
Cố định: 1,368 nhà máy chính hiện đang chạy và tiến trình NO LONGER CESES.
- **[RECOMP_INT_STTUS.md] (RECOMP_INT_STATUS.md)** - 74 SDK Xây dựng là SILP SKPED (init_st 2 vs1). cố định; toàn bộ 74 chạy. Wonder-v-Slapoon-2 không thay đổi.
- **[RECOMP_NNNOS_INTOR.md] (RECOMP_NNOS_NINTER.md)** - SDK init tìm kiếm và chạy: Slapoon 2 là thời đại cũ nnos*
Chưa xác định được mảnh còn thiếu, mà khởi động đã đi quá xa.
- **[RECOMP_FAULT_LCING.md] (RECOMP_FAULT_LCED.md)** - SIGSEGV LOCING:
n:os::LockMetex+0x48 trên trạng thái chưa được khởi động. Mục nhập đi qua hệ thống SDK.
- **[RECOMP_INT_OFFSET.md] (RECOMP_INIT_OFFEET.md)** - sdk+30 lỗi ROOT CAP và cố định: khó mã kDInit=0x30 vapt 2 _BAR_0x24. khởi động bây giờ tiến bộ qua môđun init.
- **[RECOMP_BASES_FIXED.md] (RECOMP_BASES_FIXED.md)** - vụ va chạm cơ bản cố định (64 MB bước); tất cả 34 lần nhập nhập khẩu không được giải quyết (24 là đánh dấu ELF vô hại, 9 là glslc*).
- **[RECOMP_GUES_EXECUTES.md] (RECOMP_GUST_EXCUTES.mET.D)** - **THE MILEEESTONE}: Slapoon 2 nhập nnMain và thực hiện mã động cơ riêng của nó. sau đó đâm phải một cú va chạm cơ sở mô-đun.
- **[RECOMP_RUNS.md] (RECOMP_RUNS.md)** - **it LINKS và RINKS**: 140 MB nhị phân, 271.917 lần tái định vị được áp dụng, 16,903 biểu tượng được liên kết, dừng lại tại một điểm còn thiếu.
- **[RECOMP_LINK_RESULT.md] (RECOMP_LINK_RESULT.md)** - **31 ký hiệu từ một chương trình nhị phân**: 516/516 chức năng biên dịch, và chỉ có 26 nền tảng + 5 keo. 0 HLE, 0 NVN.
- **[RECOMP_FIRST_EXEUation.md] (RECOMP_FIRST_EXCUction.md)** - ** first EXECUation**: mã khách hàng 2 được mã hoá chạy trên máy (nzcv/P/x19)
- **[RECOMP_MULE_LIMT.md] (RECOMP_MIMMULE_LIMT.md)** - trình tương thích chính xác đầu tiên: g_ a nhanh [4] v's Slaptoon 2's 6 modules. Xác nhận, hẹp, một dòng cần sửa.
- **[RECOMP_RESOVER.md] (RECOMP_RESOLVER.md)** - câu hỏi quyết định trả lời: bảng mạch lạc là lý giải cho mỗi trò chơi, và Slaptoon 2 là hoàn tất (114,928/11.928).
- **[RECOMP_EXTENLS.md] (RECOMP_EXTENLS.md)** - Mã được tạo ra cần ~40 nx: người trợ giúp và mercpy. không có gì khác. (Không có gì khác.
- **[RECOMP_PERP.md]*(RECOMP_EXP_PP.mid)** - ** Kết quả quyết định**: recomiler MIT phục hồi Spiloon 2's 114,928 chức năng với hướng dẫn không điều khiển trong 2m14s.
- **[RECOMP_SSP.md] (RECOMP_SSP_SSP.md.d)** - một bộ điều chỉnh tĩnh tính MIT và NVN- over-Vulkan thời gian chạy cho một trò chơi thay đổi. Sự so sánh chiến lược này đã bị mất.
- **[MIMGI_NEDED.md] (IMGUI_SSE.D.]** - một thiết bị dự trữ NVN bên ngoài đã được đánh giá: 02.0, tàu giao thông NVN như là một thiết bị sinh sản, và móc một thiết bị đã được tạo ra.
- **[NVN_DVN_DEICE_CEDADECE.md] (NVN_DEICE_DREEN.md)** - đường dẫn thiết bị hoàn toàn được định vị: nvn khởi động NVN bởi NAME OF TRANSLATORS
- **[PATH_A_DVICE_API.md] (PATH_A_DVICE_API.md)** - nn: kiểu thiết bị công cộng: gfx là một họ mẫu không có biểu tượng ngoài đường, và bộ giải mã thứ ba thất bại.
- **[DVICE_INT_SALLER_SARCH.md] (DEVICE_T_CALLER_S cận.md)** - tìm kiếm bộ gọi của thiết bị thông tin liên tục, mà FAILEDED, và tại sao scan đánh dấu không đọc thêm nữa.
- **[Devil_IMPL_INTER.md] (DVVICE_IMPL_TER.md)** - nơi mà thiết bị NVN thực sự được tạo ra, và một sửa chữa tới NVN_BOOT_SUT_SUT bị giới hạn thấp hơn.
- **[NNGFX_LAYER.md] (NNGFX_LAYER.md)** - những gì nn:: gfx là, hai điểm nhập đã được kiểm tra, và một phép đo mà FAILED (được phát âm lại).
- **[NVN_BOOT_SBET.md] (NVN_BOOT_SPET.md)** - đường dẫn khởi động đạt tới 30 của 453 chức năng của NVN (6.6%); mỗi chức năng vẽ không bị động.
- **[GPRICS_SCOPE.md] (GPHICS_SCOPE.md)** - hệ thống thống điện đồ họa: một giới hạn hiển thị 6 chức năng, và một phần lớn không tham khảo phía sau nó.
- **[HEEP_INTERFACE.md] (HEAP_INTERFACE.md)** - hệ thống biển: Heap vtable (27 chức năng ảo), đó là giao diện một đống chủ phải cung cấp.
- **[HEP_LAYER_SCOPE.md] (HEAP_LAYER_SCOPE.md)** - cho dù lớp chất đống là một bức tường, và giao diện trên tất cả mọi vật xung quanh nó.
- **[GAMEFERK_SCOPE.md] (GAMEMEFORK_SCOPE.md)** - cho dù bước kế tiếp là một bức tường hay một cái cây, với bản đồ dưới cây.
- **[ENGINE_RECONSTRETation.md] (ENGINE_RECONSTRETation.md)** - mục tiêu máy móc: nguồn khởi động trực tiếp phụ thuộc, với địa chỉ, và phương pháp thất bại.
- **[Tiếng Việt] - những quan hệ phụ thuộc theo thứ tự hiển thị đầu tiên.

### 6, cảng.

- **[MYPE_SIZES.md] (TYPE_SIZES.md)** những gì thực sự được đo lường về các loại sDK, và những gì không.
- **[port/] (port/)** - lớp nền tảng thật sự:
n::os tựa và
  Thực hiện, và kiểm tra hợp đồng. xây dựng và kiểm tra với ools/wsl/wsl- building-port.sh.

---

## Đã biết khuyết điểm trong đồ tạo tác của kho này

Ghi âm bởi vì hành động trên chúng mà không biết sẽ lãng phí thời gian:

1. **`PORT_WORKLIST.md` addresses are GOT slots, not code.** Ghidra promoted them to
   "functions", so they look like code addresses but return `NO THUNK` on lookup. Caller
   Phát hiện bằng địa chỉ thất bại cho các mục này.
2. **`nso2elf.mjs` reads the wrong MOD0 fields.** It uses `MOD0+0x18`/`+0x1c` as the
   string/symbol table pointers; for `sdk` those are a zeroed struct pointer and garbage.
   It produces a *self-consistent but wrong* `.symtab`. Root cause in
   Dịch bởi Vũ Hạnh, Mai Linh, Nga, Huy Tô, Yuki, Ann, Phương
3. **`nso2elf.mjs` emits no `.dynsym`/`.rela` sections**, so the converted ELF loses the
   Biểu tượng thông tin mà NSO ban đầu mang theo.
4. **Platform thounk chữ ký đang bị hiểu lầm.** Ghdra thực hiện nhiều nhập khẩu 13- byte như
   `f(void)`; use [PLATFORM_CALL_SITES.md](PLATFORM_CALL_SITES.md) for real arity.

## Công cụ

- `tools/static/` â Node analysis scripts (layout, xrefs, call graphs, references).
- `tools/ghidra/` â Ghidra scripts. **Java only**: Ghidra 12 headless has no Jython and
  PyGhidra không thể cài đặt ở đây (máy Python 3.14 vs gói cp310/cp3 wheels).
- `tools/wsl/` â the Linux-side setup and analysis scripts.
- `tools/nso/` â NSOâELF conversion and validation.

## Cái gì không có trong kho này?

- **Không mã trò chơi.** Nó giữ phân tích, dán và tài liệu, không phải nguồn của Nintendo
  or binaries. The `.gitignore` blocks images, keys, NSO/ELF files and inventories.
- **Không thực hiện lớp nền tảng *** (Tiếng cười) Đó là công việc của cảng, và điều này repo
  tài liệu hợp đồng thay vì làm nó.
