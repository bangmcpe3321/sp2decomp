# sp2decomp

[English](README.md) · **Tiếng Việt**

Ghi chú nghiên cứu dịch ngược (reverse engineering) và công cụ cho tệp thực thi
`main` trên Nintendo Switch của **Splatoon 2** (bản USA), cụ thể là bản retail có
ExeFS nằm trong file dump `Splatoon 2 USA.xci`.

Kho này ghi lại những gì đã xác lập được về **cấu trúc, kiến trúc và cách phân chia
subsystem** của module, cùng với các script dùng để xác lập những điều đó. Đây là
nhật ký nghiên cứu, **không phải** một bản decompile hoàn chỉnh.

> **Muốn port lên PC?** Xem **[PORTING.md](PORTING.md)** để biết phạm vi, **[BOOT_MILESTONE.md](BOOT_MILESTONE.md)** cho mục tiêu đã thu hẹp, **[BOOT_CALLGRAPH.md](BOOT_CALLGRAPH.md)** cho chuỗi khởi động đã giải mã, **[SEAD_COVERAGE.md](SEAD_COVERAGE.md)** cho mức độ bao phủ của bản decompile sead hiện có, **[GRAPHICS_NVN.md](GRAPHICS_NVN.md)** cho cách NVN dispatch khiến tầng GPU trở nên khả thi, **[NNWARE_COVERAGE.md](NNWARE_COVERAGE.md)** cho mức bao phủ header NintendoWare (`g3d`/`ui2d`/`atk`/`vfx`/`font`), **[AGL_COVERAGE.md](AGL_COVERAGE.md)** cho `agl` graphics/lighting/AAMP, **[ECOSYSTEM.md](ECOSYSTEM.md)** cho khảo sát đầy đủ cả 16 repository của `open-ead`, **[VERIFICATION.md](VERIFICATION.md)** cho việc kiểm chứng layout với binary, và **[PORT_WORKLIST.md](PORT_WORKLIST.md)** cho danh sách công việc triển khai boot cụ thể. Bảng phân rã đầy đủ 109 subsystem nằm trong [subsystem-map.txt](subsystem-map.txt).

---

## Tình trạng

