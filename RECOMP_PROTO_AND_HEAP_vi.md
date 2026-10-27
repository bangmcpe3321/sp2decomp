# Tháng Ba-17 pito, NPDM, và nơi mà đống thực sự đến từ

Vòng theo sau mục tiêu: các nguyên tố gốc NPS đã được chiết xuất, NPDM đọc, và một **pripted sửa chữa** đã được áp dụng.
Việc sửa chữa đã không ** tháo móc treo cổ — được ghi lại là kết quả tiêu cực.

---

## Một.

`Splatoon 2 - Proto March - Repacked.nsp` (5.9 GB) → program NCA → **ExeFS**, cleanly. The NSP was already
Giải mã, nên không cần chìa khóa tiêu đề.

| | **Proto** `01003BC000027000` | **Retail** `01003BC0000A0000` |
|---|---|---|
|phiên bản NPDM SDK| **0.12.17.0** |(không in)|
| `main` | **25,962,984** | 23,717,627 |
| `sdk` | 3,031,640 | 3,032,664 |
| `subsdk0` | 787,508 |787.508 giống hệt|
| `subsdk1` | 67,846 | 67,223 |
| `subsdk2` | **7,456** | **49,096** |
| `subsdk3` | 49,096 | 174,009 |
| `subsdk4` | 174,009 | — |
| `subsdk9` | 74,408 | — |

** Môđun số thay đổi, không chỉ mở rộng:**

- **proto `subsdk3` (49,096) == retail `subsdk2` (49,096)** — exact match
- **proto `subsdk4` (174,009) == retail `subsdk3` (174,009)** — exact match
- proto has an extra **7,456-byte `subsdk2`** that retail dropped, plus a **`subsdk9`** with no retail counterpart.

**Consequence cho dự án này:** Bảng mô-đun của cổng và nhiệm vụ cơ bản là **retail- cụ thể**, và
chứ không phải chi tiết.

## 2. nhắc lại, không giải quyết được vấn đề SDK

`sdk` is within 1 KB of retail's. Both are the same `nnos*` era. **The five silent Wonder-vs-Splatoon-2
mismatches (`g_fast[4]`, module stride, `kDtInit`, `init_status`, the allocator) all still apply.**

**Những gì proto * dot* cung cấp** được nhìn thấy trong tập tin lPS phù thủy của nó: một **debug xây dựng** với
`DbgSetting`, scene redirection (`UICheck::Scene`, `UdgwTest::Scene`, `GearUnsetupTest::Scene`), map loading
(`[+] Load map`, `[-] FreeTest`) and test modes (`Mission (Test)`, `VS (Test)`). That is a **much better
Tắt mục tiêu** còn hơn là cửa hàng bán lẻ màn hình trước — **once** tĩnh trong nó hoàn thành, mà nó không.

## 3. NPDM nói với chúng tôi một cái gì đó hữu ích

Reading `main.npdm` shows **`svcSetHeapSize` (SVC 0x01) is in the app's allowed SVC list**, alongside
`svcExitProcess`, `svcGetCurrentProcessorNumber`, `svcWaitProcessWideKeyAtomic` and
`svcSignalProcessWideKey`.

**Đó là cơ chế thực sự mà trò chơi có được bộ nhớ**, và nó chỉnh lại công việc của Alloctor
earlier rounds: `nn::init::InitializeAllocator(buf, size)` is not meant to be handed an arbitrary buffer —
on hardware it receives **the heap the kernel returned from `svcSetHeapSize`**, which lives at **`kHeapBase`
trong không gian địa chỉ khách.

## 4, 2 thước đo

**`svcSetHeapSize` is never called.** With `NX_TRACE=1` over a full run:

```
svc 0x1  (SetHeapSize)   :  0 calls
svc 0x1d (SignalProcWideKey): 49
svc 0x29                 :  8
svc 0x6                  :  2
svc 0xc                  :  1
```

Zero. The SDK startup that would call it is exactly what this port bypasses by entering at `nnosInitialize`
→ `nnMain`.

**The runtime *does* implement it correctly** (`kernel.cpp:429`): it commits at `kHeapBase`, enforces
`kHeapMax`, and returns `kHeapBase` in `x1`.

**Và máy gây mê được cài đặt tay của chúng tôi đã đi qua một địa chỉ HOST:**

