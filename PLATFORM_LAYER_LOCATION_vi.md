# Nơi lớp nền tảng thực sự là (và không có)

This document answers the question the `sdk` investigation was opened to answer, and
Câu trả lời là lớp học **không nằm trong đống rác này.

Đó là một kết quả tiêu cực quyết định, và nó thay đổi kế hoạch cảng để tốt hơn.

---

## Một.

**`nn::os`, `nn::mem`, `nn::init`, `nn::vi` and `nn::time` are not implemented in any
module in this ExeFS.** `main` declares them as unresolved imports and the system
cung cấp cho họ trong thời gian chạy.

### `sdk`'s export table is filesystem-only

Reading `sdk`'s real export string table at memory `0x3cb086` (511 mangled names)
cung cấp hồ sơ vùng tên rõ:

|Miền tên| Exports in `sdk` |
|---|---:|
| `nn::fs` | **233** |
| `nn::os` | 8 |
| `nn::mem` | **0** |
| `nn::init` | **0** |
| `nn::vi` | **0** |
| `nn::time` | **0** |

`nn::fs` dominates completely. The table opens with `nn::fs::fsa::Unregister`,
`nn::fs::fsa::Register`, `nn::fs::detail::Register`, `nn::fs::ReadDirectory`,
`nn::fs::CloseDirectory` — `sdk` is the **filesystem service module**.

Of twelve probed platform imports, **only 2 were present** (`nn::os::GetSystemTick`,
`nn::fs::MountRom`). The rest — `QueryMemoryInfo`, `AllocateMemoryBlock`,
`CreateThread`, `LockMutex`, `UnlockMutex`, `SleepThread`,
`nn::mem::StandardAllocator`, `nn::vi::Initialize`, `nn::init::InitializeAllocator` —
là **absent**.

### `sdk` has no `nn::init` or `nn::vi` text at all

Counts of mangled-name occurrences in the decompressed `sdk`:

|Miền tên|Những sự kiện xảy ra|
|---|---:|
| `_ZN2nn2fs` | 450 |
| `_ZN2nn2os` | 349 |
| `_ZN2nn4util` | 296 |
| `_ZN2nn4nifm` | 185 |
| `_ZN2nn4diag` | 73 |
| `_ZN2nn4time` | 71 |
| `_ZN2nn2oe` | 44 |
| `_ZN2nn3mem` | 33 |
| **`_ZN2nn4init`** | **0** |
| **`_ZN2nn2vi`** | **0** |

`nn::init` and `nn::vi` do not appear in `sdk` in any form.

### `main` declares each platform symbol exactly once

In `main`'s decompressed NSO:

|Ký hiệu|Những sự kiện xảy ra|
|---|---:|
| `_ZN2nn2os15QueryMemoryInfo` | 1 |
| `_ZN2nn2os19AllocateMemoryBlock` | 1 |
| `_ZN2nn2os13GetSystemTick` | 1 |
| `_ZN2nn2os11UnlockMutex` | 1 |
| `_ZN2nn2os11SleepThread` | 1 |
| `_ZN2nn4init19InitializeAllocator` | 1 |
| `_ZN2nn2vi10Initialize` | 1 |
| `_ZN2nn2fs8MountRom` | 1 |
| `_ZN2nn2os12CreateThread` | 2 |

Chính xác một đề cập mỗi biểu tượng là chữ ký của một danh sách báo chí **: chưa được giải quyết
Biểu tượng được đặt tên một lần, trong bảng biểu tượng động của module. Các tên được rải rác
across an 8 MB span of `.rodata`, which is consistent with a large `.dynstr` rather
Hơn một chiếc bàn nhỏ viết tay — các dây phụ tùng * được rải rác, không phải
Lời khai.

### Các mô-đun anh em được nén lại, nhưng hình ảnh là nhất quán

`rtld`, `main`, `sdk`, `subsdk0`–`subsdk3` are all NSO0 containers with LZ4-compressed
Phần, do đó, việc tìm kiếm chuỗi thô của tập tin trên-disk không tìm thấy gì.
`main` and `sdk` are the two that were examined, and they agree.

## 2. Cái này không được.

- **`sdk` is not the provider of `nn::os`/`nn::mem`/`nn::init`/`nn::vi`.** It is the
  filesystem service. This was the premise of the `sdk` investigation, and it is now
  Làm giả.
