# Kiểm tra lại thứ tự

Phân nửa thứ hai của bố trí xác nhận. Xác nhận.
trường **offsets phù hợp**; điều này xác nhận ảo ** thứ tự**, đó là tài sản mà
Thực sự phá vỡ một cổng.

Cả hai đều được kiểm tra bằng cách tái tạo lại các vtable ** từ nhị phân**, không phải từ
Một sự phân hủy khác.

---

## Phương pháp, và tại sao nó cần được phát minh

Vtable order is normally checked by reading `_ZTV`/`_ZTI` symbols. **This binary has
neither** — a check found **zero** `_ZTV`/`_ZTI`/`_ZTS` symbols for `ui2d`. Tracing
the constructor's `ADRP`+`ADD`+`STR` also failed: the class address is computed
(`ADRP x8 → 0x2f9af00`, `ADD → 0x2f9af10`) but stored through a register the simple
Bộ giải mã không theo sau.

Vì vậy, các vtable được tìm thấy **by nội dung** thay vào đó:

1. Lấy một bộ chức năng ảo được biết đến từ bảng tượng trưng làm neo.
2. Invert `.rela.dyn`: map every relocated slot to its target.
3. Bước ra ngoài từ mỗi neo trong khi các khe cắm ở cạnh nhau (8 byte cách nhau), tặng
   ứng cử viên chạy.
4. Điểm cho mỗi ứng cử viên bởi ** những phần nhỏ của mục nhập của nó được tuyên bố bởi mục tiêu
   Bước này là cần thiết - các lớp học lấy từ cơ sở ảo, vì vậy
   74 ứng cử viên chạy có chứa các neo.
   chủ yếu là của lớp học.

Result for `nn::ui2d::Pane`:

```
vtable  0x2f8de10 .. 0x2f8def0
entries 29
pane-fraction 97%   (next best candidate: 89%)
```

The Itanium ABI shape is present and self-consistent: slot `[0]` is the
deleting-destructor thunk (the symbol that disassembles to a bare 4-byte `ret`), then
RTTI và ảo.

---

## Kết quả: lệnh khớp, với một thực sự khác nhau

Reconstructed order (abridged to the `Pane`-declared entries):

|idx|Mục|
|---:|---|
| 3 | `GetRuntimeTypeInfo` |
| 4 | `Finalize` |
| 5–6 | `GetVertexColor` / `SetVertexColor` |
| 7–8 | `GetColorElement` / `SetColorElement` |
| 9–10 | `GetVertexColorElement` / `SetVertexColorElement` |
| 11–12 | `GetMaterialCount` / `GetMaterial` |
| 13–14 | `FindPaneByName` (non-const / const) |
| 15–16 | `FindMaterialByName` (non-const / const) |
| 17–19 | `BindAnimation` / `UnbindAnimation` / `UnbindAnimationSelf` |
| 20 | `CalculateMtx` |
| 21 | `Calculate` |
| 22 | `Draw` |
| 23 | `DrawSelf` |
| 24 | `LoadMtx` |
| 25 | `FindPaneByNameRecursive` |
| 26 | `FindPaneByNameRecursive` (const) |
| 27 | `FindMaterialByNameRecursive` |
| 28 | `FindMaterialByNameRecursive` (const) |

** Đây chính xác là lệnh khai báo của người đứng đầu**, và nó độc lập xác nhận
Trước đó suy luận trong [VERIFIAT.md] (VERIFIT.d.md) ♪6.1 — đó là các âm tiết
Quá tải ngồi ngay sau khi các đối tác không liên quan.

### Sự mâu thuẫn

The `nnware` header declares only:

```cpp
virtual Pane* FindPaneByNameRecursive(const char*);
virtual const Pane* FindPaneByNameRecursive(const char*) const;
virtual Material* FindMaterialByNameRecursive(const char*);
virtual const Material* FindMaterialByNameRecursive(const char*) const;
```

Nhưng hệ nhị phân có thể thay thế cho cả bốn người tìm thấy:

|Tìm kiếm|Đầu trang|nhị phân|
|---|---|---|
| `FindPaneByName` |cả hai|cả hai teppi82|
| `FindMaterialByName` |cả hai|cả hai teppi82|
| `FindPaneByNameRecursive` |cả hai|cả hai teppi82|
| **`FindMaterialByNameRecursive`** |**non-const chỉ**|**Cả hai đều**_BAR_|

**The binary has a const `FindMaterialByNameRecursive` vtable slot that the header
không tuyên bố.**

Đây là đầu trang *, không phải là một trật tự sai — các mục nhập được tuyên bố ở trong
chuỗi phải và số đếm bao gồm một khe cắm phụ, nhưng kết quả là bê tông:

> A port that builds a `Pane` subclass from the `nnware` header would produce a vtable
> **Một khe nhỏ**, và mỗi điểm ảo sau điểm đó sẽ được gọi là sai
> chỉ số.

Đó chính xác là chế độ thất bại mà sự xác thực này đã tồn tại để nắm bắt.

---

## Những gì điều này chứng minh

|Thuộc tính|Trạng thái|
|---|---|
| `nn::ui2d::Pane` virtual **order** |Đang kiểm tra nhị phân...|
|ảo ** Count**|Hệ nhị phân có 29 mục; đầu đề tuyên bố ít hơn|
| `nnware` header usable as-is | ❌ **must add the const `FindMaterialByNameRecursive`** |

## Những gì điều này làm, không phải là thiết lập

Nói rõ ràng, bởi vì một lớp không phải là một kết quả chăn:

1. **Only `nn::ui2d::Pane` was verified.** The method generalises (any class with
   Biểu tượng ảo đã biết có thể được kiểm tra cùng một cách) nhưng không có lớp khác đã được chạy.
2. **`sead` and `agl` vtable order remain unverified.** `sead`'s `GameFrameworkNx`
   was verified on sizes only; its virtual order was not checked. `agl` was not
   Kiểm tra tất cả.
3. ** Bộ tiêu đề không hoàn toàn đáng tin cậy.** Một thiếu sót được tìm thấy trong
   Lớp đầu tiên được kiểm tra bởi phương pháp này, đó là lý do để chạy nó trên các lớp học
   vấn đề này trước khi dựa vào họ — không phải là lý do để cho rằng những điều khác là đúng.
4. **`ui2d::Pane` inherits `detail::PaneBase`**, whose vtable entries were not
   Đã xác nhận riêng, màn hình cơ sở chiếm vị trí thấp.

## Khuyên bước kế

Run the same reconstruction over the classes on the boot path — `nn::atk`
(1,426 functions, the largest single boot dependency), `nn::g3d`, and `sead::Framework`
Danh sách đó, không phải
Đầu đề là vận chuyển, đó là những gì cần phải thực hiện để chống lại.

Tái sản xuất với:

```bash
node tools/static/vt-by-content.mjs main.elf inventory.txt vt-pane.txt "<anchor VAs>"
```
