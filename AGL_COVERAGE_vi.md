# `agl` coverage: [open-ead/agl](https://github.com/open-ead/agl)

Xác định vị trí của thư viện.
là **Các thành phần không tham khảo lớn nhất ở cổng**.

**Nó không phải là không tham chiếu.** Một sự phân hủy tồn tại, và đầu trang của nó
trùng khớp với hệ nhị phân này.

---

## 1.Nó là gì?

|Thuộc tính|Giá trị|
|---|---|
|Mô tả|*" Sự phối hợp của agl, một thư viện C++ cho các trò chơi đầu tiên của đảng Nintendo được dùng cho đồ họa, ánh sáng và tham số (AAMP)"*|
|Tạo| **2020-08-14** |
|Đẩy lần cuối|**2026-10-16** (đang hoạt động)|
|Chi nhánh mặc định| `master` |
|Ngôn ngữ|C++|
|Sao / nĩa| **46 / 15** |
|Mục lục| `decompilation`, `nintendo-switch`, `reverse-engineering` |
|**License**|**none**|
|Cỡ|~203 KB|

This is the most mature of the `open-ead` repositories consulted so far: six years
old, actively pushed, and by far the most-starred. `nnware` explicitly defers to it
— *"See [sead](https://github.com/open-ead/sead) for more information about the goal
dự án này"* — cùng một dự án gia đình và hội nghị.

**Note what it is not:** there is no `agl::ForegroundBucketMgr` here, and no
`agl` core renderer implementation. `nnware` and `open-ead/sead` cover the engine
*below* and *beside* `agl`; this covers `agl` itself.

---

## 2. Hậu phương được kiểm tra chống lại nhị phân này

`main` contains **2,852 `agl::` functions**. Class-by-class:

|Hạng|Comment| Functions in `main` |Thực hiện trong tương lai|
|---|---|---|---|
|Tham sốObj| ✅ | 57 |; 6. 5 KB|
|Tham số| ✅ | 28 |%s %s sau khi kết thúc cuộc hẹnPlayer|
|Tham sốCurve| ✅ | 31 | — |
|Tham số| ✅ | 11 |% 1,% 2|
|Tham số| ✅ | 11 |%s %s sau khi kết thúc cuộc hẹnPlay 0.5 KB|
|Thấu kính| ✅ | 22 |% 1. 0 KB|
|ReshaderArchive| ✅ | 6 |**13.6 KB**|
|Chương trình reshader| ✅ | 8 | — |
|ShaderProgramArchive| ✅ | 17 | — |
|Thu nhỏ| ✅ | 9 |% 1. 8 KB|
|AtomPtrArray| ✅ | 7 |; 2. 4 KB|
|GPUMemBlockMgr| ✅ | 27 |% 1. 6 KB|
|GPUMAdr| ✅ | 47 | — |
|GPMemBlock| ✅ | 120 | — |
|Biểu đồ họa| ✅ | 11 |% 1. 03 KB|
|NVNMgr| ✅ | 30 |%s %s sau khi kết thúc cuộc hẹnPlay 0.2|
|ShaderProgram| ✅ | 84 | — |
|Shader| ✅ | 172 | — |
|Văn bản| ✅ | 108 | — |
|Hiển thị thư mục| ✅ | 18 | — |
|Vẽ đoạn văn| ✅ | **223** | — |
|Bộ lọc vẽ| ✅ | 31 | — |
|Vẽ hình chữ nhật| ✅ | 17 | — |
|Bề mặt| ✅ | 6 | — |
|Name| ✅ | 16 | — |
|Bộ nhớ| ✅ | 9 | — |
|Nguồn tin cá nhân| ✅ | 13 | — |
|Trình quản lý Shader| ✅ | 10 | — |
|Comment| ✅ | 21 | — |
|Thiết bị đọcComment| ✅ | 70 | — |
|P. bìObj| ✅ | **151** | — |
|P. bìObjMgr| ✅ | 27 | — |
|Sương mù| ✅ | 7 | — |
|Làm sáng| ✅ | **242** | — |
|Projector| ✅ | 10 | — |
|Bloom| ✅ | 30 | — |
|Độ sâu| ✅ | 65 | — |
|Hình NVN| ✅ | 19 | — |
|NVNSamler| ✅ | 10 | — |
|Ảnh NVN| ✅ | 5 | — |

** Mọi lớp học chính trong kho này tương ứng với mã thật trong
`main`.** That is a strong version-match signal: the repository was almost
Chắc chắn được xây dựng chống lại một tiêu đề chuyển đổi trong thời đại động cơ này.

### Hạng không có tương ứng trong nhị phân này

`ResCommon`, `ResShaderSymbol`, `FxOfxLensFlare`, `ShaderTextClause`,
`ShaderTextLexer`, `ShaderTextPreprocessor`, `NW4FToNN` — all zero. These are
Có thể có sự khác biệt về phiên bản, hoặc mã đã chết.
không chính xác.

### Hiện tại

Twelve `.cpp` files, concentrated in parameter utils and resource handling:

```
src/utility/aglParameter.cpp                  16.6 KB
src/utility/common/aglResShaderArchive.cpp    13.6 KB
src/utility/aglParameterList.cpp               9.9 KB
src/utility/aglParameterObj.cpp                6.5 KB
src/utility/aglResParameter.cpp                3.0 KB
src/utility/aglAtomicPtrArray.cpp              2.4 KB
src/common/aglShaderLocation.cpp               1.8 KB
src/detail/aglGPUMemBlockMgr.cpp               1.6 KB
src/utility/aglParameterIO.cpp                 1.3 KB
src/utility/aglParameterStringMgr.cpp          0.5 KB
src/driver/aglGraphicsDriverMgr.cpp            0.3 KB
src/driver/aglNVNMgr.cpp                       0.2 KB
```

