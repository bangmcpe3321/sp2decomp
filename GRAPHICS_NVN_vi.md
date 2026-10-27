# Graphics layer: NVN dispatch and the `open-ead/nnsdk` headers

Làm thế nào chồng đồ họa được cấu trúc, và tại sao nó dễ uốn nắn hơn
Chức năng thô gợi ý.

---

## 1. What `open-ead/nnsdk` is

**[open-ead/nnsdk](https://github.com/open-ead/nnsdk)** â *"User-created headers for
NintendoSDK cho các dự án phân hủy."

|Thuộc tính|Giá trị|
|---|---|
|Ngôn ngữ|C++|
|Cỡ|~737 KB|
|Tạo| 2026-09-23 |
|Đẩy lần cuối| 2026-10-12 |
|Sao / nĩa| 4 / 3 |
|**License**|**none**|

Nó là quan hệ phụ thuộc nnSdk [SEAD_CERCE.md] được xác định là
missing for `sead`. It is **not headers only** â it contains substantial
Thực hiện.

### Tiêu đề lõi SDK

Under `include/nn/`: `account`, `album`, `am`, `aoc`, `applet`, `audio`, `bcat`,
`crypto`, `diag`, `err`, `friends`, `fs` (`fs_Mount`, `fs_Rom`, `fs_Files`,
`fs_Directories`, `fs_Save`), `hid` (25 KB), `image`, `init`, `irsensor`, `mem`
(`mem_StandardAllocator`), `nfp`, `nifm`, `nlibsdk` (central heap, heap error),
và hơn thế nữa.

Những bao gồm về cơ bản là không gian tên chính xác
[BOOT_CALLGRAPH.md](BOOT_CALLGRAPH.md) lists as boot-critical: `nn::init`,
`nn::mem::StandardAllocator`, `nn::fs::MountRom`, `nn::hid`, `nn::audio`.

### Trình thực hiện đồ hoạ (phần quan trọng)

`lib/gfx/` and `lib/nvn/` contain **real code**, not declarations:

```
lib/gfx/src/gfx/detail/gfx_CommandBuffer-api.nvn.8.cpp     47 KB
lib/gfx/src/gfx/detail/gfx_NvnHelper.cpp                   30 KB
lib/gfx/src/gfx/detail/gfx_Shader-api.nvn.8.cpp            25 KB
lib/gfx/src/gfx/detail/gfx_State-api.nvn.8.cpp             17 KB
lib/gfx/src/gfx/util/gfx_PrimitiveShape.cpp                17 KB
lib/gfx/src/gfx/detail/gfx_Texture-api.nvn.8.cpp           13 KB
lib/gfx/src/gfx/detail/gfx_DescriptorPool-api.nvn.8.cpp     9 KB
lib/gfx/src/gfx/detail/gfx_Buffer-api.nvn.8.cpp             7 KB
lib/gfx/src/gfx/detail/gfx_ResShader-api.nvn.8.cpp          7 KB
lib/nvn/src/nvn/nvn_FuncPtrImpl.h                         110 KB
lib/nvn/src/nvn/nvn_CppFuncPtrImpl.h                      102 KB
lib/nvn/include/nvn/nvn_Cpp.h                             110 KB
lib/nvn/include/nvn/nvn_FuncPtrInline.h                    98 KB
```

Note the `-api.nvn.8` suffixes: these target **NVN API version 8** on Horizon.

---

## 2. Được xác định chống lại nhị phân: NVN là một RORLVER

> **CORRECED.** Phần này trước đây được mô tả là "một bộ tải kiểu Vulkan:
> khởi động điểm mục nhập trở lại một struct của con trỏ chức năng ".
> `nvnLoadCProcs` (`0x7100ddd6e4`, **12,712 bytes**) shows something different: it is a
> **`GetProcAddress`-style resolver** that looks up each function BY NAME and stores it in a
> được gọi là toàn cầu.
>
> ```c
> khoảng trống nvnLoadCProcs (không có) thiết bị, không có * (*getProcAdorress) (không có *, crix*){
>     PTR_ pfnnc_nDevice SupDaults = getProcAdress (dovice, "nvnnDevice Conser setDefaults")
>     PTR_ pfncc_nDevice SupFlags = getProcAdress (dovice, "nvnnnDevice Conser setFlags")
>     ...
> }
> ```
>
> ** Bề mặt đo được là 433 chức năng.** 3 số đếm độc lập đồng ý: 453 khác biệt
> `nvn*` string literals, 453 distinct destination globals, 453 resolver call sites. Grouped:
> Lệnh 130, Texture 90, mẫu 45, thiết bị 25, hàng 24 đa thức 23, bộ nhớ 17
> Buffer 17, cửa sổ 16, trộn 15, Độ sâu 13, Vertex 10, Polygon 9, màu 7, Chương trình 5, đồng bộ 4.
> Kênh 3.
>
> Các hiệu ứng trên cổng là thuận lợi các tên IS giao diện, tất cả họ đều có mặt trong
> Các nhị phân, và chúng có thể được tính thay vì đoán.
> (such as `nnsdk`) is needed to establish the surface.

Checking `main`'s own symbol table for NVN:

```
nvnBootstrapLoader   0x7101413d48   (in .plt region â an import thunk)
nvnBootstrapLoader   0x7103877000   (EXTERNAL â the imported symbol)
nvnLoadCProcs        0x7100ddd6e4
```

**There are no other `nvn*` functions in the binary.** No `nvnDeviceInitialize`,
no `nvnDeviceGetProcAddress`, none of the hundreds of `nvn*` entry points.

Đó không phải là một khoảng trống mà là kiến trúc. **NVN là một bộ tải kiểu Vulkan:**
Điểm nhập khởi động đơn mở rộng trở lại một chu trình của con trỏ chức năng, và
Mỗi cuộc gọi GPU sau đó đi qua bảng đó.
không tồn tại như là mã tên vì nó được dùng độc quyền qua con trỏ.

Số đếm xung quanh, theo tỷ lệ:

|Miền tên|Hàm|
|---|---:|
| `nn::vi` | 12 |
| `nn::gfx` | 289 |
| `nn::g3d` | 292 |
| `agl` | 2,852 |

### Tại sao chuyện này lại quan trọng?

**A port does not reimplement hundreds of `nvn*` functions. It implements
`nvnBootstrapLoader` once and fills in one struct.** That is a categorically
vấn đề nhỏ hơn vấn đề thay đổi GPU API nó là "provide a VTable"
Được hỗ trợ bởi Vulkan."

The `open-ead/nnsdk` files are directly useful here because
`nvn_FuncPtrImpl.h` and `nvn_FuncPtrInline.h` enumerate the table's contents with
Tên và bố trí, tạo cấu trúc chính xác để điền vào.

---

## 3. Chuỗi phụ thuộc đồ hoạ đã sửa đổi

chồng đồ họa, từ dưới lên, với những gì có sẵn:

|Lớp|Hàm|Có thể tham khảo không?|
|---|---:|---|
| `nvnBootstrapLoader` â NVN table |1 điểm mục nhập| **Yes** â `lib/nvn/*` in nnsdk |
| `nn::gfx` | 289 | **Yes** â `lib/gfx/src/**` implements it |
| `nn::g3d` (renderer) | 292 |Tiêu đề chỉ phải được viết|
| `agl` (graphics library) | 2,852 |Nếu không có người thì phải viết.|
| `sead::GraphicsNvn`, `GameFrameworkNx` | 47 + 35 |Tiêu đề chỉ phải được viết|

**So the two layers that are genuinely reference-free are `nn::g3d` and `agl`.**
Tất cả mọi thứ bên dưới họ có hoặc là một thực hiện hoặc một tuyên bố đã xác nhận
Vị trí đó tốt hơn nhiều so với
Nó ngụ ý khi nó nói "có khả năng viết
entire graphics bring-up path yourself" â that remains true for `g3d` and `agl`,
but `nn::gfx` and the NVN table are now covered.

> **Update.** `nn::g3d` is no longer reference-free either: its headers are in
> **[open-ead/nnware](https://github.com/open-ead/nnware)**, together with
> `nn::ui2d`, `nn::atk`, `nn::vfx` and `nn::font` â 2,823 functions of structural
> Tham khảo xem.
>
> **`agl` (2,852 functions) is the remaining reference-free component, and it is
> bây giờ là một ẩn số lớn nhất trong cảng.**

---

## 4. Reference implementation found: `devkitPro/deko3d`

Bảng thông tin NVN được mô tả trong  vội2 không có bề mặt một chức năng trong nhị phân, vì vậy
cái mà cái bàn phải làm, * không có tham chiếu mở. Một cái hiện có.

**`devkitPro/deko3d`** is a from-scratch low-level GPU API for Tegra X1, described in
Nó đã được viết sẵn như thế *"The  homebrew answer to Nintendo and Nvidia's Urime NVN"*,
xây dựng từ * "một năm rưỡi (và vẫn đang tiếp tục) nỗ lực kỹ thuật đảo ngược trung tâm
Xung quanh NVN."* Nó được cấp phép**(người biên dịch bóng râm của nó bắt nguồn từ
mesa/nouvuau, MIT) mà trực tiếp giải quyết vấn đề bản quyền ở  Chớ 5.1 bên dưới
lớp này.

**Tại sao nó chứng thực  vội vã từ một hướng độc lập.** deko3d's ReadME mô tả của nó
Mô hình là *"devices, hàng đợi, lệnh bộ đệmâ, một cửa sổ vào các hoạt động bên trong của các
GPU."* That is precisely the shape of the `nvnLoadCProcs` table: device, queue, memory
bể bơi, bộ đệm, bộ đệm mẫu, bộ đệm lệnh, đồng bộ.
Giải mã nhị phân của kho và của devkitPro 'NVN ngược kỹ thuật:
Kiến trúc, điều đó làm tăng thêm sự tin tưởng vào kết luận của  vội vàng.

Nó cũng cho biết một mục đích để được *"một kho công cộng chính xác là có thể sử dụng của bộ nhớ
Định nghĩa và các thông tin phần cứng khác "*, đó là loại nghệ thuật hóa dự án này
đã thiếu sót.

** Nó có ích gì:**

- A readable spec for **what `nvnLoadCProcs` populates** â the gap that could not be
  lấp đầy từ nhị phân, kể từ khi chức năng đã không có nơi cuộc gọi đặc trưng
  ([PPLATORM_IPEC.md].
- Bộ nhớ và định nghĩa phương pháp GPU.
- Prior art on the NVN API model, from the same ecosystem as `libnx`.

**Nó không hữu dụng cho:**

- **It does not run on PC.** It targets Switch hardware through `nvdrv`; on a PC target
  Bản dịchGL phải được viết. deko3d cung cấp
  *semantics* của phương pháp NVN, không phải là một cảng.
- **Its shader compiler is a build-time PC tool** (`dekotools`/UAM), and the game ships
  Nó không giải mã được những đốm nhỏ được vận chuyển, mặc dù nghiên cứu nó vẫn có thể
  Báo cáo giải mã định dạng đó, vì nó nhắm vào cùng một GPU ISA.
- **It does not touch the engine layer.** `sead`, `agl`, `nn::g3d` and `nn::ui2d` are
  unaffected; `agl` (2,852 functions) remains the largest graphics task.
- **Nó không nằm trên đường dẫn đá lát khởi động.** Thứ tự khởi động đặt đồ họa cuối cùng
  (`initializeGraphicsSystem`), so this is a later-stage asset.

**Chỉ trích câu hỏi mở lớn nhất của cổng.** deko3d làm giảm chi phí của lớp GPU
theo một thỏa thuận ** chiến lược *** chiến lược >GHVN tái tạo trên PC bây giờ đã có một bê tông
Nó không giải quyết quyết được quyết định kinh nguyệt,
Bởi vì lớp động cơ vẫn còn chi phối chi phí đó, và theo một chiến lược mô phỏng một
Trình giả lập cũng cung cấp lớp GPU.

## 5 Động vật

1. **License.** `nnsdk` has **no license file**, as is also the case for
   `open-ead/sead`. Two unlicensed dependencies now sit on the critical path.
   Giải quyết chuyện này trước khi kết hợp bất cứ mật mã nào.
2. **Sự trưởng thành.**4 sao, 3 ngã ba, tạo ra 2026-09-23.
   Dự án xổ số thấp. Quyền tác giả của * (như trái với tiêu đề)
   Cũng đáng giá để xem xét việc làm giảm hiệu quả của một công ty
   proprietary graphics API raises the same provenance questions as `sead`.
3. **SDK phiên bản không được xác định.** mà nnSdk phiên bản đầu
   tương ứng với, và cho dù nó khớp với hệ nhị phân năm 2017 này, thì không ai biết.
   `gfx_*Info` struct layouts and `-api.nvn.8` API version are the things to check
   chống lại cấu trúc của hệ nhị phân.
4. **NVN bảng là lớn.** "Một struct" gạch dưới tiểu dụng công việc (Tiếng cười)
   là rộng, và mỗi mục thực sự đạt bởi trò chơi phải được hỗ trợ bởi thực tế
   tiết kiệm là kiến trúc (một bảng thông tin hơn là hàng trăm
   Tên chức năng, không giảm công việc GPU.
5. **`nn::g3d` now has headers, but `agl` has nothing.** `nn::g3d` (292) and
   `nn::ui2d` (479) gained structural references from `open-ead/nnware`, but that
   Lưu trữ các con tàu slub-chỉ nguồn và xóa bỏ rõ ràng không phân hủy
   use. **`agl` (2,852 functions) still has no reference at all** and is the
   Nhiệm vụ đồ họa lớn nhất còn lại là xem [NWEED_CED.M.S.

## Dòng cuối

The graphics path is more tractable than it first appeared: **`nn::gfx` has an
Thực hiện và NVN là một bảng gửi đơn**, do đó, hai phần ba của
Các chồng GPU có thể được dựng lên từ các tài liệu tham khảo thay vì tái tạo lại bị mù.
`nn::g3d` and the UI toolkits have header-level references from `nnware`.

**The unbounded-looking part is now precisely bounded to one component: `agl`,
tại 2.852 chức năng mà không có tham chiếu chung.**

> **Correction.** That was wrong â `agl` **does** have a public reference.
> [open-ead/agl](https://github.com/open-ead/agl) is a six-year-old, actively
> maintained decompilation covering `agl`'s graphics, lighting and AAMP parameter
> Các lớp, với các lớp đã được công bố khớp chặt chẽ với hệ nhị phân này.
> **[AGL_CERESE.md] (AGL_CROROCE.md)**. Mỗi lớp lớn của cổng bây giờ đã ở
> ít nhất là một sự tham khảo cấp cao.

Hai điều cần giải quyết trước khi viết mã: những giấy phép mất tích** (cả ba
`open-ead` repositories have none, and `nnware` additionally disclaims
không phân giải sử dụng), và **w dù các tiêu đề nnsdk/nware tương ứng với điều này
Bố trí nhị phân** (có thể kiểm tra với cùng một địa chỉ- mật mã được dùng ở nơi khác
trong cuộc điều tra này.
