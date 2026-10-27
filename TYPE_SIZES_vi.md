# Cỡ kiểu SDK, được kiểm tra chống lại hệ nhị phân

Why this exists: the platform layer in `port/` needs storage for the SDK's opaque types
(`MutexType`, `SemaphoreType`, `ThreadType`, `MessageQueueType`). Those sizes are not
được xuất bản trong bất kỳ kho chứa nào có ở đây, vì vậy ban đầu chúng là phỏng đoán chủ thể.
Tài liệu này thay thế các dự đoán với bằng chứng, và các bang rõ ràng kích thước là
**Đã bị bắt cóc**, cái mà bị giới hạn**, và cái nào không thể chấp nhận được**.

---

## Phương pháp

Trò chơi phân phát kho lưu trữ cho những loại này bên trong các đối tượng riêng của nó và đi qua địa chỉ
to the API, e.g. `nn::os::LockMutex((MutexType *)(this + 0x348))`. Two kinds of evidence
Sau đó:

1. **Các đo lường diện tích (mạnh).** Khi một cuộc gọi đi qua cả hai loại và một
   Phía bên cạnh của cùng một đối tượng, châu thổ giữa các bù đắp của họ là một ràng buộc khó khăn:
   `sizeof(T) <= delta`.
2. **Adjacent-global khoảng cách (weak).** Hai toàn cầu được gửi qua địa chỉ lân cận
   gợi ý một bước, nhưng biểu tượng được ký hiệu độc lập có thể trùng hợp.
   ứng cử viên, không bao giờ như một thước đo.

Một trường hợp thứ ba quan trọng: gõ các **SDK** phân bổ cho trò chơi là không bao giờ
Thực hành trực tiếp bằng mã trò chơi, do đó, kích thước của chúng không được hiển thị từ các địa điểm cuộc gọi này.

---

## Measured: `MessageQueueType` ≤ 0x48 (72 bytes)

Bốn địa điểm được gọi riêng biệt đi qua hàng đợi và bộ đệm được hỗ trợ như anh em đồng đạo
đối tượng **same**:

```
InitializeMessageQueue((MessageQueueType *)(this + 0x1f8), (ulong *)(this + 0x240), 0x20)
InitializeMessageQueue((MessageQueueType *)(this + 0x60),  (ulong *)(this + 0xa8),  0x20)
InitializeMessageQueue((MessageQueueType *)(this + 0x18),  (ulong *)(this + 0x60),  0x20)
InitializeMessageQueue((MessageQueueType *)(this + 0x168), (ulong *)(this + 0x1b0), 0x21)
```

|hiệu số hàng đợi|Khoảng cách bộ đệm|Delta|Số lượng|đệm byte|
|---|---:|---:|---:|---:|
|0x1f8|0x240|**0x48**|0x20|0x100|
|0x60|0xa8|**0x48**|0x20|0x100|
|0x18|0x60|**0x48**|0x20|0x100|
|0x168|0x1b0|**0x48**|0x21|0x108|

** Cả bốn đều đồng ý trên 0x48.** Bởi vì bộ đệm là một trường anh em, vùng hàng đợi
không thể vượt quá 0x48 — đó là một sự đo lường, chứ không phải một sự suy luận.

Số lượng là một thời gian chạy thay vì một phần của loại: hai địa điểm đi qua 0x20 và một
chuyển qua 0x21, với 8- byte khe, do đó, bộ đệm là 0x100 hoặc 0x108 byte khác nhau.

## Bounded: `MutexType` ≤ 0x20 (candidate)

Hai toàn cầu được khởi động 0x20 cách nhau:

```
InitializeMutex((MutexType *)&DAT_71036580b8, true, 0)
InitializeMutex((MutexType *)&DAT_71036580d8, true, 0)
```

`0x71036580d8 − 0x71036580b8 = 0x20`.

**Cái này yếu hơn vẻ ngoài, và sự khác biệt quan trọng.** Cả hai địa chỉ đều ở
`.bss`, so they are **distinct symbols** rather than proven elements of one array. Two
Độc lập 8-byte-aigned toàn cầu cũng có thể hạ cánh 0x20 cách nhau.
a distance of `0x402b0` away, which is **not** divisible by 0x20, 0x28 or 0x18 — so the
Ba là không yếu tố của một mảng chung, phù hợp với các phân biệt toàn cầu.

A `.bss` object also has **no bytes in the file**, which is why an attempt to dump them
trở về rỗng: chúng không đầy đủ, không được cất giữ.

** Kết luận: 0x20 là một kích thước hợp lý, không phải đo lường.** Nó được ghi lại như là
`MutexType` upper-bound candidate with that caveat attached.

### Hậu quả là cảng bị giới hạn một cách trung thực

`sizeof(std::recursive_mutex)` on x86-64 Linux is **48 bytes**, so the host backing store
for a recursive mutex cannot fit in a reconstructed 0x20-byte `MutexType`. The build
enforces this with a `static_assert` rather than letting it silently overflow.

Điều này là chấp nhận được ** cho cảng này và chỉ cho cổng**, và lý do là cụ thể:

- At every observed call site the game allocates the `MutexType` as a **single field**
  (`this + 0x348`, `(this + 0x20)`, …), never as an array element whose stride the SDK
  phải biết.
- The SDK therefore never needs to compute `sizeof(MutexType)`; it only dereferences a
  Cung cấp chỉ điểm trò chơi.

Vì vậy, một máy struct lớn hơn của SDK là an toàn ở đây - nhưng nó là ** không phải là ABIP-A tương ứng**,
Và nó sẽ phá vỡ nếu bất kỳ mã nào đi qua một mảng của những thứ này.
chứ không phải là bóng đèn.

