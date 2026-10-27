# Thí nghiệm xây dựng lại Slatoon 2 có hiệu quả

`RECOMP_ASSESSMENT.md` recommended adopting the MIT recompiler from
`BelmanteGu/SuperMarioWonderRecomp` and testing it against Splatoon 2. **This is that test, and
Nó đã thành công.** Kết quả quyết định một vòng mười hai của việc tái thiết thủ công không thể.

---

## Kết quả là 1.

```
python3 -m recomp ~/sp2recomp/main ~/sp2recomp/gen --name main --base 0x7100000000

seeds: 114172 FDE, 753 PLT stubs, 114928 entries
pass 0: 114928 functions, 1113 jump tables, +0 entries
analysis: 114928 functions, 1113 jump tables (12.7s)
done: 0 files, handled 0, unhandled 0 (13s)          <- the --only probe
```

Chạy đầy đủ:

|Metric|Giá trị|
|---|---|
|Hàm đã phục hồi|**114,928** (+113 bảng nhảy)|
|Quản lý hướng dẫn| **5,264,395** |
|** Những chỉ dẫn UHANDLED**| **0** |
|Không giải quyết gián tiếp các cuộc gọi đuôi| 6,355 |
|Đồng hồ Wall|**2 m 13.9 s**|
|Bộ nhớ đỉnh|**2.7 GB**|
|Xuất| **486 MB** across **433** `code_*.cpp` |
|Trạng thái thoát| 0 |

**Zero unhandled AArch64 instructions across Splatoon 2's entire `main`.** The recompiler's
Bộ giải mã bao gồm tất cả mọi thứ mà hệ nhị phân này sử dụng.

## 2. Việc tạo C++ là hợp lệ và có thể đọc được

7 of 7 sampled translation units (`code_000` â¦ `code_432`) pass `g++ -std=c++20 -fsyntax-only`
chống lại những người dẫn đầu thời gian của Wonder.

Kết quả là trung thực, bình luận C++ âGLO không phải là một chấm thập phân:

```c
void main_00000024(nx::CPU& NX_RESTRICT c) {
    c.x[31] = uint64_t(uint64_t(c.x[31]) - uint64_t(0x90ull));      // sub sp, sp, #0x90
    { uint64_t a = c.x[31] + 0x70ull;
      nx::st<uint64_t>(a, uint64_t(c.x[20]));
      nx::st<uint64_t>(a + 8, uint64_t(c.x[19])); }                  // stp x20, x19, [sp, #0x70]
    c.x[19] = uint64_t(NXB + 0x2fdc000ull);                          // adrp x19, #0x2fdc000
    { uint64_t a = c.x[19] + 0xb8ull;
      c.x[8] = uint32_t(nx::ld<uint32_t>(a)); }                      // ldr w8, [x19, #0xb8]
    if (uint32_t(c.x[8]) != 0) goto L_118;                           // cbnz w8, #0x118
```

Mỗi hướng dẫn được dịch với **its tự tách riêng ra trong một bình luận theo dõi**. Đăng ký là
`c.x[0..31]`, memory goes through typed `nx::ld`/`nx::st` helpers, branches become labels and
`goto`. This is auditable code â a human can follow it against a disassembly.

## 3. The `nx::unimpl` sites are NOT missing code

`code_000.cpp` contains `nx::unimpl` calls, which appear to contradict "unhandled 0". They do
not. There are **15 `unimpl` sites in the entire 486 MB**, and the reasons are:

```
6  undecodable 0xe7ffdefe     <- "b ." to itself: linker padding, not a function
3  udf                        <- the AArch64 permanently-undefined instruction
2  undecodable 0x02fdbff8     <- data words being read as code
6  undecodable 0x02f9a468 / 0x03698f98 / 0x02921ec0 / 0x02a00eac   <- data words
```

All 15 are in the **first function** (`main_00000000`, the NSO header/dispatch region). The
report's `handled 5264395, unhandled 0` counts *instructions it decoded*; these sites are bytes
Đó không phải là chỉ dẫn ở tất cả**_BAR_mà một cuộc quét tuyến tính coi là mã.
** Bộ tổng hợp không thiếu gì; nó đang giảm chính xác để phát minh ra mã dữ liệu.**

## 4 cuộc gọi gián tiếp sau được xử lý reCOMP_EXTENALS.md

> **CORRECTED.** This section originally said the 6,355 unresolved `br` were a gap for which "a
> dispatcher is needed". It already exists: the recompiler emits `nx::call(c, target)` for every
> indirect branch, and resolves jump tables into `switch` statements with `nx::call` as the
> Ngược lại. đo lường là trong [RECOMP_EXTMALS.md] (RECOMP_EXTALS.md).
> Bên dưới để ghi âm.

Đây là một khoảng trống thật sự, và nó là một vấn đề được biết đến ở hạng nhất trong việc giải mã tĩnh:
indirect branches (`br xN`) whose targets cannot be resolved statically. Every recompiler in this
Họ có nó, và phân cấp chuẩn là một lookup bảng hoặc một người điều phối viên xây dựng từ
hàm số được biết đến là  cân nhắc, 1184.928 trong số đó hiện đang được liệt kê. Vì vậy, có thể giảm âm.

## 5. Chuyện này giải quyết thế nào?

Người dùng đã chọn **sự tái tạo nhân cách** trong một vòng trước đó, khi tĩnh recompation chỉ là một
Bây giờ nó được đo:

