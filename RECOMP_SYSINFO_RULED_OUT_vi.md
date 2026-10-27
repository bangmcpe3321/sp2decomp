# `system_resource_size` is ruled out — the zero comes from elsewhere

The obvious suspect for `HeapMgr::initialize(0)` was `game::kInfo.system_resource_size`, which sits at `0x0`
in `game_sp2.cpp` and is returned verbatim by `svcGetInfo` type 16. **Logging every `svcGetInfo` call shows the
Trò chơi không bao giờ yêu cầu loại 16. Kẻ tình nghi đó bị loại bỏ.

---

## 1. Every `svcGetInfo` call in the run

The log instrumentation (added to `get_info`, `svc_process.cpp`) captured **ten** calls — the whole set for a
Hoàn toàn chạy đến lỗi:

|Kiểu|Con trượt| `get_info` returns |
|---:|---:|---|
| 11 | `0x2` | `RandomEntropy` (`0x1234567890ABCDEF ^ sub`) |
| 11 | `0x3` |Tương tự|
| 12 | `0x0` | `kAddressSpaceBase` |
| 12 | `0x0` |Tương tự|
| 13 | `0x0` | `kAddressSpaceSize` |
| 14 | `0x0` | `kStackBase` |
| 14 | `0x0` |Tương tự|
| 15 | `0x0` | `kStackSize` |
| **7** | `0x0` | `heap_size() + 0x4000000` |
| **6** | `0x0` | `0xCD500000` |

**No type 16. No type 4. No type 5.** The `system_resource_size` theory is dead.

## 2. Trò chơi thực sự đòi hỏi những gì

Mẫu — ** Mã số không gian / kích thước (12/13), chồng kích thước cơ số / kích cỡ (14/15), rồi chất đống kích cỡ ( 7) và tổng bộ nhớ
(6)** — is the shape of a **memory-layout probe**, which is what `sead` does when it is working out where it
Nó không phải là một câu hỏi đơn giản "bao nhiêu lớn rễ cây của tôi nên lớn".

**So the zero passed to `HeapMgr::initialize` is computed from these values, or from something else entirely** —
và chưa được biết đến.

## 3. Tại sao việc sửa chữa rõ ràng là sai lầm?

Had I "fixed" this by setting `system_resource_size` to a large number, **nothing would have changed** — the
Trò chơi không bao giờ đọc loại 16. Viết rằng giá trị trong sẽ là một chỉnh sửa hợp lý mà âm thầm đã làm
Không có gì, và vòng tiếp theo sẽ được dành cho thắc mắc tại sao.

**Cái giá phải trả cho việc xây dựng lại; dự đoán sẽ phải tốn một vòng.**

## Điều này chứng minh gì?

|Mục|Tình trạng|
|---|---|
| `svcGetInfo` fully logged |**10 cuộc gọi, tất cả các loại bị bắt**|
| Type 16 (`SystemResourceSizeTotal`) queried |♪ Đừng bao giờ ♪|
| `system_resource_size` as the cause |[Tiếng cười]|
| Type 7 (`heap_size() + 0x4000000`) queried |♪ Phải, phải, ♪ ♪ Hãy quay lại ♪ ♪ 0x24000, không phải 0 ♪|
| Type 6 (`TotalMemoryAvailable`) queried | ✅ yes — returns `0xCD500000` |
|Kiểu 4 / 5 (cơ số / tối đa) đã yêu cầu|Không bao giờ|
|Nguồn của số không|♪ Vẫn chưa biết ♪|

## 5 Điều này không xác minh

- **Where `HeapMgr::initialize`'s zero comes from is not determined.** It is not any of the ten queried
  `svcGetInfo` types as far as this evidence goes, but the *computation* those feed was not traced.
- **The caller of `HeapMgr::initialize` was not identified.** Finding it — one breakpoint with a host
  vết lùi — sẽ cho thấy chính xác giá trị của nó trước khi gọi, và đó là câu trả lời trực tiếp.
- **`HeapMgr::initialize` with a non-zero size was not called** to test whether it fixes the fault.
- **The game is not booted** — it faults in `GameFrameworkNx::initialize`.
- **Không có gì được trình bày.** Không có NVN, không có cửa sổ, không có đèn pha. ** Đây không phải là một trò chơi có thể chơi.**

## 6. Tăng dần

**Break on `HeapMgr::initialize` and take a host backtrace, then read the caller's argument.** The size is in
`x0` at entry and is zero; the caller just computed it. Disassembling the few instructions before the call
Trang web hiển thị bộ sưu tập nào đến từ và tải nào tạo ra nó — đó là liên kết bị thiếu, và nó là một
Bám chặt vào.

Điều này là trực tiếp hơn tiếp để tiếp tục lý thuyết về mà giá trị bộ nhớ cung cấp cho nó.
