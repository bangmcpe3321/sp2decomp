# Bộ con của NVN thực sự đạt được

`GRAPHICS_NVN.md` and `HEAP_INTERFACE.md`'s sibling documents established that NVN is **453
functions**, resolved by name in `nvnLoadCProcs` (`0x7100ddd6e4`). This document answers the
Câu hỏi đó làm cho 433 người có thể kéo dài: ** trong số họ, người nào là người mang đồ họa lên đường
thực sự chạm vào?

> **CORRED — 30 người là một người chậm chạp, không phải toàn bộ sự sắp đặt mang về.** Một cơ thể mang thai thứ tư
> được tìm thấy sau khi tài liệu này được viết:
> `nn::gfx::detail::DeviceImpl<4,8>::Initialize` (`0x710135d8d8`, 192 bytes) reaches
> `nvnDeviceBuilderSetDefaults`, `nvnDeviceBuilderSetFlags` and **`nvnDeviceInitialize`** — none
> Trong số đó có trong 30, nên bộ mang về là ** ít nhất 33** phương pháp bên dưới (tính
> Giới thiệu toàn cầu trong cơ thể bị phân hủy âm thanh; danh sách thông tin không đầy đủ**, và điều này
> tài liệu không nói rõ ràng như vậy.
> [DVICE_IMPL_INTER. md] (DVICE_IMPL_IPITTER.Md) ♪3.

**Answer: 30 trong số 433 — 6.6% — từ ba thi thể được quét bên dưới (xem sự sửa chữa bên trên).
Và 93.4% chưa bị đụng chạm được tập trung ở một nơi chính xác:
Vẽ.

---

## 1, phương pháp

NVN không được gọi thông qua một con trỏ bảng theo nghĩa của cổng — các cuộc gọi nhị phân được giải quyết
chức năng qua tên toàn cục:
`PTR_pfnc_nvnDeviceGetInteger_7102fc8800`, and so on. Counting the **distinct referenced
Toàn cầu** qua các cơ thể mang về do đó cung cấp cho một thực sự đạt, không phải một ước tính.

Ba thi thể đã được quét, và mỗi tên tìm thấy được kiểm tra chéo với 453 tên được đo
bề mặt:

|Thân|Địa chỉ|Tài liệu tham chiếu NVN toàn cầu|
|---|---|---:|
| `sead::GraphicsNvn::GraphicsNvn` | `0x7100e70d54` | 1 |
| `sead::GraphicsNvn::initializeImpl` | `0x7100e70e1c` | 8 |
| `sead::GameFrameworkNx::initializeGraphicsSystem` | `0x7100e6738c` | 27 |
|**union**| | **30** |

**Zero tên đã được tìm thấy mà không có từ bề mặt 453** — hai bên độc lập
Các cuộc giải cứu đồng ý, đó là một cuộc kiểm tra chéo hữu ích cho cả hai.

## 2. 30 chức năng, trong ba nhóm

**Device (5)** — `nvnDeviceBuilderSetDefaults`, `nvnDeviceBuilderSetFlags`,
`nvnDeviceInstallDebugCallback`, `nvnDeviceGetInteger`, `nvnDeviceSetWindowOriginMode`

**Queue (9)** — `nvnQueueBuilderSet{Defaults,Flags,Device,ComputeMemorySize,CommandMemorySize,ControlMemorySize}`,
`nvnQueueBuilderGetQueueMemorySize`, `nvnQueueBuilderSetQueueMemory`, `nvnQueueInitialize`

**Memory (5)** — `nvnMemoryPoolBuilderSet{Defaults,Device,Flags,Storage}`, `nvnMemoryPoolInitialize`

**Buffer (5)** — `nvnBufferBuilderSet{Device,Defaults,Storage}`, `nvnBufferInitialize`, `nvnBufferMap`

**Command (3)** — `nvnCommandBufferInitialize`, `nvnCommandBufferSetMemoryCallback`,
`nvnCommandBufferSetMemoryCallbackData`

**Pools (3)** — `nvnSamplerPoolInitialize`, `nvnTexturePoolInitialize`, `nvnSyncInitialize`

Đó là một hệ thống máy tính dùng bởi **resource-coveration; xây dựng một thiết bị, xây dựng một hàng đợi, tạo ra hồ sơ bộ nhớ, tạo ra
một bộ đệm, tạo một bộ đệm lệnh, khởi động các hồ sơ/ văn bản mẫu và một đối tượng đồng bộ.
one is a `Builder`/`Initialize` pair — the shape of setup, not of use.

## 3. Điều không đạt được — và đây là một nửa quan trọng

|Đối tượng|Đến được / tổng| |
|---|---:|---|
|Câu lệnh| 3 / 130 |Chỉ tạo ra bộ đệm lệnh, không có bộ ghi âm của nó|
|hoạ tiết| 1 / 90 |Chỉ tạo ra bể bơi, không tạo họa tiết|
|Trình lấy mẫu| 1 / 45 |Chỉ tạo ra hồ bơi|
|**Multisample**| **0 / 23** |Không chạm vào|
|**Claff**| **0 / 16** |Không chạm vào|
|**Blaend**| **0 / 15** |Không chạm vào|
|**Depth**| **0 / 13** |Không chạm vào|
|**Vertex**| **0 / 10** |Không chạm vào|
|**Polygon**| **0 / 9** |Không chạm vào|
|**color**| **0 / 7** |Không chạm vào|
|**Program**| **0 / 5** |Không chạm vào|
|**Channel**| **0 / 3** |Không chạm vào|
|Thiết bị| 5 / 25 | |
|Hàng đợi| 9 / 24 | |
|Bộ nhớ| 5 / 17 | |
|Bộ đệm| 5 / 17 | |
|Đồng bộ| 1 / 4 | |

** Mỗi chức năng vẽ và vẽ đều chưa được chạm đến.** Không có pha trộn, không có chiều sâu, không có
verex, không polygon, không màu sắc, không chương trình, không tạo kết cấu, và 127 chức năng lệnh 130.
Đường dẫn đến các phân bổ và sổ địa chỉ; nó không vẽ.

## 4. Tại sao đây là kết quả hữu ích

Nó chia công việc làm đồ họa thành hai vấn đề với kích cỡ rất khác nhau và rất khác nhau
Những lời bào chữa**:

** Mang về — 30 chức năng, tất cả các tài nguyên tạo ra.** Giới hạn, liệt kê, và mỗi cái là một
`Initialize` whose contract is visible at its call site. This is what "get a frame on screen
eventually" needs *first*, and it is the same order of magnitude as the `nn::vi` layer (6
chức năng) và lớp chất chồng, cả hai đều đã được thực hiện và kiểm tra.

