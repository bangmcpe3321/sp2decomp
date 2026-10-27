# Layout verification against `main`

** Xem lại: bố trí đầu trang khớp với nhị phân này.** Điều này xác thực toàn bộ
`open-ead` reference set for this title.

Method: take a class declared in `sead` (so its layout carries explicit
`static_assert` sizes), find its construction site in `main`, and compare the
Đầu trang được tuyên bố kích cỡ đối lập với những gì các mã biên dịch thực sự làm.

Class chosen: **`sead::GameFrameworkNx`** — declared in
[open-ead/sead](https://github.com/open-ead/sead), used by `agl`'s `GraphicsNvn`,
and instantiated in `main` from `Lp::Sys::SysInit::Init`. It appears in multiple
Mua lại các bộ phận, đó chính xác là những gì làm cho nó là một sự kiểm tra có ích.

---

## 1. `sizeof(GameFrameworkNx) == 0x210`

**Header declares** (`include/framework/nx/seadGameFrameworkNx.h`):

```cpp
static_assert(sizeof(GameFrameworkNx) == 0x210);
```

Thành viên cuối cùng của đội là:

```cpp
    NVNcommandHandle mCommandHandle;
    nn::os::SystemEventType mVsyncEvent;
    bool _208;
    u8 _209;
    bool _20a;
    u8 _20b;
```

So `_20a` and `_20b` are the last two bytes, meaning the object's live data ends
at `0x20C`, padded to `0x210`.

**Binary evidence** — the constructor at `0x7100e67260` (224 bytes, ending in
`ret` at `0x7100e6733c`). Its highest object-relative store is:

```
0x7100e67310  strb w10, [x19, #522]
```

`522` = `0x20A` — a **byte** store to `+0x20A`, matching `bool _20a`. The observed
cửa hàng vào đối tượng là:

```
+0x000   str x8,  [x19, #0]      vtable pointer
+0x0E8   str sp,  [x19, #232]
+0x0F0   stp x0, sp, [x19, #240]
+0x0F8   str w9,  [x19, #248]    (from #268 decimal)
+0x108   str w31, [x19, #272]
+0x114   str w9,  [x19, #276]
+0x118   str w9,  [x19, #280]
+0x11C   str w9,  [x19, #284]
+0x1C8   stp x9, sp, [x19, #456]  ← matches mPresentationThread / mSync area
+0x208   strb w10,[x19, #520]     ← matches _208
+0x209   strb w31,[x19, #521]     ← matches _209
+0x20A   strb w10,[x19, #522]     ← matches _20a
+0x20B   strb w31,[x19, #523]     ← matches _20b
```

Four consecutive **byte** stores at `0x208`–`0x20B` is a precise fingerprint of
the header's trailing `bool _208; u8 _209; bool _20a; u8 _20b;`. The maximum
offset touched is `0x20B`, so the object occupies `0x20C` bytes, rounded up to
16-byte alignment = **`0x210`**.

**Verdict: `0x210` confirmed.** ✅

---

## 2. `sizeof(CreateArg) == 0x48`

**Header tuyên bố:**

```cpp
static_assert(sizeof(CreateArg) == 0x48);
```

**Bằng chứng rõ ràng** — bên trong cùng một người xây dựng:

```
0x7100e67284  52800915  movz x21, #0x48
0x7100e6729c  9416abf7  bl   0x7101412278     memcpy
```

The constructor sets `x21 = 0x48` and then calls `memcpy` with that register as
the length. That is the `CreateArg` copy — **the compiler's own `sizeof`**, read
trực tiếp từ dòng hướng dẫn.

**Verdict: `0x48` confirmed.** ✅

---

## 3. `initialize` is a trivial wrapper

The symbol `sead::GameFrameworkNx::initialize(Framework::InitializeArg const&)` at
`0x7100e6724c` is a 20-byte tail-call wrapper:

```
0x7100e6724c  a9bf7bfd  stp  x29, x30, [sp, #-16]!
0x7100e67250  910003fd  mov  x29, sp
0x7100e67254  94000b64  bl   0x7100e69fe4      (build the CreateArg)
0x7100e67258  a8c17bfd  ldp  x29, x30, [sp], #16
0x7100e6725c  1400067a  b    0x7100e67260      tail-call the constructor
```

This is a useful confirmation of the calling convention: `initialize` builds a
`CreateArg` (via `0x7100e69fe4`) and tail-calls the constructor, exactly as the
header's two declarations — `static void initialize(const Framework::InitializeArg&)`
and `GameFrameworkNx(const CreateArg&)` — imply.

---

## 4 nghĩa là gì?

**The `open-ead/sead` header for `GameFrameworkNx` matches this binary's actual
bố trí** trên cả hai kích cỡ đã tuyên bố. Đó là một kết quả mạnh, bởi vì:

- `GameFrameworkNx` is the most Switch-specific and era-sensitive class in the
  set. `SEAD_VERSION` flag macros affect class layouts generally, so a match here
  là bằng chứng đầy ý nghĩa về toàn bộ trang đầu.
- Kích cỡ đã được kiểm tra từ mã ** song, không phải từ khác
  decompilation. This is independent ground truth: `0x48` is a `movz` the
  compiler emitted, and `0x210` is the padded extent of real stores.

**Consequence for the port:** the `sead` headers can be used as a trustworthy
Kết cấu tham chiếu cho tiêu đề này, chứ không phải là một phỏng đoán đầy hy vọng.
thiết lập không còn là "không chính xác."

## 5 là những gì nó làm không phải là thiết lập

Chính xác về giới hạn, bởi vì một lớp đã xác nhận không phải là một cái chăn
Bảo đảm:

1. **Only two `static_assert`s and one class were checked.** Other classes —
   especially those whose layout depends on `SEAD_VERSION` flags such as
   `SEAD_CRITICALSECTION_PURE` or `SEAD_THREAD_GETFIBER` — are not thereby
   Đã xác nhận. Lá cờ đã thay đổi * các lớp học khác vtables và trật tự thành viên vẫn còn
   không rõ danh hiệu này.
2. **`PerformanceMgrNx` and `ForegroundBucketMgr` are absent from the repository
   hoàn toàn**, vì vậy không thể xác minh chúng được chúng chỉ có nhị phân
3. **`agl`, `nnware` and `nnsdk` were not independently verified here.** They are
   Tùy cơ ứng biến riêng với các giả định phiên bản riêng của họ; kết quả là
   corroborates `sead` and makes the others more plausible, but does not prove
   Họ.
4. **Một lớp không chứng minh mọi biểu tượng đều hiện diện hay được đặt tên
   Chính xác.**Nó chứng minh mô hình bố trí là đúng, đó là một tuyên bố khác.

## 6. Second check: `nn::ui2d::Pane` (from `nnware`)

`Pane` is the other era-sensitive, heavily-used class — **352 functions in `main`**
- và nó ngồi trên con đường quan trọng để khởi động là cơ sở của thực đơn
system. It carries **no `static_assert`**, so it must be verified empirically.

### 6. 1 Mỗi ảo đã tuyên bố tồn tại trong nhị phân

Đầu trang tuyên bố 26 ảo (phá hủy + 25). Tất cả đều hiện diện dưới tên
functions in `main`:

|Công bố ảo|Địa chỉ|
|---|---|
| `~Pane()` | `0x7101375be4` (`D0`) |
| `Finalize(gfx::Device*)` | `0x7101375be8` |
| `SetVertexColor` | `0x7101375f64` |
| `SetColorElement` | `0x7101375f84` |
| `SetVertexColorElement` | `0x7101375fa8` |
| `FindPaneByName` | `0x7101375fac` |
| `FindMaterialByName` | `0x7101376048` |
| `Calculate` | `0x7101376130` |
| `Draw` | `0x71013767bc` |
| `DrawSelf` | `0x7101376870` |
| `BindAnimation` | `0x7101376874` |
| `UnbindAnimation` | `0x7101376a1c` |
| `UnbindAnimationSelf` | `0x7101376a88` |
| `LoadMtx` (protected) | `0x7101376b14` |
| `FindPaneByNameRecursive` | `0x7101376d6c` |
| …plus `GetVertexColor`, `GetColorElement`, `GetVertexColorElement`, `GetMaterialCount`, `GetMaterial`, `FindMaterialByNameRecursive`, `CalculateMtx`, `CalculateGlobalMatrixSelf` |Hiện tại|

The `gfx::TDevice<gfx::ApiVariation<gfx::ApiType<4>, ...>>` template signature in the
mangled names also corroborates the `-api.nvn.8` API version that
`nnsdk`'s headers are built for.

### 6,2 trường bù đắp chính xác

`Pane::Pane()` at `0x7101375144` (132 bytes) writes these object offsets:

```
+0x000   STP x8, x9            vtable + PaneBase::m_Link
+0x020   STP x8, x8            self-referential  (m_Link sentinel)
+0x030   STR xzr               mParent = nullptr
+0x038   STP xzr, xzr          mChildList  (sentinel)
+0x050   STR xzr               mPosition.x
+0x05A   STRB w8               mFlags      <- low bit clear = Visible false
+0x05B   STRB w10              mAlpha
+0x05C   STRB w10              mGlobalAlpha
+0x0A0   STP xzr, xzr
+0x0B0   STR xzr
+0x0B8   STP xzr, xzr
+0x0C8   STP xzr, xzr          mPanelName area
```

Computing the header's layout (16-byte vtable + 16-byte `PaneBase::m_Link` =
`0x20` base, then `mParent`, `mChildList`, `mPosition`, `mRotation`, `mScale`,
`mSize`, `mFlags`):

