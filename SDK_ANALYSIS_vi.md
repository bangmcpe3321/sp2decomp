# `sdk` module analysis

> ** Tài liệu tham khảo có thể dịch [SDK_REFERCE.md] [SDK_REFERCE.md].** Tài liệu này
> là bản ghi điều tra phía sau nó: phương pháp, các phát hiện vòng quanh, và các
> Kết quả tiêu cực.

Progress report on the module that holds the real implementations behind `main`'s
49 nền tảng nhập khẩu Thunks.

---

## Một, tiêu đề tìm kiếm: kiến trúc đã được chứng minh, không phải giả định

**`main` does not read the ARM64 system counters or issue syscalls. `sdk` does.**

Bộ thăm dò không có biểu tượng trên cả hai mô-đun:

|Bảng chỉ thị| `main` | `sdk` |Nghĩa là|
|---|---:|---:|---|
| `MRS CNTPCT_EL0` | **0** | **33** |phản hồi vật lý — Giữ thời gian|
| `MRS CNTVCT_EL0` | 0 | 0 |ô ảo|
| `MRS MPIDR_EL1` | **0** | **2** | core id — `GetCurrentCoreNumber` |
| `SVC` (syscall) | **0** | **104** |Cuộc gọi cấp trên — Dịch vụ hệ điều hành|
| `MRS` total | 0 | 91 | |

`.text` scanned: 735,251 words in `sdk`, 5,264,410 in `main`.

**This independently confirms the import-thunk finding.** `main` contains no code
that could implement `nn::os::GetSystemTick` — no counter reads at all — while `sdk`
contains 33. The platform layer is genuinely implemented in `sdk`, established by
Hành vi hơn là biểu tượng.

## 2, những gì đã được hoàn thành

|Step|Kết quả|
|---|---|
| hactool decompressed `sdk` | build id `972CC255…`, `.text` 0x2ce04c (2.9 MB) |
| `nso2elf.mjs` rebuilt it |ELF64 AArch64, 7.113.072 byte, 5 đầu chương trình|
| `validate-elf.mjs` |**VALID — không gặp vấn đề về cấu trúc nào cả**|
|Mục nhập MOD0| `0x28` — a real entry point, unlike `main` |
|Phân tích Ghidra chưa đóng gói (Linux/WSL)|**Exit 0 in 2m51s**, dự án được lưu giữ|
|kho|**8,267 chức năng, 65.055 ký hiệu, 17,854 chuỗi**|

**Analysis cost is a practical result in itself: 2m51s for `sdk` against a much longer
run for `main`'s 23 MB.** `sdk` is the right scale to work at, confirming the
Lời khuyên lập trình trong [CING.md].

## 3. Một sửa chữa quá khổ mà không chặn tất cả các văn lệnh

Bộ phân tích không đầu Ghidra 12 có **no Jython** — một bộ giải mã Python thất bại với
*"Ghidra không bắt đầu với PyGhidra. Python không có."* Và **PyGhidra
cannot install on this host**: the bundled `jpype` wheels are cp310/cp311 while the
distro ships **Python 3.14**, so `pip install --no-index` fails.

Tập lệnh Java là con đường duy nhất.
**sillly thất bại**, và nguyên nhân hóa ra là hai lỗi biên dịch thông thường mà
đã không bao giờ xuất hiện:

```java
DataUtilities.isStringData(d)          // no such method in Ghidra 12
sv.replace('\n', "\\n")                // String.replace(char, String) does not exist
```

Both fixed in `tools/ghidra/ExportInventory.java`. Compile explicitly against
Ghidra's 195-jar classpath and place the `.class` beside the source:

```bash
CP="$(find "$GHIDRA_INSTALL_DIR/Ghidra" -name '*.jar' | tr '\n' ':')"
javac -nowarn -cp "$CP" -d build ExportInventory.java
cp build/*.class <scriptDir>/
analyzeHeadless <proj> Sp2Sdk -process sdk.elf -noanalysis \
    -scriptPath <scriptDir> -postScript ExportInventory.java <out.txt>
```

`tools/ghidra/ExtractDecompiled.java` is the Java successor to the Python
Kẻ phá hoại, cần có cùng một lý do.

## 4. Tại sao các chức năng của nền tảng vẫn chưa được đặt tên

The goal was `nn::os::QueryMemoryInfo`, not `FUN_0000xxxx`. Three routes were tried.

### Đường A — tên bị gạch ngang chỉ là văn bản

`sdk` contains **8,579 distinct `_ZN2nn…` strings**, **1,496** of them in the platform
Miền tên:

```
_ZN2nn2os13FinalizeMutexEPNS0_9MutexTypeE
_ZN2nn2os21TryWaitInterruptEvent...
_ZN2nn4util6detail7FloatPiE
```

They live as **plain strings in `.rodata`**. A string is not a mapping: nothing ties
Văn bản tới địa chỉ của hàm. Phần lớn là gần như chắc chắn ** xác định hoặc ghi nhật ký
text** — the tell is that `_ZN2nn4util6detail7FloatPiE` is a *data* symbol and cannot
là một hàm số khẳng định.

### Đường B — Bàn xuất khẩu của MOD0 được sản xuất thời gian