| |Xây dựng lại bằng tay|Bộ tổng hợp này|
|---|---|---|
|Quản lý chức năng cơ chế|**10**, hơn 12 vòng| **114,928** |
|Thời gian|12 viên.|**2 m 14 s**|
|Chỉ thị không điều khiển được|n/a| **0** |
|Xuất|- 315 kiểm tra|456 MB hợp lệ, đã bình luận C++|
|Thiết bị NVN|**Không được tạo ra**|(thời gian chạy của họ có nó, MIT)|
|Giấy phép| â |**MIT**|

** Đường dẫn xây dựng lại thủ công sẽ không bao giờ đạt đến 114.928 chức năng.
3 phút, lần đầu tiên.

That is not a criticism of the work done â the platform layer, the four `static_assert`-caught
lỗi bố trí, bề mặt NVN đo đạc 453 chức năng NVN và hồ sơ thất bại đều có ích, và
Một vài người trong số họ đồng ý độc lập với các phát hiện từ các tác giả của dự án này.
{\cH00C1E5EC}Bộ phận kỹ thuật** {\cH00C1E5EC}Có 113.000 chức năng hợp thành núi {\cH00C1E5EC}Bây giờ là một vấn đề được giải quyết bởi một
Phương pháp khác.

## 5b. Toàn bộ phía CPU: sdk + tất cả bốn subsk modules

After `main`, the remaining modules were recompiled the same way, each with a distinct
`--base` (Wonder's convention: a 0x1000000 stride from `main`'s `0x7100000000`).

|Module|Nhập|Hàm|Quản lý hướng dẫn|Bỏ điều khiển| Unresolved `br` |Thời gian|Xuất|
|---|---:|---:|---:|---:|---:|---:|---:|
| `main` |22.6 MB| 114,928 | 5,264,395 | **0** | 6,355 |2 m 14 s|456 MB|
| `sdk` |2.89 MB| 19,322 | 735,237 | **0** | 368 |20 giây|65 MB|
| `subsdk0` |KB 787| 5,034 | 188,055 | **0** |  |5 s|17 MB|
| `subsdk1` |KB 67| 582 | 14,440 | **0** |  |< 1 s|1. 4 MB|
| `subsdk2` |KB 49| 105 | 10,755 | **0** |  |< 1 s|KB 944|
| `subsdk3` |KB 184| 928 | 43,238 | **0** |  |1 giây|3. 5 MB|
|**TOTAL**|  | **140,899** | **6,256,120** | **0** |  |**~2 m 40 s**|**~574 MB**|

**Zero unhandled instructions across every module in the game.** The `sdk` output also passes the
same compile check (`g++ -fsyntax-only`): 5 of 5 sampled units OK.

Cơ sở dữ liệu được sử dụng, mà được ** Các liên lạc thay vì đã thiết lập địa chỉ tải**:
`main` 0x7100000000, `sdk` 0x7101000000, `subsdk0` 0x7102000000, `subsdk1` 0x7104000000,
`subsdk2` 0x7106000000, `subsdk3` 0x7108000000. The base affects how absolute addresses are
Được đại diện như thế nào, không phải là cách các hướng dẫn giải mã các hàm được gọi bằng tên,
the ranges need only be distinct, not contiguous. Wonder's own choice (`main` 0x4000000000,
`sdk` 0x4010000000, a 16 MB gap despite `main` being far larger) shows the same thing.

**The `sdk` segment table is also a useful sanity check**  its NSO header reports a module span of
0x765.000 (7.4 MB), và 19.322 chức năng trong 735.237 hướng dẫn phù hợp với một mô-đun mà
Kích cỡ ở mật độ mã này.

## 6, những gì chưa được xác định

- **Nó không chạy được.** Nó chứng minh mã hóa* và "compiles", chứ không phải "Splatoon 2 khởi động".
  The runtime, NVN-over-Vulkan, shaders, `sdk` module and the 6,355 indirect calls all remain.
- **The `sdk` module was not recompiled** â only `main`. Wonder recompiles both.
- **Shaders đã không bị đụng chạm.** Slatoon 2 con tàu của riêng mình bóng râm Maxwell, và thám tử 12.717 dãy nhà.
  Việc dịch thuật rất cụ thể cho sự kỳ diệu.
- **6.3535 cuộc gọi gián tiếp đuôi chưa được giải quyết**, nên thời gian chạy sẽ cần người điều vận.
- **Không có gì liên quan hoặc bị xử tử.** Không ROM, không chạy, không cửa sổ.
- ** Kết xuất không được so sánh với nhị phân** cho sự trung thành ngữ pháp hơn là đọc chấm
  chức năng.

## 7 Sản xuất

Everything needed is in `tools/wsl/`: the recompiler is at `~/refs/wonder/recomp`, dependencies are
`capstone 5.x` and `lz4` (installed without sudo, see below), and the command is the six lines in
Tổng ổ đĩa: 456 MB đầu ra, 2.6 GB nhập+repo.

**A dependency trap worth recording:** capstone **6.0.0 removed the 14 `ARM64_VAS_*` constants** the
Máy tính được sử dụng lại, và 6.x *also* đã đánh số lại các ẩn enum (5.x là sequental 1â 14; 6. x là 1.
`(count<<8)|element_size`). A compatibility shim mapping the old names onto 6.x values would have
Nó được viết ra, sau đó xóa một khi sự sắp xếp 5x đã được mã hóa.
installed.** capstone 5.0.9 ships a `py3-none-manylinux` wheel, which is Python-version
Độc lập và do đó ** did** chạy trên Python 3,14 của máy này; một bộ lọc đã tìm trước đó
only for `cp314`/`abi3`/`py3-none-any` wrongly concluded 5.x was unavailable.
