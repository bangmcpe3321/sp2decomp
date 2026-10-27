# Decompiler-verified function bodies from `main`

Giai đoạn quan trọng của dự án này được xây dựng để: **Chính xác hóa mã giả từ
retail Splatoon 2 `main` binary**, produced by Ghidra 12.1.2 through REA's provider.

Không có gì ở đây được mã hóa bằng tay. Đây là kết xuất phân hủy.

---

## Làm thế nào để có được nó?

Hai điều phải được đúng cùng một lúc, và trước đó nỗ lực đã không có cả hai:

1. **Analysis must complete.** A full `analyzeHeadless` run on the 21 MB binary
   finished and saved its project (`FullRun.rep`) on the Windows side. This is the
   Chạy bộ mà trước đây trông có vẻ như là "tránh né" — nó chỉ đơn giản là dài.
2. **Không phải là NSO, và không phải thông qua ngân sách theo yêu cầu của REA.** phân tích đã chạy
   chống lại ** NSO NSO* thông qua ScomeLoader, vì vậy chương trình mang
   Biểu tượng riêng của module — đó là lý do tại sao kết xuất hiển thị các loại C++ thực sự thay vì
   `FUN_xxxxxxxx`.

Một khi một dự án phân tích đầy đủ đã tồn tại, chiết xuất cơ thể là rẻ:

```powershell
& "$GHIDRA\support\pyghidraRun.bat" -H <project-dir> FullRun -process main -noanalysis `
    -scriptPath <scripts> -postScript ExtractDecompiled.py <out.txt>
```

`-noanalysis -process main` reuses the saved analysis instead of redoing it.
PyGhidra is required — plain `analyzeHeadless` runs Jython and fails with
*"Ghidra không bắt đầu với PyGhidra".

## Kết quả

|Địa chỉ|Hàm|Kích cỡ|Bị phân hủy|
|---|---|---:|---|
| `0x710090ab30` | `Game::PlayerInkAction::shotBullet_B` |1180 B| ✅ |
| `0x71011f5b20` | `Lp::Sys::SysInit::Init` |1308 B| ✅ |
| `0x71011f5ab4` | `Lp::Sys::SysInit::nninitStartup` |108 B| ✅ |
| `0x7100e6724c` | `sead::GameFrameworkNx::initialize` |20 B| ✅ |
| `0x7101375144` | `nn::ui2d::Pane::Pane()` |132 B| ✅ |

**5 trong số 5 người thất bại, 0 thất bại.**

Các loại là có thật, đó là tín hiệu mạnh nhất mà các biểu tượng được sử dụng:

```c
/* Game::PlayerInkAction::shotBullet_B() */
void __thiscall Game::PlayerInkAction::shotBullet_B(PlayerInkAction *this)
{
  ...
  MainWeaponMgr *pMVar13;
  ...
}
```

`PlayerInkAction*` as the implicit `this`, and `MainWeaponMgr*` as a local — both
Được giải quyết từ bảng biểu tượng của mô-đun.

## Điều này xác nhận những gì

** Ba kiểm tra độc lập bây giờ đồng ý với công việc mã hóa tay:**

### Kích cỡ cơ thể xác nhận điều chỉnh trước đó

|Hàm|Ước tính mã hoá tay|Ghidra|Lệnh nhập|
|---|---:|---:|---|
| `SysInit::Init` |1308 B|**1308 B**|chính xác|
| `nninitStartup` |108 B|**108 B**|chính xác|
| `GameFrameworkNx::initialize` |20 B|**20 B**|chính xác|
| `Pane::Pane()` |132 B|**132 B**|chính xác|

Kích cỡ đã mã hóa bằng tay.
next-symbol-plus-`RET` heuristic. They match Ghidra's independently computed function
Giới hạn chính xác. Đây là giá trị trực tiếp của phương pháp giải mã được dùng trong suốt
the repository — including the `B`-vs-`BL` tail-call rule that fixed the closure from
282 đến 184

### 2. `GameFrameworkNx::initialize` is the 20-byte tail-call wrapper

Bản mã được mã hóa bằng tay cho thấy có một cuộn giấy gói gắn sau đuôi.
ở cùng kích cỡ.

### 3. `Pane::Pane()` is 132 bytes

Phù hợp với phân tích từ trường vào
Dịch bởi Vũ Hạnh, Mai Linh, Nga, Ann, Yuki, Phương The Vampire3X Subteam

## Tại sao đây là bước ngoặt

Mỗi kết quả trước đó trong kho này đều có cùng ba hang động:

- không có thi thể chức năng, chỉ có tên và địa chỉ;
- `BLR` register-indirect targets invisible, so virtual dispatch was missing;
- Không thể nào loại trừ được.

**Cả ba đều không thể dời đi được. ** Kẻ tháo dỡ thấy cái gì mà không thể tháo gỡ tay, và
bảng biểu tượng cho phép nó làm việc với những loại thực sự.

## Giới hạn trung thực

- ** Năm chức năng đã bị phân hủy, từ 113, 150.** Đây là phương pháp và
  Nó không phải là một cuộc khảo sát của hệ nhị phân.
- ** Đầu ra bị ngắt là gihdra pseudo code, không phải Abitic C++.** Tên biến
  like `uVar13` and `local_e8` are Ghidra's, not the original source.
- ** Không có chức năng nào được kiểm tra để so sánh lại với một nhị phân khớp.** Đó là
  Tiêu chuẩn phân hủy khớp và không có gì ở đây tiếp cận nó.
- ** Tập tin xuất không được thực hiện.** Đó là cách vẽ mã của Nintendo;
  thủ tục được thực hiện thay vào đó, vì vậy nó có thể được tái tạo.
- **Các tổ chức đã được lấy từ phân tích Windows bên.** Việc chạy Linux chưa đóng gói
  vẫn còn đang tiến triển và có thể tạo ra một dự án độc lập thứ hai.
