# `nso2elf.mjs` MOD0 export bug — root cause

Round 4 traced why the converter yields **113,150 real names for `main`** but a
**corrupt `.symtab` for `sdk`**. The cause is identified; the fix is not yet written.

---

## Chính xác là con bọ.

`nso2elf.mjs` reads two offsets from the MOD0 header:

```js
const strOff = s32(modOff + 0x18);
const symOff = s32(modOff + 0x1c);
```

For `sdk`, those two 32-bit reads are:

|Tìm kiếm|Giá trị đọc|Cái gì đây?|
|---|---|---|
| `MOD0+0x18` → `strOff` | **`0x6bf5b8`** | the **`ModuleOffset`** — a pointer to a **zeroed struct** in `.rwdata` |
| `MOD0+0x1c` → `symOff` | **`0xd10243ff`** |**garbage** (giải thích là tiêu cực)|

Cũng không phải là một con trỏ có dây hay biểu tượng. Kết quả được giải thích đầy đủ
by the `.symtab` internals:

|Check|Kết quả|Nghĩa là|
|---|---|---|
| `st_name` in range of `.strtab` | **367 / 367** |người chuyển đổi đã viết một bảng tự chấp nhận|
| `st_name` monotonically increasing | **yes** — `1, 0x19e, 0x19f, 0x1a0, 0x1a2, 0x1c9, 0x1ca, 0x1f0, 0x216…` |nó đang đi bộ *một số * bảng chuỗi chính xác|
| `st_value` inside `.text` | **0 / 12** |Nhưng địa chỉ thì vô nghĩa.|
| Names beginning `_Z` | **0 / 367** |Và chuỗi là mảnh vỡ|

Vì vậy, người chuyển đổi là **trong nội bộ nhất quán nhưng đọc sai nguồn**.
`st_name` offsets are a valid ascending walk of a string table that it found at the
Sai cơ sở; chuỗi ở đáy là C++ mẫu mảnh, không phải tên xuất khẩu.

## 2. Nơi thực sự xuất khẩu bảng chuỗi

**Memory `0x3cb086`** (file `0x3cb186`), inside `.rodata`. Measured properly, it is
**56,541 byte** chứa **511 cái tên hoàn toàn rối rắm**, trong đó **446**
are `_ZN2nn*`. It begins correctly:

```
[0x3cb086] 0x00
[0x3cb087] "_ZN2nn2os13GetSystemTickEv"
[0x3cb0a2] "_ZN2nn2fs3fsa10UnregisterEPKc"
[0x3cb0c0] "_ZN2nn2fs3fsa8RegisterEPKcONSt3__110unique_ptrINS1_11IFileSystem…"
[0x3cb11e] "_ZN2nn2fs6detail8RegisterEONSt3__110unique_ptrINS1_18FileSystemAccessor…"
[0x3cb183] "_ZN2nn2fs13ReadDirectoryEPlPNS0_14DirectoryEntryENS0_15DirectoryHandleEl"
```

Có hai điều nổi bật:

1. **The first name is `_ZN2nn2os13GetSystemTickEv`** — the exact symbol `main`
   Nhập (xem [IMPORT_MAPPING.md] (IMPORT_MAPPING.md).
2. **The second is `nn::fs::fsa::Unregister`**, then FS functions — an ordering that
   có vẻ như danh sách xuất khẩu bị quản lý, không phải dữ liệu chuỗi ngẫu nhiên.

Điều này supersress dưới số thấp của "41 tên hơn 2,110 byte", mà đến từ
aborting the walk on the first token not starting `_ZN2nn` (it stopped at the libc++
names `_ZNSt3__1…`).

## 3. Bản đồ trường có khả năng

The MOD0 header holds `DynamicOffset`, `BssStartOffset`, `BssEndOffset`,
`ExceptionInfoStartOffset`, `ExceptionInfoEndOffset`, `ModuleOffset` — **and
`main`'s `MOD0+0x18` happens to equal its `DynamicOffset`** (`0x2f9a468`), which is why
the conversion appears to work there: `main`'s dynamic section and the string data the
converter needs happen to align, or the real `strOff` is found by luck.

For `sdk`, `MOD0+0x18` is `ModuleOffset` instead. So the two modules disagree because
**the field the converter assumes at `+0x18` is not `strOff` at all** — it is a
trường MOD0 khác nhau có ý nghĩa khác nhau theo mô- đun. Con trỏ có khả năng xuất khẩu thật
Phải đến từ một địa điểm khác nhau: hoặc bảng xuất khẩu được mô tả bởi
`ModuleObject` (which is runtime-generated and therefore absent), or it is reached via
the `.dynamic`/`DT_*` path.

## 4 cái gì chưa được thiết lập

- ** Bảng biểu tượng biểu tượng xuất khẩu không được tìm thấy.** Với bảng chuỗi đo
  Chính xác (511 tên) và một yêu cầu về sự phân biệt** — đã loại bỏ
  earlier false positive of 88 identical entries — a scan of the whole `.rodata` range
  (`0x2cf000..0x68a0e8`) found **no run of 50 or more distinct valid
  `{address, nameOffset}` pairs**. So the export names are **not** paired with a
  contiguous address array in `.rodata`.
- **The correct MOD0 field for `strOff` was not identified.** Only that `+0x18` is
  wrong for `sdk`.
- **Whether the 511-name table covers `main`'s 49 imports is unverified.** Individual
  spot checks succeed (`_ZN2nn2os13GetSystemTickEv` is present and is the first entry),
  nhưng một so sánh có hệ thống chưa hoàn tất — một lỗi trích dẫn trình bao đã làm hỏng
  Kiểm tra lần cuối và nó không chạy lại.
- **The mapping from `main`'s 49 imports to `sdk` addresses remains unknown.**

## 5. Việc sửa chữa bê tông để tiếp theo

1. ** Đọc lại phương tiện MOD0 đối đầu với danh sách các công cụ chuyển giới**, xác nhận nào
   offset holds the module's export pointers rather than assuming `+0x18`/`+0x1c`. The
   đọc nên *validate* những gì nó tìm thấy — một bảng dây phải bắt đầu với NUL
   tiếp theo là văn bản in được — thay vì tin tưởng vào sự bù đắp.
2. **Point `strOff` at `0x3cb086`** and confirm the resulting `.strtab` contains
   `_ZN2nn2os13GetSystemTickEv` first.
3. **Search for the address array outside `.rodata`** — it may live in `.rwdata`, be
   Chia thành các dãy tên/ mũ riêng (như xuất khẩu Mach-O cố gắng làm), hoặc được lấy ra
   từ ModuleObject được tạo ra từ thời gian.
4. **Regression-check against `main`**: any corrected parser must still produce
   `main`'s 113,150 names. That check is what makes the fix trustworthy.

## 6 Tại sao điều này quan trọng?

`main` resolves its platform imports **by name** at load time through a dynamic linker
(proven in [IMPORT_MAPPING.md](IMPORT_MAPPING.md)), and `sdk`'s export string table
**begins with `_ZN2nn2os13GetSystemTickEv`** — the first symbol `main` needs. If the
paired address data can be found, the 49 imports resolve to concrete `sdk` addresses,
Đó là bước mà mục tiêu đã bị chặn.

Điều này vẫn còn là đầu mối mở giá trị cao nhất: couling làm việc cho một module
và không phải là khác, và thất bại bây giờ được giảm xuống hai lĩnh vực cụ thể đọc
cộng với một địa chỉ bị mất.