**Parameter utils (AAMP) — 160 functions, plus `ResShaderArchive` — are the
Phần thực hiện được đáng kể.** Những phần khác là khai báo.

---

## 3. Điều này thay đổi gì

`agl` was the whole remaining risk. Reclassified:

| `agl` area |Hàm|Tham khảo|
|---|---:|---|
|Tham số (AMP)| ~160 |♪ Đã bị tổn thương ♪|
|Kho lưu tài nguyên/ Môi trường| ~31 |♪ Gần như thực hiện xong**|
|Quản lý bộ nhớ GPU| 194 |_Những người đứng đầu|
|Trình điều khiển/ Cầu NVN| 64 |_Những người đứng đầu|
|Vật thể Shader + chương trình| 256 |_Những người đứng đầu|
|Chữ / bề mặt| 114 |_Những người đứng đầu|
|Vẽ ngữ cảnh, danh sách hiển thị, vẽ| 295 |_Những người đứng đầu|
|Môi trường: ánh sáng, sương mù, evobj, máy chiếu| 437 |_Những người đứng đầu|
|Hậu quả: hoa, DoF| 95 |_Những người đứng đầu|
|Dev Công cụ, ảnh chụp màn hình, tập tin IP, misc| ~120 |_Những người đứng đầu|
|Phần còn lại chưa phân loại| ~1,086 |Không rõ|

**No `agl` area is now reference-free.** The distinction is between *implemented*
(paameter ucils, che mờ kho) và *header-docuced* (người trình bày và người trình bày
Hiệu ứng, thay vì có sẵn so với sự vắng mặt.

Đó là một vị trí vật chất khác với đánh giá trước, mà
concluded `agl` had *"no reference anywhere."*

---

## Còn lại 4 Những điều chưa biết

- **The core renderer has declarations but no code.** `DrawContext` (223
  functions), `DisplayList` (18), `RenderBuffer` (31), `RenderTarget` (17) — these
  là con đường thực sự vẽ và chỉ là người dẫn đầu.
- **~1,086 of the 2,852 `agl` functions are unclassified** by the simple
  Một giấy thông hành thích hợp với đầu trang của kho.
  Danh sách sẽ thắt chặt chuyện này.
- **`agl::ForegroundBucketMgr` is not in this repository** despite being in
  `main` (1 function) and being referenced by the boot path. It may live in a
  phiên bản chưa được giải mã.
- **No license**, as with every `open-ead` repository consulted.
- **Một trận đấu không được chứng minh.** Mỗi lớp đã được tuyên bố tồn tại trong
  binary is good evidence, but `static_assert`s in the headers should be checked
  chống lại những công trường xây dựng của hệ nhị phân trước khi tin vào bố trí.

## Vị trí phụ thuộc tập hợp 5.

|Lớp|Hàm|Tài liệu tham khảo tốt nhất|
|---|---:|---|
|Thanh hàm NVN|1 điểm mục nhập| ✅ `nnsdk/lib/nvn` (implementation) |
| `nn::gfx` | 289 | ✅ `nnsdk/lib/gfx` (implementation) |
| `nn::os`/`mem`/`fs`/`hid`/`vi` | ~382 | ✅ `nnsdk/include` (headers) |
| `nn::g3d`/`ui2d`/`atk`/`vfx`/`font` | 2,823 | ⚠ `nnware` (headers, stubs) |
| `sead` non-NX | ~4,022 | ✅ `sead` (decompilation) |
| `sead::*Nx` | ~97 |Chỉ lập trình nhị phân|
| **`agl`** | **2,852** | ✅ **`agl` (decompilation; ~190 implemented)** |

**Mọi tầng lớp lớn bây giờ có ít nhất một tham khảo đầu trang.** Thực sự
unreferenced code has shrunk to the Switch-specific `sead` classes
(`GameFrameworkNx`, `GraphicsNvn`, `PerformanceMgrNx`, `ForegroundBucketMgr` — ~97
functions) and whatever `agl` internals the repository has not yet reached.

## 6. Đề nghị bước tiếp theo

Bốn bộ phận tái sử dụng bây giờ tạo thành một bộ tham chiếu chặt chẽ cho thời đại động cơ này:

- [open-ead/sead](https://github.com/open-ead/sead) — engine core
- [open-ead/agl](https://github.com/open-ead/agl) — graphics/lighting/AAMP
- [open-ead/nnware](https://github.com/open-ead/nnware) — `g3d`/`ui2d`/`atk`/`vfx`/`font`
- [open-ead/nnsdk](https://github.com/open-ead/nnsdk) — nnSdk + NVN + `nn::gfx`

**Sự xác nhận giá trị cao nhất bây giờ là thỏa thuận bố trí đối chiếu.**
`nnware`'s headers descend from OdysseyReversed and `agl`'s from this project; if
their struct layouts agree *and* match `main`'s construction sites, that is
Trái ngược độc lập hơn là một nguồn tin đáng tin cậy.
`static_assert` values in these headers give exact numbers to test against the
nhị phân với phương pháp mã địa chỉ đã được dùng trong kho này.

Tất cả đều không có giấy phép, vẫn chưa được giải quyết và phải được giải quyết trước khi có mật mã.
được kết hợp.
