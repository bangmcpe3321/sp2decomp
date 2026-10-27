# Phần cứng: những gì nó cung cấp, và bức tường tôi nhấn

Mở rộng [PLATORM_LAYER_ LCORE.md] (PLATORM_LAYER_ LCORT.M). Tài liệu đó đã được thiết lập
Lớp nền tảng là ** không phải trong trò chơi shit**. điều này ghi lại các cố gắng để có được nó
thay vào đó.

** Ra khỏi: phần mềm công ty bây giờ có thể truy cập đầy đủ và chảy qua các đường ống hiện có, nhưng
its system modules are stripped, so there is no symbol-based route to identify `nn::os`.**

---

## Một, cái gì bây giờ có tác dụng

|Step|Kết quả|
|---|---|
|Name| `Firmware.23.0.0.zip`, 324.7 MB → **238 NCAs** |
|hactool **1.5.4** (đã được xây dựng sẵn)| `Master Key Revision: 0x16 (23.0.0-)` — **recognized** |
|Bundled hactool 1.4.0| failed: `Master Key Revision: 0x16 (Unknown)`, `section 0 is corrupted` |
|Chương trình NCA_BAR_Sự xuất hiện củaFS| `--exefsdir`, clean extraction |
| **`-t nso` on a firmware NSO** |♪ Giao diện giống nhau như trò chơi** — không có gì mới|
| `nso2elf.mjs` → ELF |VALID, 5 người dẫn đầu chương trình|
| `validate-elf.mjs` | `VALID — no structural problems found` |

** Toàn bộ đường ống hiện có hoạt động không thay đổi trên phần cứng.** Đó là lợi nhuận bền vững:
Thuốc chặn họng đã biến mất.

### Nhà phát minh

90 tiêu đề hệ thống được liệt kê bởi mã nhận diện tiêu đề, phiên bản SDK và kiểu nội dung — được viết cho
`fw-sweep-results.json`. The pack is mostly **SDK `23.3.0.0`** with a few older entries.

**Version drift to keep in mind:** the game's `main` was built with an older SDK than this
Phần mềm cứng, vì mục đích là để làm giảm lớp nền thay vì liên kết chống lại
nó có thể được chấp nhận — nhưng bất kỳ sự khác biệt dấu hiệu nào nên được phát hiện và
báo cáo, và ** Ở nơi nào có phần mềm và các cuộc gọi không đồng ý, các trang gọi giành chiến thắng**, bởi vì họ
là bằng chứng từ mục tiêu thực sự.

## 2. Bức tường: mô- đun hệ thống phần mềm vững chắc bị lột bỏ

Một cuộc rà soát chương trình **24 NCAs** tìm kiếm các điểm đánh dấu mà sẽ xác định được một mô-đun đang mang
lớp nền:

```
_ZN2nn2os     _ZN2nn3mem17StandardAllocator     _ZN2nn4init19InitializeAllocator
_ZN2nn2vi     InitializeMutex                   QueryMemoryInfo
```

**Result: 0 mô- đun khớp.** Mô- đun được kiểm tra chi tiết chứa chỉ **5 khác biệt
Chuỗi magled**, tất cả thuộc về chính nó:

```
_ZN2nn2ro6detail15g_pAutoLoadListE
_ZN2nn2ro6detail17g_pManualLoadListE
_ZN2nn2ro6detail14g_pRoDebugFlagE
_ZN2nn2ro6detail34g_pLookupGlobalAutoFunctionPointerE
_ZN2nn2ro6detail36g_pLookupGlobalManualFunctionPointerE
```

Those identify it as the **`ro` (loader) sysmodule** — and reveal the mechanism: the loader
exposes *global function pointers* (`g_pLookupGlobalAutoFunctionPointer`) rather than
xuất khẩu các ký hiệu có tên.

**Vì vậy, các stratware stsmodules gần như không có tên.** Phân phối một trong sẽ mang lại
`FUN_000abcde`, which is the same identification problem that stalled the earlier `sdk`
Điều tra — tôi sẽ có mật mã mà không biết chức năng nào là chức năng nào.

## 3. Tại sao "chỉ cần tìm kiếm mã" là không đủ

Behavioural markers do work as a *locator*: the `ro` module showed **9 `MRS CNTPCT_EL0`**
and **41 `SVC`**, so OS-facing code is present. But markers identify a *family*, not a
* Hàm đặc biệt* — giới hạn chính xác được ghi lại ở
[SDK_ALYTHY.md] (SDK_ALYTHY.md), nơi mà sự xác nhận dựa trên dấu chấm than với một cái giá trị byte-scan cho
Những lời mở đầu tạo ra giấy gói thay vì các chức năng đã định trước.

## 4. Một mối quan tâm sâu sắc hơn về toàn bộ cách tiếp cận

`nn::os` on Switch is substantially backed by the **kernel**: thread creation, mutexes and
most blocking primitives are kernel services reached through `SVC`. What is statically
Liên kết vào một hệ thống âm tiết có thể chỉ là vỏ bọc bên khách sạn, chứ không phải từ ngữ bên dưới.

