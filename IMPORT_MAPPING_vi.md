# Why `main`'s imports cannot be mapped to `sdk` addresses statically

This records the round-3 investigation into the 49-platform-import → `sdk` mapping, and
đó là một kết quả âm tính**, nhưng một kết quả rõ ràng,
Và nó giải thích những gì mà bất kỳ nỗ lực nào trong tương lai phải làm.

---

## 1.

Every platform function in `main` is a thunk that dereferences a GOT slot:

```c
void nn::os::GetSystemTick(void)
{
  (*(code *)PTR_GetSystemTick_7102f9a700)();
}
```

Đọc những khe cắm trong ảnh tĩnh cho câu trả lời bất ngờ — **Tất cả đều giữ
cùng giá trị:

|Có khe|Nhập|Nội dung tĩnh|
|---|---|---|
| `0x2f9a700` | `GetSystemTick` | `0x1412148` |
| `0x2f9b518` | `AllocateMemoryBlock` | `0x1412148` |
| `0x2f9b6a8` | `QueryMemoryInfo` | `0x1412148` |
| `0x2f9b6b0` | `SetMemoryHeapSize` | `0x1412148` |

`0x1412148` lies inside `.text` (`0x0..0x1415068`), i.e. it is **code**, not a resolved
Địa chỉ hàm. Giải mã nó:

```asm
0x1412148  a9bf7bf0   stp  x16, x30, [sp, #-16]!
0x141214c  9000dc50   adrp x16, 0x2f9b000
0x1412150  f9433211   ldr  x17, [x16, #0x660]    ; 0x2f9b660
0x1412154  91198210   add  x16, x16, #0x660
0x1412158  d61f0220   br   x17
```

Đó là kinh điển **PLT0 lười biếng-binding stub**: bấm các liên kết bộ nhớ, nạp
dynamic-linker resolver from a GOT slot, and branch to it. `main`'s `.rwdata` is 89%
Không số không và các khu vực xung quanh chứa một cặp song song, phù hợp với một
PLT dân cư.

## 2 nghĩa là gì?

**`main` does not statically reference `sdk`.** All 49 platform imports funnel through
một bộ giải quyết liên kết động, giải quyết mỗi biểu tượng **by tên lúc nạp** và
patches the GOT slot. The static file therefore contains no `main` → `sdk` address
Bản đồ để phục hồi, bởi vì không có gì tồn tại cho đến khi người chở hàng chạy.

Đây là lý do tại sao mỗi con đường tĩnh thất bại, và nó là một kết luận mạnh mẽ hơn so với "The
Bản đồ không được tìm thấy: ** Bản đồ không có trong tập tin.**

## 3. The name table in `sdk` is real loader metadata

A separate question — whether `sdk`'s dense `_ZN2nn…` strings are symbols or assertion
tin nhắn — giờ đây được giải quyết và thuận lợi hơn.

|Thử|Kết quả|
|---|---|
|Có phải các biểu tượng nhập khẩu chính xác là có mặt không?| `_ZN2nn2os13GetSystemTickEv`, `_ZN2nn2os15QueryMemoryInfoEPNS0_10MemoryInfoE`, `_ZN2nn2os19AllocateMemoryBlockE`, `_ZN2nn2os12CreateThreadE`, `_ZN2nn3mem17StandardAllocator` — **all present** |
|Phân cách|**NUL ở cả hai bên** - Hình biểu tượng, chứ không phải giữa|
|Mật độ| **124–145** NUL-separated `_ZN2nn` tokens per 4 KB |
|Tổng số|**8.579 cái tên riêng biệt**, **5,321 hoàn thành**|
|Chúng có được mã hóa không?| **0 of 200 sampled**, across **6,957** ADRP+ADD pairs in `.text` |

Số không tham khảo là thống kê quyết định. Các chuỗi phân tích được tải bởi các
Bộ mã xác nhận: những thứ này không được tải bởi bất cứ thứ gì. ** Chúng là một tên có tải
table, not assertion text** — which means `sdk` is the module that provides this API by
Tên, chính xác theo yêu cầu của PLT.