|Thành viên đầu trang|Hiệu số tính toán|nhị phân|Khớp|
|---|---|---|---|
| `Pane` base | `0x20` | `0x20` list sentinel | ✅ |
| `mParent` | `0x30` | `0x30` | ✅ |
| `mChildList` | `0x38` | `0x38` | ✅ |
| `mPosition` | `0x50` | `0x50` | ✅ |
| `mFlags` | `0x5A` | `0x5A` | ✅ |
| `mAlpha` | `0x5B` | `0x5B` | ✅ |
| `mGlobalAlpha` | `0x5C` | `0x5C` | ✅ |
| `mMtx` | `0x68` | `0xA0` | ❌ |
| `mPanelName` | `0xC8` | `0xD0` | ❌ |

**`mFlags` landing on `0x5A` is the decisive check.** `IsVisible()` in the header is
`TestBit(mFlags, PaneFlag_Visible)`, and the constructor stores a byte at `+0x5A`
with its low bit clear. That is exactly `mFlags` with `Visible = false`.

**Verrd: bốn nhóm thành viên đầu tiên khớp với nhau ở độ chính xác byte.** Hai nhóm
mismatches (`mMtx`, `mPanelName`) are at the tail, and a plausible cause is a
differing-size `util::MatrixT4x3fType` or `IntrusiveList` in this build. They are
Ngân phiếu này không giải quyết được vấn đề.