MOD0's `ModuleOffset` (`0x6bf5b8`) points into `.rwdata` where the struct is
**zeroed**. This matches the [SwitchBrew MOD specification](https://switchbrew.org/wiki/MOD),
which describes `ModuleOffset` as *"offset to runtime-generated module object,
typically equal to `.bss` base"*. Four candidate field layouts produced no export
Mục nhập.

### Route C — the converter's `.symtab` is corrupted for `sdk`

`sdk.elf` has a `.symtab` (8,832 bytes = 368 entries) and `.strtab` (20,204 bytes),
nhưng nội dung của nó không phải là tên.

```
TypeE4EEEEENS1_6detail14CoreMethodInfoINSt3__15tupleIJNSC_18OutRawArgumentInfo…
s6detail25virtual_socket_collection5CloseEiRi
```

`_ZN2nn2os` and `GetSystemTick` appear **zero** times in `.strtab`. So the export
table `nso2elf.mjs` emitted is misaligned or mis-sourced for this module — it worked
for `main` (which yielded 113,150 real names through Ghidra) but not here.

## 5. lộ trình dựa trên dấu ấn hoạt động, nhưng ranh giới của tôi thì không.

The promising approach: find `nn::os` implementations by **behaviour**. `GetSystemTick`
must read the counter, so a `MRS CNTPCT_EL0` site *is* part of a time function.

Scanning `.text` for the markers and scanning *backwards* for a prologue
(`stp x29,x30,[sp,#-N]!`) produced plausible function addresses:

|Dấu hiệu|Nơi Mạng|Tìm thấy hàm tách rời|
|---|---:|---:|
| `MRS CNTPCT_EL0` | 33 | 8 (at `0x7ee80`–`0x85e3c`) |
| `MRS MPIDR_EL1` | 2 | 2 (`0x27b994`, `0x27bc0c`) |
| `SVC` | 104 | **1** — a single 16-byte function at `0x9e648` |

**Nhưng lời cáo buộc là không đáng tin.** Hủy hoại 11 ứng cử viên đó sản xuất
chức năng của 20–80 byte mà là **thin wrappers**, không phải là đếm ngược độc giả:

```c
void FUN_0007f8e4(void)
{
  thunk_FUN_002bb75c(&DAT_005af33b, &DAT_005af33b, &DAT_005af33b, 0);
  return;
}
```

The reason is now clear: **`stp x29,x30,[sp,#-N]!` is not a reliable function-entry
Đánh dấu.** Nó cũng xuất hiện cho các chồng thứ hai bên trong các chức năng lớn hơn, vì vậy
scanning backwards lands mid-function. The `SVC` result makes this obvious — a
Hàm 16- byte không thể chứa 104 âm tiết, và một đọc một chiều đơn là
Không thể chấp nhận được. dấu hiệu * là có thật; không thể xác nhận chức năng thất bại.

**Một điều mà các neo đã thiết lập chính xác: kích thước hàm được báo cáo bởi
Quét (32, 32, 28, 32, 32, 32, 80, 64, 676, 284, 20 byte) khác với của Ghidra
Giới hạn của cùng một địa chỉ, đó là thêm bằng chứng các ranh giới của scan là
Đúng hơn là của Ghidra.

## 6 Điều này có nghĩa gì cho cảng

Mục đích ban đầu là để thay thế *"di tích 51 chức năng"* với *"port 51
Chức năng bạn có thể đọc." Đó là **5 thành công**:

- ✅ **`sdk` is analysed.** 8,267 bodies are available, an uncapped analysis of the
  2.9 MB module mất dưới 3 phút, và lớp hệ điều hành là **proven** để sống
  ở đó bằng chứng bằng cách chỉ dẫn.
- Dịch bởi Vũ Hạnh, Mai Linh, Nga, Nga, Huy Tô, Huy Tô, Yuki, Ann, Phương
- Vấn đề bản đồ chưa được giải quyết.

Khoảng cách vẫn còn **a vấn đề bản đồ, không phải vấn đề phân tích**, và nó bị ràng buộc
49 bút chì.

## 7, bước tiếp theo, theo thứ tự trả tiền mong đợi

1. **Fix phát hiện giới hạn.** sử dụng danh sách hàm của Ghidra (1.267 mục nhập,
  bây giờ xuất khẩu) và truy vấn * mà chức năng chứa địa chỉ X* thông qua Ghidra hơn
   chứ không phải scan byte thô cho phần mở đầu. Đây là một thay đổi nhỏ thành một tập lệnh Java và
   sẽ lập tức xác nhận chính xác tất cả 139 điểm đánh dấu.
2. **Resolve `main`'s GOT entries to `sdk` addresses.** Each thunk forwards through
   chính xác là một con trỏ; lập bản đồ tên  hoài niệm chức năng cấu trúc.
   Độ phân giải tương tác tái định vị.
3. **Fix or bypass the `.symtab` corruption** in `nso2elf.mjs` for `sdk`, which would
   Phục hồi 337 tên xuất khẩu thật.
4. **Find the matching vendor SDK symbol file** for build `972CC255…`.

## 8 Giới hạn trung thực

- **No `sdk` platform function is named.** All 8,267 are `FUN_*`/`LAB_*`.
- ** 11 ứng cử viên bị triệt tiêu là những chức năng sai** — bọc, chứ không phải đánh dấu
  Nơi Mạng. Nguyên nhân được xác định (không thể đọc lời mở đầu); chưa cố định.
- **`nso2elf.mjs`'s `.symtab` for `sdk` is corrupt**; the 264 extracted names are
  mảnh vỡ.
- **Các chuỗi 1.496 không được chứng minh là tên chức năng.**
- **`main`'s GOT → `sdk` linkage was not attempted.**