```
installing game allocator: buf=0x798ca0e62010 size=0x20000000 via main+dda018
```

`0x798ca0e62010` is a 47-bit **host** pointer — **far outside the guest's `0x71xxxxxxx` range**.

## 5 lần sửa chữa và kết quả thành thật

`install_game_allocator` now places the heap at **`nx::kHeapBase` (guest space)** and commits it through the
Lớp nền tảng, tương ứng với những gì hạt nhân sẽ làm:

```
installing game allocator at kHeapBase: 0x5000000000 size 0x20000000 (guest space)
```

**Result: the hang is unchanged.** Still `main init[1367]`,
`nn::nex::PseudoGlobalVariable<StreamSettings>`, exit 124.

**Vì vậy, địa điểm chồng chất không phải là nguyên nhân.** Đó là một kết quả tiêu cực sạch, và sự thay đổi được giữ bởi vì
Nó là ** Chính xác** — hiện nay con trỏ khách sống ở nơi khách mong đợi — chứ không phải vì nó đã sửa chữa mọi thứ.

## 6, điều này chứng minh gì?

|Mục|Tình trạng|
|---|---|
|Name|Có — đã giải mã xong**|
|Phiên bản SDK| ✅ **0.12.17.0** |
|Name|đờn bà, người lớn, người lớn, người lớn, người lớn, người lớn, người lớn, người lớn, người lớn, người lớn, người lớn, người lớn, người lớn, người lớn tuổi, người lớn, người lớn, người lớn, người lớn, người đàn ông, người đàn ông, người đàn ông, người đàn ông, người đàn ông, người đàn ông, người đàn ông, người đàn ông, người đàn ông, người đàn ông, người đàn ông, người đàn ông, người đàn ông, người đàn bà, người đàn bà, người đàn bà, người đàn ông, người đàn bà, người đàn bà, người đàn bà, người đàn bà, người đàn bà, người đàn bà, người đàn bà, người đàn ông, người đàn ông, người đàn ông, người đàn ông, người đàn ông, người đàn bà, người đàn bà, người đàn bà, người đàn bà, người đàn ông, người đàn ông, người đàn ông, người đàn ông, người đàn ông, người đàn ông, người đàn ông, người đàn ông, người đàn ông, người đàn ông, người đàn ông.|
|Sửa đổi:|teppi82@ gmail. com|
|đều là người thay thế|**no — bàn mô-đun khác**|
| `svcSetHeapSize` in allowed SVCs |▪ Đọc từ NPDM|
| `svcSetHeapSize` called by the game |**0 lần**|
|Allocator cũ dùng địa chỉ máy| ✅ **confirmed `0x798ca0e62010`** |
|Giờ đây trong không gian khách|♪ **done**|
|Cái này đã sửa cái móc treo cổ.|♪ **no**|

## 7 Những gì điều này không xác minh

- ** Bản sao không bao giờ được sửa chữa hay chạy.** Chỉ có NSOs của nó được chiết xuất và tập tin được đọc.
- ** Đồ thị tĩnh-nit của proto không được so sánh với của bán lẻ** — dù nó có ít hơn hay nhiều
  `PseudoGlobalVariable` registrations is unknown, and that is the number that matters.
- **The proto's `main` was not checked for `nnosInitialize` / `nn::init` symbols.**
- **`main.npdm.modded` was not diffed against `main.npdm`** — someone already changed it, and what they
  Không ai biết sự thay đổi.
- Việc treo cổ không thay đổi và vẫn chưa giải thích được.
- **`nnMain` still not reached.** No NVN, no window. **This is not a booted game.**

## 8 Thêm vào

**Compare the two static-init graphs.** Decompress the proto's `main` and `sdk`, generate their tables, and
compare the **count and identity of `PseudoGlobalVariable` registrations** against retail's 62.

- **Nếu nguyên liệu ít hơn**, nó sẽ là mục tiêu tốt hơn và đáng giá hơn.
- **Nếu nó đăng ký cùng một bộ**, proto không mua gì cho con bọ này và lợi thế duy nhất của nó là gỡ lỗi
  thực đơn — mà chỉ có thể truy cập sau khi tĩnh init.

Đó là một sự so sánh có giới hạn, cơ khí, và nó quyết định liệu giá trị của một cảng hay không.