** Vẽ — 433 chức năng, tất cả các dịch vụ.** Không thể tự vệ cho trò chơi thực sự và ** not
Cần thiết để đạt đến điểm mà máy đã tạo ra thiết bị, hàng đợi và bộ đệm lệnh**
- đó là bài tập "boot to menu" trước khi một tam giác được gửi đi.

**Vậy nên đọc thật lòng là đôi giày này không cần hầu hết NVN.** Nó cần 30.
menu * sau đó vẽ là một câu hỏi riêng biệt mà scan này không thể trả lời - thực đơn đang vẽ
lives in `agl`/`g3d`/`nn::ui2d`, not in the bring-up bodies scanned here, and those were not
theo dõi.

## 5 Giới hạn — được nói rõ

- **Only three bodies were scanned.** NVN calls made later, from `agl` (2,852 functions),
  `nn::g3d` (292), `nn::ui2d`, or the render loop, are NOT counted. The 30 is the **bring-up**
  Bộ con, không phải là "Tất cả các máy vi tính trò chơi từng gọi". Một trình đơn có thể sử dụng nhiều hơn.
- ** Thông điệp gián tiếp là vô hình ở đây.** Các cơ thể mang lên chứa các điểm gọi gián tiếp
  (`initializeGraphicsSystem` has 46), and any NVN function reached through one is missed. This
  là cùng một giới hạn được ghi lại cho 10 địa điểm gián tiếp của người chủ khởi động.
- ** Bản scan được tham chiếu toàn cục, không phải bằng đường thực thi.** Một tham chiếu toàn cầu trong một chi nhánh
  bộ thực hiện rất có thể **smaller**.
- **`GraphicsNvn::GraphicsNvn` showed only 1 NVN reference** (`nvnDeviceSetWindowOriginMode`),
  so the constructor is almost entirely field initialisation and three `CriticalSection`
  Những công trình xây dựng phù hợp với cơ thể của nó.
- **`nn::gfx` sits between `sead::GraphicsNvn` and NVN.** `initializeImpl` allocates a
  `nn::gfx::detail::DeviceImpl<ApiVariation<ApiType<4>, ApiVersion<8>>>` of **0x3018 bytes** and
  calls `nn::gfx::detail::Nvn::GetDeviceFeature`. So the 30 NVN functions are reached *through*
  `nn::gfx`, and **`nn::gfx`'s own 289 functions are an additional, unscanned layer.**
- **Không mã số nào được chuyển qua đường này.** Người chạy giày vẫn dừng lại ở bước 11.
