# Bộ mã 2 được ghép bên ngoài của bộ mã — đo

`RECOMP_EXPERIMENT.md` established that the CPU side translates with **zero unhandled
Câu trả lời là "Nó có thể được tạo ra không?" Nó không trả lời "bao nhiêu lần chạy?"
Cần thiết "Những biện pháp này, bằng cách biên dịch kết xuất để đối tượng tập tin và đọc các symbol không xác định
Set.

**Result: the generated code needs about 40 `nx::` helper symbols and `memcpy`. Nothing else.**

---

## 1, phương pháp

Compile three generated translation units to **objects** (not just `-fsyntax-only`, which was the
earlier check), then read their undefined symbols with `nm -uC`. This is the honest metric for
Khoảng cách để chạy.

```
code_000.cpp   OK  (256K)
code_100.cpp   OK  (248K)
code_400.cpp   OK  (264K)
compiled 3/3
distinct undefined symbols: 388
```

**388 undefined — but almost all of them are `main_XXXXXX`, i.e. calls to other generated game
chức năng trong các đơn vị dịch khác.** Những giải quyết này khi tất cả 433 đơn vị được kết nối với nhau.
genuine externals in that set were **2 `nx::` symbols and `truncf`**.

Để đo bề mặt *whole* mà không tính toán tất cả 433 đơn vị (mà sẽ mất khoảng một giờ),
the `nx::` references were extracted from the generated sources directly.

## 2. bề mặt hoàn toàn bên ngoài

**40 distinct `nx::` symbols**, with occurrence counts:

|Ký hiệu|Dùng|Nhiệm vụ|
|---|---:|---|
| `nx::ld` | 1,457,311 |Bộ nhớ đã gõ (tlate)|
| `nx::st` | 996,761 |Các kho bộ nhớ đã gõ (tlate)|
| `nx::V128` | 378,920 |Kiểu véc- tơ 128- bit (kiểu *, không phải hàm)|
| `nx::vzero` | 334,948 |0 một bộ nhớ véc- tơ|
| `nx::subs32` / `subs64` | 136,279 / 58,684 |Màu tiêu đề:|
| `nx::CPU` | 114,928 |bối cảnh CPU, một trong mỗi chức năng|
| **`nx::call`** | **77,764** |**Người điều khiển bàn phím **|
| `nx::fcmp` | 27,083 |nổi so sánh|
| `nx::ld_acq` | 19,394 |Lấy gánh nặng|
| `nx::logic32` / `logic64` | 4,516 / 171 |Công cụ vẽ cờName|
| `nx::adds32` / `adds64` | 3,303 / 419 |Chọn|
| `nx::fcvt_sat` | 2,236 |nổi chuyển đổi với bão hoà|
| `nx::stxr` / `nx::ldxr` / `nx::clrex` |2. 030 mỗi người|Truy cập độc quyền|
| `nx::set_nzcv` | 1,981 |Cờ|
| `nx::asr64` / `asr32` | 1,266 / 882 |Chuyển số học với cờ|
| `nx::umulh` / `nx::smulh` | 816 / 114 |Xanh nước biển cao|
| `nx::sdiv32/64`, `nx::udiv32/64` |- 1000|phân chia|
| `nx::fmax_`, `nx::fmin_`, `nx::fmaxnm`, `nx::fminnm` |Tổng cộng 1.600|Nổi phút/ phút|
| `nx::frsqrts`, `nx::frecps` | 290 |Bước phản hồi nổi|
| `nx::barrier`, `nx::ror32`, `nx::rev16_32`, `nx::bswap` | ~150 |misc|
| `nx::unimpl` | **15** |các trang Mạng chia sẻ/dữ liệu từ báo cáo trước|

**Plus exactly one libc symbol: `memcpy` (1,669 uses).**

## 3. `nx::call` IS the indirect-branch dispatcher — an earlier worry resolved

`RECOMP_EXPERIMENT.md` recorded "6,355 unresolved indirect tail calls" and said a dispatcher would
cần thiết. **Nó đã tồn tại.** Bộ tổng hợp phát ra:

```c
{ uint64_t t = c.x[8]; c.x[30] = NXB + 0x148ull; nx::call(c, t); } // blr x8
```

for `blr` (with the link register set to the return address), and for `br` through a known jump
table it emits a **`switch` over the resolved targets** with `nx::call` as the fallback:

```c
switch (c.x[9]) {
    case NXB + 0xba4ull: goto L_BA4;
    case NXB + 0xbc0ull: goto L_BC0;
    ...
    default: nx::call(c, c.x[9]); return;
} // br x9
```

Vì vậy, các chi nhánh 6.355 "không được giải quyết" không phải là một khoảng cách** - họ được định tuyến thông qua một trợ giúp chạy thời gian,
and the statically-resolvable ones are compiled to direct `goto`s. This is better than the earlier
tài liệu ngụ ý, và việc sửa chữa được ghi ở đây thay vì đứng bên trái.

## 4 Tại sao đây là một kết quả tốt

Mã tạo ra là ** biện pháp tính toán tinh khiết nhất cộng với ~40 trợ giúp**. Không có lớn mỗi trò chơi ABI
to satisfy, no header soup, no C++ standard library dependency beyond `memcpy`. Among the 40,
`nx::ld`/`nx::st` are templates and `nx::V128` is a type, so the **actual runtime functions are
gần hơn đến 35**.

Đối với tương phản, cùng một đo lường trên một đầu ra phân hủy thông thường sẽ hiển thị
hundreds of externals. The recompiler's `nx::CPU`-based calling convention keeps everything
internal by design: registers live in the passed `CPU&`, so a call is just recursion.

## 5 Những gì điều này làm và không xác minh

**Established:** Mỗi biểu tượng bên ngoài mà mật mã Slatoon 2 tạo ra cần thiết, liệt kê và tính.
Các bộ là nhỏ và mỗi thành viên là một tài liệu ghi chép số học/bộ nhớ.

**Không có thiết lập:**
- **It does not link.** One symbol, `nx::call`, needs a resolver keyed on **140,899 addresses**
  Thông qua tất cả các mô-đun, liệu thời gian chạy của Wonder cung cấp hình dạng đó cho một trò chơi nước ngoài là không xác định.
- **Wonder's `nx::` helpers were not read.** The counts above come from the generated code, not from
  Các đầu trang thời gian; hai không được kiểm tra chéo biểu tượng bằng biểu tượng.
- **`nx::CPU`'s layout was not compared** against what the generated code assumes — a mismatch would
  Ngừng gọi điện thoại trong im lặng.
- **All 433 đơn vị chính chưa bao giờ được soạn thảo**, vậy số liệu "388 không xác định cho mỗi 3 đơn vị" là
  1 mẫu, không phải 1 đường dẫn đầy cây.
- **Không có gì được thực hiện.** Đây là một sự đo lường tĩnh.
- The other modules (`sdk`, `subsdk0..3`) were not measured this way — only `main`.

## 6. Sinh sản

`tools/wsl/wsl-link-measure.sh` compiles the sample units and dumps the undefined set;
`tools/wsl/wsl-extern-surface.sh` extracts the full `nx::` surface from the sources.