Điều đó không nhất thiết gây tử vong — đối với một cổng PC, ranh giới là một giả định nơi
Dù sao thì sự tăng trưởng cũng thuộc về vật chủ, vì vật chủ tự cung cấp những sợi dây và những dây âm.
Có nghĩa là một thành công khai thác có thể mang lại ít hơn mong đợi, và đó là nên được thiết lập
Trước khi đầu tư thêm.

## 5. Sai lầm xảy ra dọc đường, được ghi lại để không được lặp lại.

1. **`sdk-nnos-probe.mjs` has a hardcoded `.text` size.** It reported "735,251 words
   Quét" trên một phần 3.6 MB — một hằng số cũ từ trò chơi.
   Đáng lẽ chúng ta không nên tin cậy khi lần đầu tiên đọc những sách này.
2. **`hactool --info` needs the right working directory.** The `[WARN] prod.keys does not
   exist` line looked like a key failure but was a cwd issue; the keys were valid all along.
3. **I mis-read the NSO header offsets three times** while writing `fw-exports.mjs`. The
   lesson is that `nso2elf.mjs` already parses this correctly and is the reference — the
   Phân tích độc lập là công việc không cần thiết mà tạo ra đầu ra sai lệch.

## 6. The `.dynsym` route was attempted and stopped

The last untried symbol route was to parse a sysmodule's NSO `.dynsym`. It was attempted
và ** chưa hoàn thành**, và lý do đáng để ghi âm chính xác.

**Attempted:** a standalone parser (`tools/static/nso-dynsym.mjs`) to read the NSO header,
locate MOD0, follow `DynamicOffset`, and walk `DT_SYMTAB` / `DT_STRTAB`.

** Ba lần thất bại tại bố trí đầu.** Mỗi phiên bản tạo ra trường khác nhau
Bản đồ cho cùng một byte, và MOD0 tìm kiếm trên dữ liệu zeroed:

```
=== NSO header fields 0x00..0x40 ===   (raw values, stable across attempts)
  0x10  00000100   0x14  00000000   0x18  00378758
  0x1c  00000100   0x20  00379100   0x24  00379000
  0x28  000f6f98   0x2c  00000000   0x30  00470100
  0x34  00470000   0x38  0006339c   0x3c  0007fc64
```

`MOD0` does exist — a byte scan found it at file `0x379168` — but computing that offset
Từ đầu trường là những gì tôi tiếp tục nhận được sai, và phân tích kết quả đọc
zeroed memory and found no `DT_SYMTAB`.

**The lesson, and why this stops here.** `nso2elf.mjs` **already parses this format
Chính xác**: nó đã chuyển đổi tập tin này thành một VALID ELF với bố trí phần đúng và
`367 MOD0 function symbols` on the game's `sdk`. Writing an independent parser was
Việc không cần thiết. Bước đúng là để dùng **extend các bộ chuyển đổi hiện có**, không phải để
Tăng độ logic của nó bên cạnh nó - và đó là một nhiệm vụ được ràng buộc và kính cẩn cho một
Vòng trong tương lai chứ không phải thứ gì đó để tiếp tục ứng biến.

## 7, đường còn lại, đánh giá thành thật.

|Đường|Đánh giá|
|---|---|
| **Extend `nso2elf.mjs` to emit `.dynsym`** |Bước kế tiếp. Nó đã xác định vị trí MOD0 và đi trên bảng xuất khẩu; phơi bày các biểu tượng mà nó tìm thấy là một thay đổi nhỏ để mã hóa được biết đến để hoạt động.|
|**Bowhavioation st thị + Ghidra bucker**| Worked for `main` when Ghidra supplied boundaries. Yields function *families*, not identities. |
|**Vendor tập tin biểu tượng SDK**|Sẽ giải quyết mọi chuyện trực tiếp, không có ở đây.|
|** Chạy theo dõi thời gian**|Con đường duy nhất có thể giúp bộ tải hoạt động, cần một trình giả lập và là một công việc lớn hơn nhiều.|

## Đường dưới

**Ginted:** Phần mềm công ty có thể tải về, giải mã được, có thể chiết xuất và tương thích với
Đường ống được xây dựng trước đó trong dự án này.
Đã giải quyết.

**Not gained:** identification of `nn::os` within it. The system modules are stripped, so the
symbol-based approach that named 113,150 functions in the game's `main` does not transfer —
and the `.dynsym` route that might recover names was attempted but stopped, for the reason
được ghi lại ở trên.

** Không thay đổi:** Lớp nền của cổng vẫn còn lại một sự tái tạo có hiệu lực chống lại quan sát
gọi nơi Mạng (PPLATORM_IPECEC.md) (PLATORM_IPEPEN_PEC.md), không phải là cổng của
Không có gì trong công việc này thay đổi kết luận đó.

**Những gì tôi sẽ làm khác đi:** Vào lần đầu tiên thấy rằng các trường đầu tiên không phù hợp với tôi
assumptions, the correct response was to read `nso2elf.mjs` and reuse its layout — not to
Thay đổi định dạng từ các byte sống 3 lần, bộ chuyển đổi đã hoạt động suốt thời gian đó.
