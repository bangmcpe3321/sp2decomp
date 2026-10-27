# NintendoWare coverage: `open-ead/nnware`

Assessment of **[open-ead/nnware](https://github.com/open-ead/nnware)** — *"Decompilation
các mô-đun NintendoWare được kết nối tĩnh trong một số trò chơi Nintendo."

Đây là lớp [GPRICS_NVN.md] (GPRICS_NVN.md) được đánh dấu là không có tham chiếu.
Hóa ra nó đã được che đậy một nửa.

---

## 1.Nó là gì?

|Thuộc tính|Giá trị|
|---|---|
|Mô tả|Tiêu đề tự tạo cho NintendoWare cho các dự án phân hủy|
|Ngôn ngữ|C++|
|Cỡ|% 611 KB|
|Tạo| 2026-09-23 |
|Đẩy lần cuối| 2026-10-14 |
|Sao / nĩa| 3 / 2 |
|**License**|**none**|
|Chi nhánh/ Theo dõi| one branch (`main`), no tags |

Credits: [Shadow](https://github.com/shadowninja108) for
[Skyline](https://github.com/shadowninja108/Skyline), and
[Shibbo](https://github.com/shibbo) for
[OdysseyReversed](https://github.com/shibbo/OdysseyReversed) — *"which most of
Những người dẫn đầu này đến từ."
Đó là một tiêu đề chuyển đổi năm 2017 trong cùng thời đại động cơ với mục tiêu này.
Tín hiệu chứng minh có ý nghĩa.

### hạn chế sử dụng trạng thái

Chữ viết sai viết, nguyên văn:

> Đừng yêu cầu hoặc quảng cáo bất kỳ tài liệu có bản quyền nào cho điều khiển này. Bạn sẽ bị bỏ qua.
> Không hỗ trợ việc phân hủy vật liệu ở đây.

This is stricter than the other dependencies. `open-ead/sead` and `open-ead/nnsdk`
im lặng khi được phép sử dụng; **nware rõ ràng không cho phép sử dụng bên ngoài tương ứng
Sự phân hủy**, chính xác là cổng PC không phải là cái gì. Xử lý kho này là
* Xây dựng tham khảo* — tiêu đề có thể được đọc cho các lớp học bố trí — thay vì như
Các nhà duy trì đã trình bày rõ mục đích của họ và nó nên...
được tôn trọng.

### Mô- đun có mặt

Under `lib/`: **`g3d`** (3D renderer), **`ui2d`** (2D UI), **`atk`** (audio toolkit),
**`vfx`** (effects), **`font`**.

### Giới hạn nghiêm trọng: chỉ đầu

Every module's `src/` contains a stub, not an implementation:

```
lib/g3d/src/g3d/g3d_Stub.cpp      8 bytes
lib/ui2d/src/ui2d/ui2d_Stub.cpp   0 bytes
lib/atk/src/atk/atk_Stub.cpp      0 bytes
lib/vfx/src/vfx/vfx_Stub.cpp      0 bytes
lib/font/src/font/font_Stub.cpp   0 bytes
```

** Không có mã số thực hiện nào ở đây.** Giá trị hoàn toàn nằm trong
headers: class layouts and `static_assert`s.

---

## 2. Hậu phương được kiểm tra chống lại nhị phân này

Namespaces nnware declares, measured in `main`:

|Miền tên|Mô- đun nnware| Functions in `main` |
|---|---|---:|
| `nn::g3d` | `lib/g3d` | **292** |
| `nn::ui2d` | `lib/ui2d` | **479** |
| `nn::atk` | `lib/atk` | **1,426** |
| `nn::vfx` | `lib/vfx` | **396** |
| `nn::font` | `lib/font` | **230** |
| |**total**| **2,823** |

Các lớp học được công bố đầu tiên với mã thật trong nhị phân:

|Hạng|Hàm|Hạng|Hàm|
|---|---:|---|---:|
| `g3d::AnimObj` | 93 | `ui2d::Pane` | 352 |
| `g3d::ResMaterial` | 58 | `ui2d::Layout` | 158 |
| `g3d::ModelObj` | 43 | `ui2d::Material` | 112 |
| `g3d::ResModel` | 40 | `ui2d::TextBox` | 89 |
| `g3d::ResSkeleton` | 16 | | |
| `g3d::ViewVolume` | 13 | | |

**2.823 chức năng — khoảng 85 phần trăm của 3,144 mà GPHICS_NVN.md gọi là
"Không tham khảo" — bây giờ có một cấu trúc đầu trang.

### But `agl` is absent

```
agl::*   2,852 functions in main   —   NOT in nnware
```

`agl` is the layer `agl::ForegroundBucketMgr` and the `Lp::Sys` framework sit
Nó không phải là **Không** NintendoWare, nó không phải trong nnware, và nó là ** the lớn nhất
thành phần không tham chiếu trong toàn cổng**:

|Lớp|Hàm|Tham khảo|
|---|---:|---|
| `nn::g3d` | 292 |ngầm đầu nnware|
| `nn::ui2d` | 479 |ngầm đầu nnware|
| `nn::atk` | 1,426 |ngầm đầu nnware|
| `nn::vfx` | 396 |ngầm đầu nnware|
| `nn::font` | 230 |ngầm đầu nnware|
| **`agl`** | **2,852** |Không có gì cả.|

---

## 3. nơi cảng đang đứng.

Hợp nhất mọi đánh giá phụ thuộc trong kho này:

|Lớp|Hàm|Trạng thái|
|---|---:|---|
|Thanh hàm NVN|1 điểm mục nhập| ✅ `nnsdk/lib/nvn` |
| `nn::gfx` | 289 | ✅ implementation in `nnsdk/lib/gfx` |
| `nn::vi` | 12 |_Những người đứng đầu|
| `nn::os` / `nn::mem` / `nn::fs` / `nn::hid` | ~370 |_Những người đứng đầu|
| `nn::g3d` | 292 |Không có mã|
| `nn::ui2d` | 479 |Không có mã|
| `nn::atk` | 1,426 |Không có mã|
| `nn::vfx` | 396 |Không có mã|
| `nn::font` | 230 |Không có mã|
| `sead` (non-NX) |94 kết thúc| ✅ `open-ead/sead` |
| `sead::*Nx` classes | ~97 |Chỉ lập trình nhị phân|
| **`agl`** | **2,852** |Không có gì cả.|

**The port's graphics problem has narrowed to two things: `agl` (2,852 functions
with no reference at all), and the Switch-specific `sead`/`gfx` glue that has
Đầu nhọn nhưng không thực hiện.

> **Correction.** The claim that `agl` has "no reference at all" was wrong.
> [open-ead/agl](https://github.com/open-ead/agl) is a six-year-old, actively
> maintained decompilation of `agl` whose declared classes match this binary
> Gần gũi hơn. xem ** [AGL_CERES.md] (AGL_CERCE.md).
> between *implemented* (`agl` parameter utils and shader archive) and
> *header-documented* (the `agl` renderer and post-effects) — not present versus
> vắng mặt.

---

## 4. Những lời khuyên thực tế

1. ** Đọc đầu trang của nnware, không sao chép các mã của nó. ** Ngoài việc chỉ đứng yên, nó
   ReadingME từ chối rõ ràng hỗ trợ cho việc sử dụng không thao tác.
2. **Các bố trí máy tạo ngày tháng chống lại hệ nhị phân trước khi tin tưởng chúng.** Giống nhau
   address-decode approach used throughout this repo applies: `nn::g3d` and
   `ui2d` construction sites are visible, and `static_assert`s in the headers give
   Những con số để kiểm tra.
3. **Prioritise determining whether `agl` has any reference anywhere.** It is now
   không có tham chiếu
   tồn tại, 2.852 chức năng vẽ trừu tượng phải được tái tạo lại từ
   Chỉ riêng hệ nhị phân — và điều đó, chứ không phải khối UI, mới là cực dài.
4. **Hãy ghi chép chuỗi chứng minh.** Thủ cấp của nnware chủ yếu là từ
   Nếu cấu trúc của dự án này khớp với một
   Xây dựng tòa nhà 2, đó là bằng chứng vững chắc về một phiên bản NintendoWare được chia sẻ —
   và sẽ cho phép bạn kiểm tra chéo bố trí giữa hai phân giải độc lập
   Thay vì tin tưởng một người.

## Không rõ

- Mà NintendoWare/SDK phiên bản đầu đề này tương ứng với, và cho dù nó
  Khớp với tòa nhà 2017-era Splatoon 2 này.
- Whether any `agl` reference implementation exists publicly.
- Whether `nn::vfx` and `nn::font` headers are complete enough to reconstruct
  Lớp học của họ (cả hai đều nhỏ, mỗi lớp một nắm).