Vì vậy, cả hai nửa của chuỗi được chứng minh:

- `main` resolves its platform imports **by name** through a dynamic linker.
- `sdk` supplies a **name table containing those exact symbols**.

## Tại sao bản đồ vẫn còn thiếu

Không tìm thấy bảng tên kèm theo bảng mũ trùm.** Nỗ lực:

- **`.dynamic` is not standard.** Dumping it yields `DT_RELA = 0x7` then
  `DT_BIND_NOW = 6ffffff9`, with tags and values interleaved in a non-ELF way
  (`0x2928cd0` at `+0`, `0x3` at `+8` where a `DT_*` tag belongs). `DT_SYMTAB` and
  `DT_STRTAB` are not recoverable by reading tag/value pairs, and the derived symbol
  count comes out `NaN`.
- **`nso2elf.mjs` drops the symbol table for `main`.** `main.converted.elf` has only
  6 sections — `.text`, `.rodata`, `.rwdata`, `.bss`, `.shstrtab` and a null — with no
  `.dynsym`/`.dynstr`/`.rela.*` at all. Yet Ghidra reported 113,150 named functions for
  `main`, so those names come from the **original NSO** through SwitchLoader, not from
  tập tin đã chuyển đổi.
- **`nso2elf.mjs` corrupts `.symtab` for `sdk`** (fragments such as
  `TypeE4EEEEENS1_6detail14CoreMethodInfo…`, and `_ZN2nn2os` appears zero times).
- **MOD0's export table is runtime-generated**; `ModuleOffset` (`0x6bf5b8` for `sdk`)
  points into `.rwdata` where the struct is zeroed, matching the
  [SwitchBrew spec](https://switchbrew.org/wiki/MOD)'s *"runtime-generated module
  object, typically `.bss` base."*

## 5, một nỗ lực trong tương lai nên làm gì?

1. **Hãy mở bảng địa chỉ bảng tên.** Những cái tên nằm trong một bảng đặc
   `.rodata` region around `0x3cb087` (`sdk` memory space). A loader name table is
   thông thường cặp với một dãy song song của địa chỉ hoặc bù đắp; định vị mà mảng bởi
   finding where `_ZN2nn2os13GetSystemTickEv` is *referred to by data* rather than by
   Mật mã.
2. **Fix `nso2elf.mjs`'s MOD0/module parsing**, which currently corrupts `.symtab` for
   `sdk` while producing 113,150 names for `main` — the two cases disagreeing is a bug
   Tín hiệu đáng để truy đuổi trực tiếp.
3. ** Dùng chứng cớ độ phân giải thời gian chạy** thay vì tĩnh: bộ tải thực hiện
   tên _ địa chỉ tổ hợp, vì vậy một tiến trình được giải quyết thực sự hoặc một bản ghi tải sẽ cung cấp
   Đây là con đường trung thực cho bản đồ có khả năng xảy ra
   không tồn tại tĩnh lặng.
4. **Search for vendor symbol files** for build `972CC255…` / `F18FF3CF…`.

## 6 Những giới hạn chân thật

- **The 49 → `sdk` address mapping remains unknown.** This document explains why, and
  không tự cho là đã sản xuất ra nó.
- ** Đọc PLT bị tắt từ sáu hướng dẫn được giải mã** và phù hợp với
  người biếng nhác kết hợp mô hình; không được xác nhận chống lại người gánh nặng thực hiện.
- **The `.dynamic` dump is anomalous and unexplained.** It may be a real Switch
  biến thể, hoặc một sản phẩm của phần của tôi xử lý; điều đó không được xác định.
- **The name table's address side was not found**, so "`sdk` provides this API" rests
  ngày các tên đã có và không được tham khảo, cộng với độ phân giải PLT theo tên — hai
  quan sát nhất quán, chứ không phải bằng chứng trực tiếp.