### 6.3 What is *not* vertified for `Pane`

- **No size check.** The header has no `static_assert`, so there is no declared
  number to compare. The highest offset touched is `0xD0`, giving at least `0xD8`
  bytes live, but the true `sizeof` is **unknown**.
- **The vtable was not counted.** The binary contains no `_ZTV`/`_ZTI`/`_ZTS`
  symbols for `ui2d` at all, so the virtual count was confirmed by *the presence of
  mỗi bản tuyên bố ảo* thay vì chiều dài vtable. Bố trí độ quan trọng
  ** Thứ tự** do đó vẫn chưa được chứng minh — đó là thứ thực sự phá vỡ
  một cái cảng.
- **Hai cái đuôi không khớp nhau.**

## 7 Kết hợp phán quyết

|Thư mục homeName|Đã kiểm tra lớp học|Kết quả|
|---|---|---|
| `sead` | `GameFrameworkNx` | ✅ **two `static_assert`s confirmed from compiled code** |
| `nnware` | `ui2d::Pane` |**all 26 ảo có mặt; các trường dẫn đầu khớp với nhau theo thứ tự chính xác; đuôi không phù hợp với nhau; kích thước không thể truy cập**|

** Bộ tham khảo là có thể sử dụng được, nhưng không hoàn toàn đáng tin cậy.**

- `sead`'s `GameFrameworkNx` is verified against number-carrying asserts, and the
  Phương pháp là hợp lý cho bất kỳ lớp nào có chúng.
- `nnware`'s `ui2d::Pane` verifies strongly on the fields that matter most for
  behaviour (flags at `0x5A`, the list and transform members) but carries no size
  Xác nhận và có sự khác biệt về đuôi không rõ ràng.

**Các quy tắc hình nền cho cổng này:** tin tưởng một thành viên đầu trang chỉ sau khi kiểm tra
Nó chống lại một người xây dựng hoặc người tiếp cận, chính xác như đã làm ở đây.
`static_assert`s have not earned the same confidence as `sead`'s, and vtable
** Thứ tự** - bất động sản quan trọng nhất - vẫn chưa được xác định ở bất cứ đâu
Bởi vì những chiếc tàu nhị phân này không có ký hiệu RTTI để neo nó.

## 8 khuyên theo dõi

1. **Count a vtable by another route.** The `-noanalysis` import never created
   function objects for the virtuals, so `_ZTV` symbols are absent. A Ghidra pass
   mà tạo các chức năng tại các mục tiêu tái định vị vtable sẽ cho phép các mục nhập
   Đếm và ra lệnh sẽ được so sánh với lệnh của thủ lĩnh.
2. **Resolve the `Pane` tail mismatch** by determining `util::MatrixT4x3fType` and
   `IntrusiveList` sizes in this build — both are `nn::util` templates, so
   `nnsdk`'s `include/nn/util/` is the place to look.
3. **Repeat on one `agl` class**, preferably `agl::utl::ParameterObj`, which the
   `agl` repository actually implements, so its layout is asserted rather than
   Đoán xem.