| Hạng mục | Trạng thái |
|---|---|
| Nhận dạng mục tiêu | Xong |
| Xử lý container/định dạng | Xong |
| Bản đồ bộ nhớ | Xong |
| Kiểm kê hàm/symbol | Xong (113.150 hàm) |
| Phân rã subsystem | Xong (55 namespace) |
| Nhận dạng engine & middleware | Xong |
| **Decompile thân hàm** | **Chưa xong** — xem [Hạn chế](#hạn-chế) |

Mọi thứ bên dưới đều đến từ phân tích tĩnh trên binary đã phát hành. **Không có
tuyên bố nào về hành vi** của bất kỳ hàm nào, vì chưa có thân hàm nào được
decompile. Ở đâu kết luận là suy luận chứ không phải quan sát trực tiếp, chỗ đó
được ghi rõ.

---

## Mục tiêu

| Thuộc tính | Giá trị |
|---|---|
| Module | `exefs/main` (23.717.627 byte) |
| Container | **NSO0** (không phải ELF trên đĩa) |
| Kiến trúc | AArch64, 64-bit little-endian |
| Title ID | `01003bc0000a0000` |
| ACID | `Is Retail: 1` |
| Build ID | `F18FF3CFCBAD0884D72ABBEB6C540D6B00000000000000000000000000000000` |
| Stack của main thread | `0x100000` |
| Độ ưu tiên main thread | 44 (ACID cho phép khoảng 28–59) |
| Các file cùng ExeFS | `main.npdm`, `rtld`, `sdk`, `subsdk0`–`subsdk3` |
| Image base (khi nạp) | `0x7100000000` |

### Xác nhận đây là Splatoon 2

Tên tài nguyên lấy được từ `.rodata` là bằng chứng quyết định:

```
WeaponInfo_%s.byml      GearInfo_%s.byml        UdemaeGrade.byml
TankInfo.byml           SkillInfo.byml          BrandInfo.byml
BottomInfo.byml         HairInfo.byml           PaintResTex.byml
PlayerRank.byml         EnemyInfo.byml          DamageRateInfo.byml
MapInfo.byml            NpcInfo.byml            ActorDb.byml
WorldHotaruTalkInfo.byml                        WorldHotaruFreeTalkInfo.byml
```

Map được phát hành với tên **MakoMart** mang codename nội bộ là **Blitz** —
`Map/Blitz.mutre.szs` — và được xác nhận độc lập bởi một namespace symbol
`BlitzViewer` trong binary.

---

## Bố cục container NSO

`main` là container NSO0: các section được nén bằng LZ4 và xếp liền nhau trên đĩa,
nhưng offset **bộ nhớ** của mỗi section lại được căn theo page. Khoảng trống đó là
chi tiết quan trọng nhất khi dựng lại image.

| Section | Vùng bộ nhớ | Kích thước |
|---|---|---|
| `.text` | `0x0000000` – `0x1415068` | 21.045.608 |
| `.rodata` | `0x1416000` – `0x2d624b3` | 26.526.899 |
| `.rwdata` | `0x2d63000` – `0x2fdb1b0` | 2.589.104 |
| `.bss` | `0x2fdc000` – `0x3699e50` | 7.065.504 |

### MOD0

Header module `MOD0` nằm tại **`.text+0x8`**. Theo
[đặc tả MOD của SwitchBrew](https://switchbrew.org/wiki/MOD), nó thay thế cho
`PT_DYNAMIC` và **không chứa entry point**:

| Offset | Trường | Bản build này |
|---|---|---|
| 0x0 | Signature `"MOD0"` | `4d4f4430` |
| 0x4 | `DynamicOffset` | `0x2f9a468` |
| 0x8 | `BssStartOffset` | `0x2fdbff8` |
| 0xC | `BssEndOffset` | `0x3698f98` |
| 0x10 | `ExceptionInfoStartOffset` | `0x2921ec0` |
| 0x14 | `ExceptionInfoEndOffset` | `0x2a00eac` |
| 0x18 | `ModuleOffset` (sinh lúc runtime, ≈ base của `.bss`) | `0x2fdbff8` |

> **Đính chính.** Một bản trước của README này suy ra "entry VA" từ
> `entryTarget + entryOffset` bằng hai offset `0x10`/`0x14`. Hai trường đó là
> metadata xử lý ngoại lệ. MOD0 **không có entry point**; module được vào thông
> qua dynamic section. Xem [BOOT_MILESTONE.md](BOOT_MILESTONE.md) để biết chuỗi
> khởi động thật.

Dynamic section (VA `0x2f9a470`) chứa các con trỏ liên quan đến boot:

```
DT_INIT          = 0x24
DT_FINI          = 0x160
DT_INIT_ARRAY    = 0x2fd7f90      1604 static constructor
DT_INIT_ARRAYSZ  = 0x3220
```

### Lưu ý về một trường trong header NSO

Trường 32-bit tại offset `0x40` của header NSO là **reserved (dành riêng)**. Nó
**không phải** địa chỉ `.bss`, và không được đọc như địa chỉ — trong container này
nó giữ kích thước **đã nén** của section `.data`. Nếu đọc nó như địa chỉ, `.bss`
tạo ra sẽ chồng lấn lên `.rwdata`. `.bss` nằm ngay sau section đã khởi tạo cuối
cùng trong bộ nhớ.

---

## Quan sát về kiến trúc

`.text` chứa 5.264.410 lệnh. Thống kê lệnh:

| Mã hóa | Số lượng | Ý nghĩa |
|---|---|---|
| `STP x29,x30,[sp,#-N]!` | 7.316 | prologue của hàm (cận dưới số hàm) |
| `STP x29,x30,[sp,#N]` | 60.453 | lưu frame |
| `B` (`0x14......`) | 114.236 | nhảy không điều kiện |
| `PACIBSP` / `AUTIBSP` | **0** | không có pointer authentication |
| `BTI c` | **0** | không có branch target identification |

Lệnh đầu tiên tại VA `0x100` là `stp x29,x30,[sp,#-0x10]!` — một prologue chuẩn,
xác nhận `.text` bắt đầu bằng code.

> **Suy luận.** Pointer authentication và BTI là các biện pháp giảm thiểu mà SDK
> đời sau của Nintendo sinh ra. Việc chúng **hoàn toàn vắng mặt** phù hợp với một
> bản build từ toolchain thời kỳ đầu 2017. Đây là suy luận từ **sự vắng mặt của
> lệnh**, không phải từ chuỗi trong build.

---

## Bản đồ bộ nhớ

Theo cách dựng lại từ một lần nạp module để phân tích (18 block):

```
.text          7100000000   21,045,608  r-x
.plt           7101412168       12,032  r-x
.rodata        7101416000           72  r--
.rela.dyn      7101416048    6,121,056  r--   dynamic relocations
.rela.plt      71019ec6a8       18,048  r--
.hash          71019f0d28    1,110,904  r--
.gnu.hash      7101b000a0    1,238,848  r--
.dynsym        7101c2e7e0    3,518,952  r--   148,138 symbols
.dynstr        7101f899c8    8,828,579  r--   8.8 MB of names
.rodata.1      71027f506b    5,690,440  r--
.data          7102d63000    2,323,568  rw-
.dynamic       7102f9a470          400  rw-
.data.1        7102f9a600           80  rw-
.got.plt       7102f9a650        6,040  rw-
.got           7102f9bde8      246,184  rw-
.init_array    7102fd7f90       12,832  rw-
.bss           7102fdc000    7,065,504  rw-
```

**Module này không bị strip.** Bảng symbol động của ELF vẫn còn nguyên: 3,5 MB
`.dynsym` và 8,8 MB `.dynstr`. Đây là đặc điểm giá trị nhất của mục tiêu này —
phân tích bắt đầu từ 113.150 tên hàm thật, thay vì `FUN_xxxxxxxx`.

---

## Phân rã subsystem

113.150 hàm trải trên 55 namespace cấp cao nhất.

| Namespace | Số hàm | Diễn giải |
|---|---:|---|
| `Game` | 28.439 | gameplay chính |
| `nn` | 15.953 | NintendoSDK |
| `Lp` | 10.672 | tầng framework của game |
| `Cmn` | 4.447 | code dùng chung |
| `sead` | 4.022 | thư viện C++ first-party |
| `agl` | 2.852 | đồ họa |
| `aal` | 2.264 | applet/UI của SDK |
| `gsys` | 2.099 | tầng hệ thống của game |
| `Cui` | 1.815 | component UI của SDK |
| `eui` | 803 | UI mở rộng của SDK |
| `Lobby` | 792 | lobby online |
| `enl` | 717 | — |
| `Cnet` | 590 | mạng |
| `Match` | 555 | ghép trận |
| `xlink2` | 548 | middleware âm thanh/hiệu ứng |
| `Shop` | 509 | cửa hàng trong game |
| `pead` | 490 | âm thanh |
| `UICheck` | 413 | kiểm tra UI |
| `MiniGame` | 184 | — |
| `PlayerMake` | 132 | tạo nhân vật |
| `Cstm` | 121 | tùy biến |
| `DbgSetting` | 120 | cài đặt debug |
| `PlayerViewer` | 86 | trình xem debug |

Cộng thêm 33.692 hàm mang tên `_Z` (toán tử, thunk, template) và 327 hàm C thuần.

### Công cụ nội bộ còn sót trong bản retail

Các harness debug và test vẫn tồn tại trong binary phát hành:

```
DbgSetting 120   PlayerViewer 86   UdgwTest 66      NisdTest 33
EnemyObjViewer 28   ScheduleViewer 27   YmgcTest 25   JintTest 21
GearUnsetupTest 20  BlitzViewer 9   GndColTest 7      MrmtTest 3
```

### Engine và middleware

| Thành phần | Bằng chứng |
|---|---|
| **sead** | `sead::CalculateTask` (đồ thị task calculate/draw), `ExpHeap`, `CriticalSection`, `SafeStringBase`, `Matrix34f`, `TreeNode`, `Path::getExt` |
| **agl** | 2.852 hàm, 6.024 lần xuất hiện trong `.rodata` |
| **Radiance** | `Etc/BRDFFitting/ggx_ltc.byml` (GGX LTC BRDF fitting) |
| **NintendoWare / Nw4f** | 35 lần xuất hiện trong `.rodata` |
| `nn::nex` | thư viện mạng của Nintendo |
| `nn::bcat` | DeliveryCache (phân phối nội dung nền) |
| `nn::aoc` | nội dung bổ sung |
| `nn::nfp` | Amiibo (`Cmn::Def::isSupportedAmiibo`) |
| libcurl | 24 hàm / 36 symbol — HTTP |
| **wslay** | 53 hàm — WebSocket |
| zlib | 49 hàm / 63 symbol |
| libc++ (`std::__1`) | 292 hàm |
| `__nnmusl` | libc dẫn xuất từ musl của Nintendo |

Sự kết hợp libcurl + wslay + `Cnet`/`Match`/`Lobby`/`Shop` phù hợp với kiến trúc
live-service.

---

## Pipeline nội dung

Các đường dẫn tài nguyên lấy được từ `.rodata`:

```
Model/%s.Nin_NX_NVN.szs      NX NVN (NVIDIA) model container
Map/%s.szs                   Map/Blitz.mutre.szs
Env/%s.szs                   Etc/LightCtrl/%s.byml
Nin_NX_NVN.release.szs       Etc/BRDFFitting/ggx_ltc.byml
HapTexture.bfres             PanelTexture.bfres        IconTexture.bfres
```

Một chuỗi để lộ toolchain build nội bộ:

```
File = %%AGL_ROOT%%/tools/bat/convertTempTexture.bat, NoWindow = True,
WindowStyle = Hidden, WaitEnd = True, Arg = %%AGL_ROOT%%/tools/temporary/temp_proj_light.bfres
```

`.mutre` là một định dạng biến thể map riêng, khác với `.szs`.

---

## Bộ công cụ

### Yêu cầu

- **Ghidra 12.1.2** (extension bên dưới khớp với phiên bản này)
- **JDK 21+** — `JAVA_HOME` phải trỏ tới thư mục gốc của JDK
- **[SwitchLoader](https://github.com/Adubbz/Ghidra-Switch-Loader)** — loader
  Ghidra cho các định dạng Nintendo Switch. Cung cấp cả việc nạp NSO và việc phục
  hồi `.dynsym` của ELF được dùng ở đây.
- **hactool** — để trích ExeFS từ XCI và giải nén các section NSO
- **Node.js 18+** cho các script trong `tools/`
- **Python 3** thông qua PyGhidra của Ghidra nếu bạn muốn export inventory bằng script

### Biến môi trường

```powershell
$env:GHIDRA_INSTALL_DIR = 'C:\path\to\ghidra_12.1.2_PUBLIC'
$env:JAVA_HOME          = 'C:\Program Files\Java\jdk-21.0.12'
```

Cài SwitchLoader qua *File → Install Extensions…* của Ghidra, rồi khởi động lại
Ghidra. **Không** đặt cùng một extension ở cả thư mục cài Ghidra lẫn thư mục
extension của người dùng — Ghidra sẽ dừng với lỗi
`Multiple modules collided with same name`.

### Trích xuất mục tiêu

```powershell
hactool -t xci --exefsdir=exefs "Splatoon 2 USA.xci"
hactool -t nso exefs/main --uncompressed=main.decompressed
```

Cần có key cho XCI nhưng key **không thuộc kho này** và tuyệt đối không được commit.

---

## Cách tái lập

### 1. Export inventory symbol

Phải khởi động PyGhidra một cách tường minh, nếu không script Python sẽ lỗi
*"Ghidra was not started with PyGhidra"*:

```powershell
& "$env:GHIDRA_INSTALL_DIR\support\pyghidraRun.bat" -H `
    "<project-dir>" Sp2 `
    -import "exefs\main" `
    -noanalysis `
    -scriptPath "<repo>\tools\ghidra" `
    -postScript ExportInventory.py "<repo>\inventory.txt" `
    -deleteProject
```

Kết quả mong đợi:

```
ExportInventory wrote inventory.txt (functions=113150 symbols=148138 strings=146621)
```

Việc chạy chỉ import (`-noanalysis`) là **có chủ ý**: bảng symbol của ELF cho tên
hàm mà không phải trả giá cho việc phân tích. **Kích thước** hàm từ lần chạy này
chỉ là placeholder và không được hiểu là kích thước code thật.

### 2. Phân tích inventory

```bash
node tools/static/analyze-inventory.mjs inventory.txt
node tools/static/namespace-report.mjs   inventory.txt
node tools/static/subsystem-map.mjs      inventory.txt subsystem-map.txt
node tools/static/symbol-census.mjs      main.decompressed
node tools/static/check-prologue.mjs     main.decompressed
```

### 3. Công cụ container

`tools/nso/nso2elf.mjs` dựng lại một ELF64 có thể nạp được từ NSO đã giải nén. Nó
tồn tại cho các engine phân tích không hỗ trợ NSO; Ghidra với SwitchLoader thì
không cần.

```bash
node tools/nso/nso2elf.mjs main.decompressed main.elf
node tools/nso/validate-elf.mjs main.elf      # tự kiểm tra cấu trúc
node tools/nso/mod0-exports.mjs main.decompressed
```

`validate-elf.mjs` kiểm tra header ELF, quy tắc segment
`p_vaddr ≡ p_offset (mod align)`, chồng lấn segment/section, và vị trí `.bss`. Nó
được viết ra sau khi **bốn lỗi bố cục thật** đã được tìm thấy bằng tay.

---

## Hạn chế

Đây là những khoảng trống có thật và chưa giải quyết. Đừng đọc các bảng bên trên
như một bản mô tả đầy đủ về binary.

1. **Không có thân hàm nào được decompile.** Inventory chỉ ở mức symbol. Do đó
   **không có tuyên bố nào về hành vi runtime ở bất kỳ đâu trong kho này.**

2. **Phân tích tự động toàn phần không hoàn tất.** Bộ phân tích headless của Ghidra
   bị treo một cách tái lặp. 22 hàm đệ quy qua các computed jump mà đích nằm ngoài
   image; log sau đó chỉ tiến được khoảng **99 byte mỗi 3 phút**:

   ```
   WARN Decompiling 710090ab30: Unable to read bytes at ram:23504cd0fec
   ```

   Đây là decompiler đi theo một computed jump, **không phải** lỗi của image đã
   dựng lại. Chạy phân tích trong **Ghidra GUI**, nơi có thể điều khiển từng bước,
   là cách được khuyến nghị để vượt qua.

3. **REA không thể điều khiển mục tiêu này trên Windows.** Adapter Ghidra của REA
   6.5.0 chỉ chấp nhận PE x86/x86-64 và raw 6502 được chọn tường minh:

   > "Windows Ghidra P0 accepts native x86 and x86-64 PE applications and DLLs,
   > and explicitly selected raw 6502 images"

   Cả ELF lẫn nỗ lực `--architecture arm64` không header đều bị từ chối với
   `target_format_unsupported`. Hopper chỉ có trên macOS và IDA chưa được đăng ký.
   Bản thân bản cài Ghidra **có** AArch64, nên đây là giới hạn của adapter, không
   phải thiếu module xử lý.

4. **Việc phân tích bảng export MOD0 chưa được giải quyết.** Hai cách hiểu bố cục
   trường khác nhau cho kết quả mâu thuẫn (một offset âm, một vượt quá EOF), nên
   **không có tên hàm nào** trong kho này được lấy từ bảng MOD0. Tên hàm đến từ
   `.dynsym` của ELF thông qua SwitchLoader.

5. **Việc gán namespace chỉ dựa trên tiền tố symbol.** Nhãn namespace mô tả symbol
   được khai báo ở đâu, **không** mô tả code làm gì.

---

## Pháp lý

Kho này **không chứa code game, không chứa dữ liệu game, và không chứa key mật mã**
— chỉ có ghi chú phân tích và công cụ do chính tôi viết. Splatoon 2 và Nintendo
Switch là thương hiệu của Nintendo. Không có tuyên bố liên kết hay được bảo trợ.
Mục đích là nghiên cứu khả năng tương tác và bảo tồn; hãy dùng bản sao game mà bạn
sở hữu hợp pháp.

## Giấy phép

Công cụ và ghi chú gốc trong kho này được phát hành theo MIT License.
Xem [LICENSE](LICENSE).