- **No module in this ExeFS implements the platform layer.** `main` imports it; nothing
  Ở đây định nghĩa nó.
- ** Bản đồ địa chỉ 49-port không thể phục hồi từ đống rác này**, bởi vì
  Mô- đun đích không nằm trong chỗ đổ rác. Nó đóng chì đó
  [MIMPORT_MAPPING.md] (IMPORT_MAPPING.md) và [NSO2ELF_OD0_BUG.md]
  đang đuổi theo.

## 3 nơi nó thực sự sống

Mô- đun xử lý là mô- đun hệ thống **, không phải mô- đun trò chơi — bộ chuyển đổi SDK
library (`nnSdk`) shipped in system firmware. It provides `nn::os`, `nn::mem`,
`nn::init`, `nn::vi`, `nn::time` and the rest, and `main`'s PLT binds to it by name at
Đến giờ nạp đạn rồi.

Thu thập nó ngoài phạm vi cho phân tích trò chơi-dump: nó không phải là một phần của tiêu đề, và
Kho hàng chưa bao giờ có nó.

One caveat worth stating: the earlier behaviour probe found 33 `MRS CNTPCT_EL0` sites
**inside `sdk`**. That is not contradicted — `sdk` has 349 `_ZN2nn2os` occurrences and
its own time-keeping and `nn::os` *usage* (and an 8-entry `nn::os` export set), but
that is not the same as implementing the platform API `main` imports.

## 4 Tại sao đây là tin tốt cho bến cảng

This is the most useful conclusion the `sdk` investigation produced.

** Phục hồi lớp nền tảng không bao giờ là lối tắt xung quanh sự phân hủy — nó là
Phạm vi thực tế của cổng.**

[PORT_WORKLST.md] (PORT_WORKLST.md) đã cài đặt 51 chức năng như những thứ cần thực hiện.
That framing was right all along; what `sdk` analysis adds is the reason:

- Có **no nhà cung cấp đến cảng**, vì vậy cần phải thực hiện một cách mới;
- bề mặt là **Chính xác 51 chức năng**, được ghi nhận với dấu hiệu ABI quan sát và
  Những cuộc gọi trong [PLATORM_REFERCE.md] (PLATORM_REFECE.md)
- the contract each must satisfy is visible from its **call sites in `main`**, which
  * đang ở trong bãi rác và có thể bị phá hủy — như được chứng minh bởi đôi giày tháo rời
  chức năng trong [DECOMPILED_BODES.md].

Vì vậy, công thức thực tế là: đọc người gọi, thực hiện người gọi.

## Năm, làm gì tiếp theo?

1. **Decompile `main`'s call sites** for each of the 51 imports. The arguments passed
   Mỗi cuộc gọi tiết lộ những từ ngữ cần thiết — đáng tin cậy hơn một chữ ký
   chỉ có một mình, và các chức năng bọc đã bị phân hủy.
2. **Treat [PLATORM_REFERCE.md] (PLATORM_REFERCE.md) như một sự thông thái giao diện.** Nó chỉ là một dự đoán giao diện thôi.**
   là hợp đồng tốt nhất, và được quan sát chứ không phải giả định.
3. **Hãy tìm kiếm một nhà cung cấp thực hiện.** Nó không nằm trong đống rác, và đuổi theo
   Nó còn có giá trị tiêu cực hơn nữa.
4. **Deprioritise `sdk` as a platform source**, but keep it for what it is: the
   filesystem service, with 233 `nn::fs` exports relevant to the mount/read path the
   nhu cầu đánh giày.

## 6 Những giới hạn chân thật

- **`subsdk0`–`subsdk3` and `rtld` were not individually decompressed** — they are
  compressed on disk and only `main` and `sdk` were decompressed and examined. The
  conclusion rests on those two plus the fact that `main` lists each symbol once as an
  nhập khẩu.
- **The inference that the resolver is `nnSdk` in system firmware is the standard
  Sự sắp xếp chuyển đổi, không phải cái gì đó quan sát thấy ở đây.
  symbols are absent from `main` and from `sdk`.
- **`sdk` has 8 `nn::os` exports.** They were not individually identified, so whether
  any overlaps an import `main` needs is unknown.
- **The 8 `nn::os` exports do not include most of the probed imports**, which is what
  Kết luận vẫn còn đó.
