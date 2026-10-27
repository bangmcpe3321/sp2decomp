# The `open-ead` ecosystem: complete assessment

Full survey of [github.com/orgs/open-ead/repositories](https://github.com/orgs/open-ead/repositories)
- **16 tái định cư** — và giá trị của mỗi cái cảng này.

---

## 1, kiểm tra xong.

Repositories, with the relevance verified against `main`'s symbol table where
Ứng dụng:

|Thư mục homeName|Ngôn ngữ|Sao| Functions in `main` |Lệnh nhập|
|---|---|---:|---:|---|
| [sead](https://github.com/open-ead/sead) |C++| 252 | 4,022 |♪ Quan hệ phụ thuộc **|
| [agl](https://github.com/open-ead/agl) |C++| 46 | 2,852 |♪ Quan hệ phụ thuộc **|
| [nnheaders](https://github.com/open-ead/nnheaders) |C++| 50 | — | ✅ nnSdk headers (superseded by `nnsdk`) |
| [nx-decomp-tools](https://github.com/open-ead/nx-decomp-tools) |**Rust**| 27 | — |♪ Công cụ hóa; MIT-lished**|
| [EventFlow](https://github.com/open-ead/EventFlow) |C++| 16 | **0** |_Không có trong danh hiệu này|
| [eui](https://github.com/open-ead/eui) |C++| 8 | **803** |lớp l, trước đây bị trượt**|
| [nnsdk](https://github.com/open-ead/nnsdk) |C++| 4 | — | ✅ nnSdk + NVN + `nn::gfx` |
| [nnware](https://github.com/open-ead/nnware) |C++| 3 | 2,823 | ✅ `g3d`/`ui2d`/`atk`/`vfx`/`font` |
| [NintendoSDK-NEX](https://github.com/open-ead/NintendoSDK-NEX) |C++| 3 | **6,815** |Không cần phải ngắt kết nối.|
| [botw-lib-musl](https://github.com/open-ead/botw-lib-musl) |C| 2 | — |Yêu cầu tham khảo sơ đẳng|
| [containers](https://github.com/open-ead/containers) |C++| — | 0 (`ttl::`) |teppi82@ gmail. com|
| [NW4F-Eft](https://github.com/open-ead/NW4F-Eft) |C++| — | 10 (`nw4f`) |Thỉnh thoảng không có mặt|
| [uking](https://github.com/open-ead/uking) |C++| — | — |TotK decomp, không phải thời đại máy này|
| [curl](https://github.com/open-ead/curl) |C| — | 24 |Tiệm bán hàng thứ ba|
| [nx-decomp-tools-binaries](https://github.com/open-ead/nx-decomp-tools-binaries) | — | — | — |teppi82@ gmail. com|
| [botw-decomp-www](https://github.com/open-ead/botw-decomp-www) | — | — | — |_Không liên quan|

### Name

**[open-ead/eui](https://github.com/open-ead/eui)** — `eui` is the extended UI
layer, and `main` has **803 `eui::` functions**. It is small (18 KB) but it is a
lớp thực mà
[phụ đề-map.txt] danh sách hệ thống-map.txt] và rằng trước đó trên mỗi-repostory
assessments did not cover. It should be treated alongside `nnware`'s UI modules.

---

## 2. `nx-decomp-tools`: the tooling, and it is MIT-licensed

Đây là kết quả tìm thấy nhất bên cạnh các thư viện, và nó là
**Nhà kho duy nhất trong tổ chức với giấy phép được công nhận**
(`MIT`; `botw-lib-musl` has `NOASSERTION`).

Nội dung:

```
viking/                     Rust matching-verification tool
  src/elf.rs                14 KB   ELF parsing
  src/functions.rs           9 KB   function extraction
  src/checks.rs             22 KB   match checking
  src/tools/check.rs        26 KB   the check driver
  src/tools/decompme.rs     20 KB   decomp.me integration
  src/tools/list_symbols.rs  3 KB   symbol listing
ghidra_scripts/DWARF.java
ghidra_scripts/RenameFunctionsInGhidra.java
ida_scripts/rename_functions_in_ida.py
ida_scripts/ida_remove_function_tails.py
progress.py, setup_venv.py, util/
asm-differ/                 (git submodule)
```

**Để làm gì:*** so sánh sự phân hủy* — xây dựng lại nguồn gốc và
Đang kiểm tra các đối tượng đã biên dịch trùng với các chức năng nhị phân ban đầu.
has the standard decomp-project components: `config.py`/`tools.py` setup helpers, a
`progress.py` completion tracker, and `asm-differ` for assembly diffs. The IDA
script name `ida_remove_function_tails.py` is a strong hint that the tooling
đã đối mặt với cùng một vấn đề chức năng ** được ghi lại trong
Được rồi.

**Một sự thận trọng chiến lược. ** Cái thứ này giả định sự tương xứng-chia sẻ*
Nó không dùng được cho chiến lược **patch-Don't-re wrix**
được đề nghị trong [Không có bằng chứng.
tạo ra một hệ nhị phân được xây dựng lại để đối chiếu.

Do đó hệ sinh thái kéo theo hai hướng:

- **The repositories are for matching decompilation.** `sead`, `agl`, `nnware`,
  `nnsdk` are all built to enable reconstruction to a byte-matching standard.
- **Người dùng đã xác định mục tiêu là cổng máy tính tạm thời.** Theo bảng điều khiển- không được ghi,
  library repos are still useful as *references*, but `nx-decomp-tools` is not.

Điều này đáng cho chúng ta bày tỏ rõ ràng thay vì cho rằng cả hai đều tương thích nhau.

---

## 3 Những gì hệ sinh thái không giải quyết được

The **Switch-specific `sead` classes** remain the standing gap, unchanged by this
Theo dõi:

|Hạng|Hàm|Trong bất kỳ ủy ban nào?|
|---|---:|---|
| `sead::GameFrameworkNx` | 35 | ⚠ `sead` header only |
| `sead::GraphicsNvn` | 47 | ⚠ `sead` header only |
| `sead::PerformanceMgrNx` | 14 | ❌ absent from `sead` |
| `sead::ForegroundBucketMgr` | 1 | ❌ absent from `sead` **and** `agl` |

Không có kho lưu trữ nào trong tổ chức lấp đầy những thứ này, chỉ có nhị phân.

---

## 4. Hình ảnh phụ thuộc của Hợp nhất

|Lớp|Hàm|tham chiếu tốt nhất|Giấy phép|
|---|---:|---|---|
|Bàn NVN|1 mục nhập| `nnsdk/lib/nvn` (code) |không có|
| `nn::gfx` | 289 | `nnsdk/lib/gfx` (code) |không có|
| `nn::os`/`mem`/`fs`/`hid`/`vi` | ~382 | `nnsdk` / `nnheaders` (headers) |không có|
| `nn::g3d`/`ui2d`/`atk`/`vfx`/`font` | 2,823 | `nnware` (headers, stubs) |không ai + sử dụng hạn chế|
| `eui` | 803 | `eui` |không có|
| `sead` non-NX | ~4,022 | `sead` (decompilation) |không có|
| `agl` | 2,852 | `agl` (decompilation) |không có|
|musl libc| 4 | `botw-lib-musl` |KHÔNG CÓ THỂ|
| `sead::*Nx` | ~97 | — |** Không có gì**|
|& Ngắt kết nối| — | `nx-decomp-tools` |**MIT** _BAR_|

**Mọi tầng thư viện chính đều có tham chiếu.
không có giấy phép.

---

## Đề nghị 5.

1. **Adopt `nx-decomp-tools` deliberately only if you pursue matching
   Sự phân hủy.** Nó được lập trình bởi MIT và giải quyết một vấn đề thực sự, nhưng nó không
   Vừa phù hợp đừng viết.
2. **Add `eui` to the reference set.** 803 functions, small repo.
3. **Do not bother with `EventFlow`, `containers`, `NW4F-Eft`, or `uking`** — the
   Không có vùng tên thích hợp trong chương trình này hoặc khớp dấu không.
4. **`NintendoSDK-NEX` is irrelevant while the port is offline-only.** It covers
   the 6,815 `nn::nex` functions that the offline decision removed from scope.
   Giữ nó lại chỉ khi nào trên mạng được thăm lại.
5. ** Giải quyết bản quyền trước khi phối hợp bất kỳ mã thư viện nào. ** Năm trong số sáu.
   library repositories have no license, and `nnware` additionally disclaims use
   ngoại lệ.
6. **The remaining unknown is unchanged and specific:** the Switch-specific `sead`
   classes (`GameFrameworkNx`, `GraphicsNvn`, `PerformanceMgrNx`,
   `ForegroundBucketMgr`, ~97 functions) have no reference anywhere in this
   Hệ sinh thái.

## 6. Bước tiếp theo sẽ có giá trị cao nhất

**Verify một bố trí, kết thúc để kết thúc.** Chọn một lớp riêng lẻ xuất hiện trong nhiều hơn
one repository — `sead::GameFrameworkNx` (declared in `sead`, used by `agl`'s
`GraphicsNvn`, instantiated in `main`) — and check that:

1. the header's `static_assert` sizes agree across repositories, and
2. the sizes match the actual construction site in `main`.

Nếu đồng ý, các tài liệu tham khảo là đáng tin cậy và cảng có thể tiếp tục nói về chúng.
Nếu họ không đồng ý, phiên bản khớp là sai và mọi bố trí phải được xác nhận
Mỗi cá nhân thay đổi kế hoạch một cách đáng kể.
Sự khác biệt giữa "Tôi có 6 bộ phận tái sử dụng" và "Tôi đã xác nhận được nền tảng," và
Nó sử dụng phương pháp mã địa chỉ đã được xây dựng trong kho này.