## Consistent but unbounded: `SemaphoreType` at `this + 0x20`

Four call sites, all `(SemaphoreType *)(this + 0x20)`:

```
InitializeSemaphore((SemaphoreType *)(this + 0x20), param_1, param_2)
```

Khoảng cách là *stable*, mà xác nhận một lĩnh vực duy nhất xác định rõ ràng, nhưng không có sau
Trường anh em xuất hiện trong bằng chứng — vì vậy **no kích thước bị ràng buộc** có thể bắt nguồn từ những cuộc gọi này
Trang web. một smaphore xử lý thường là một con trỏ, và máy chủ chỉ cần đủ
lưu trữ của riêng mình nguyên thủy.

## Unobservable: `ThreadType`

Three of four `SetThreadCoreMask` sites dereference a **pointer** field:

```c
nn::os::SetThreadCoreMask(*(ThreadType **)(this + 0xe0), -1, (ulong)uVar1);
nn::os::SetThreadCoreMask(*(ThreadType **)(this + 0xd0), -1, (ulong)uVar1);
nn::os::SetThreadCoreMask((ThreadType *)(this + 8), param_1, param_2 & 0xffffffff);  // inline
```

`ThreadType` is created by `CreateThread`, i.e. **the SDK allocates it on the game's
behalf**. Only one site passes inline storage (`this + 8`), which gives no upper bound
Kích thước của nó là một chi tiết của SDK và là ** không thể nhìn thấy** từ bằng chứng này.

Bởi vì trò chơi chỉ giữ nó bằng bút chì và không bao giờ đọc lĩnh vực của nó trong quan sát
Mật mã, tất cả các máy dự trữ là đủ, đầu đạn dự trữ rộng rãi và nói như vậy.

---

## Tóm tắt

|Kiểu|Bằng chứng|Yêu cầu kích cỡ|Tự tin|
|---|---|---|---|
| `MessageQueueType` |4 Anh em Delta, tất cả 0x48|** vội vàng 0x48**|**Đã an toàn**|
| `MutexType` | 2 `.bss` globals 0x20 apart |0x20 ứng cử viên|yếu — không phải một dãy|
| `SemaphoreType` |4 địa điểm, bù đắp ổn định, không anh em|Chưa đóng gói|không có|
| `ThreadType` |SDK-lacated, được tổ chức bởi con trỏ|Không thể bắt chước được|không có|

---

## Kiểm tra chéo cấu trúc chéo: bố trí máy không phải là di động

Cánh cảng được xây dựng và toàn bộ hệ thống hợp đồng của nó chạy trên **2 kiến trúc sư**:

|Kiến trúc|Kết quả|
|---|---|
|x86-64 (mặc định)|Kiểm tra 111, 0 thất bại|
| **aarch64** (`aarch64-linux-gnu-g++` + `qemu-aarch64`) |**11 Kiểm tra, 0 thất bại**|

**Arch64 xây dựng ngay lập tức bắt gặp một khuyết điểm thực sự mà x86-64 không thể.**
Tình trạng máy semaphore được đo:

|Kiến trúc| `sizeof(SemaphoreState)` |
|---|---:|
|x86-64|**96 byte**|
|arc64|**104 byte**|

A `static_assert` sized against x86-64 passed there and **failed on AArch64**. The
Nguyên nhân cơ bản là cổng đã tích trữ các máy chủ trạng thái * ở trong vị trí * bên trong các
Kiểu SDK có thể nhìn thấy được, vì vậy kích thước bộ đệm phụ thuộc vào máy ABI.

** Sửa chữa làm cho bố trí ABI-in phụ thuộc:** loại SDK có thể thấy bây giờ giữ một
**Spointer** đến nhà nước chủ, được phân bổ trên đống rác, nó hiệu quả vì SDK chỉ bao giờ thôi
Nhận một điểm * để gọi là lưu trữ - nó không bao giờ cần phải biết nhà nước máy
size. The same change would apply to `MutexType` were its host type to grow.

**Đây là lập luận cụ thể cho việc kiểm tra thẩm định chéo trong dự án này.** A
Không xác nhận được một kiến trúc nào và chế độ thất bại
is silent memory corruption rather than a compile error, except where a `static_assert`
xảy ra để bắt nó.

### Tạo lại

```bash
sudo apt install -y g++-aarch64-linux-gnu    # qemu-aarch64 was already present
bash tools/wsl/wsl-aarch64-run.sh            # cross-compile + run under qemu
```

## What this changes in `port/`

1. `MessageQueueType` storage is set to **0x48**, from measurement, not guess.
2. `MutexType` carries the 0x20 candidate and the explicit note that the host backing
   Cửa hàng lớn hơn, với lý do an toàn ở đây.
3. `ThreadType` and `SemaphoreType` document that their sizes are unverified, and why
   Đó không phải là hiện tại bị chặn.

## Giới hạn

- **`MutexType`'s true size is not established.** The 0x20 spacing is suggestive only.
  Cài đặt nó sẽ cần một địa điểm để trò chơi đi qua một dãy các tARF/symbol
  dữ liệu, cả hai đều không hiện diện.
- ** Không có kích cỡ kiểu nào được kiểm tra chống lại đầu trang của nhà cung cấp**, vì ở đây không có cái nào.
- **`MessageQueueType`'s 0x48 is an upper bound**, not necessarily the exact size — the
  bộ đệm có thể bắt đầu sau một khoảng trống nhỏ thẳng hàng.
