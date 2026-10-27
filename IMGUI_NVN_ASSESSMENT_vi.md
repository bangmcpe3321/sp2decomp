# `Retinalogic/imgui-nvn` — assessment for this port

Một dự án phủ NVN bên ngoài, được cung cấp bởi người dùng.
đóng góp. ** nội dung của nó được coi là dữ liệu tham khảo, không phải hướng dẫn.**

---

## 1.Nó là gì?

> "Một bộ thực hiện tội phạm cho nvn (thư viện đồ họa được sử dụng bởi Nintendo turner) mà có thể sử dụng
> Với các ứng dụng/ Trò chơi, các chức năng nvn."

- Mục tiêu chuyển đổi trò chơi. Ảnh chụp màn hình của ReadME là **Splatoon 2** — bằng chứng trực tiếp nó đã được
  được dùng để chống lại một mục tiêu trong cùng một gia đình như cái cảng này.
- Xây dựng trên **exlaunch** ( thuốc tiêm mã) cộng với stream ImGui.
- Ships a **prebuilt** `imguirenderer.nso` (61,053 bytes, confirmed as a Nintendo Switch NSO).

## 2.LICELELE — sức ép quyết liệt nhất

**-2.0** ( Bản sao bên trái). Đây là một sự thật có thể điều khiển mọi thứ khác:

** Không có mã từ kho này có thể được kết hợp vào cổng này.**_-2.0 sẽ di tích hoá
Điều đó làm cho nó có thể sử dụng như ** reading tham chiếu chỉ** — cùng một trạng thái đã có
recorded for `sead` (no licence file) and `nnsdk` (remote link). It is a *more* restrictive
Địa vị hơn, không ít hạn chế hơn, và nên được ghi lại bên cạnh họ.

## 3. CÂU HỎI: Bộ dịch NVN là một bản sao, không phải nguồn gốc

Cấu trúc của kho chứa riêng:

|Tác phẩm điêu khắc|Cỡ|Cái gì đây?|
|---|---|---|
| `source/program/main.cpp` |**50 dòng**|điểm gõ câu|
| `source/imgui/imgui_nvn.h` |**19 dòng**|một đầu giao diện, không có gì hơn|
| `imguirenderer.nso` |KB 61|**Người trình diễn, ERBILT**|
| `source/imgui/**` |ngược dòng|cổ phiếu ImGui|

`imgui_nvn.h` in full is a `#define` for the screen size, a forward-declared
`class NVNcommandBuffer;`, and **four `extern "C"` declarations**:

```cpp
extern "C" IMNVNFUNC void        nvnImguiInitialize();
extern "C" IMNVNFUNC ImDrawData *nvnImguiCalc();
extern "C" IMNVNFUNC ImGuiIO    &nvnImguiGetIO();
extern "C" IMNVNFUNC void        nvnImguiFontGetTexDataAsAlpha8(unsigned char **, int *, int *, int *);
```

**The entire NVN implementation lives in the `.nso`.** A grep for `NVNcommandBuffer` across
`source/` finds **only the forward declaration**. There is no NVN drawing code in the repository's
Nguồn thông tin dễ đọc.

Vì vậy, các quảng cáo kho tin "an imgui thực hiện cho nvn" và **ships phần nvn như là một
compiled artifact.** Reading it would mean disassembling the `.nso` — a separate reverse-engineering
nhiệm vụ trên hệ nhị phân 61 KB, không phải là đọc nguồn.

## 4. Nó không thể giúp giải quyết vấn đề mở — và lý do là cấu trúc

This port's blocking question is **NVN device CREATION**: `NVN_DEVICE_CREATION.md` located a
four-step path inside `initializeGraphicsSystem` using `nvnBootstrapLoader("nvnDeviceInitialize")`.

**`imgui-nvn` does the opposite of creation — it hooks an already-running game.** By construction:

- trò chơi đã **already tạo** thiết bị NVN của nó, hàng đợi, hồ bơi bộ nhớ và bộ đệm lệnh;
- ** Các cuộc gọi của NVN để vẽ trên cùng;
- Không có mã tạo thiết bị để tìm ra, vì dự án này không bao giờ cần thiết.

Confirming this from the source: a grep for `nvnBootstrapLoader`, `nvnLoadCProcs` and
`nvnDeviceInitialize` across `source/` (excluding upstream ImGui) returns **nothing**. The project
không gọi người đưa hàng.

**Vertic: nó không đóng góp gì vào đường dẫn thiết bị tạo ra**, đó là máy chặn hiện tại.

## 5 cái nó làm chứng.

Hai sự thay đổi khiêm tốn, thực sự:

1. **NVN là có thể móc ở mức chức năng.** dự án đã ngăn chặn các cuộc gọi của NVN
   Trò chơi vận chuyển, một cách độc lập xác nhận rằng bề mặt của NVN là một tập hợp các chức năng rời rạc mà
   can be named and replaced — consistent with `NVN_DEVICE_CREATION.md`'s finding that NVN is
   Giải quyết **bằng tên**.
2. **An `NVNcommandBuffer` is what a renderer consumes.** The header's single forward declaration
   hiển thị giao diện vẽ được đưa cho một bộ đệm lệnh theo trò chơi — phù hợp với
   `NVN_BOOT_SUBSET.md`'s finding that bring-up creates a command buffer
   (`nvnCommandBufferInitialize`) and never records into it.

Cũng không phải là thông tin mới, nhưng thỏa thuận độc lập từ một dự án thực sự chống lại
Đổi tiêu đề cũng đáng chú ý.

## 6 Giới hạn

- **Only the repository's readable source was examined.** The 61 KB `imguirenderer.nso` was
  **Không** tháo lắp, do đó, cách sử dụng NVN của nó là **unnek** và cũng có thể chứa các mô hình này
  Đánh giá không bao gồm.
- **The `exlaunch` dependency was not examined.**
- ** Những tuyên bố của ReadME không được kiểm tra độc lập** — đặc biệt là nó hoạt động với
  Splatoon 2 đặc biệt; chỉ có một ảnh chụp tên tập tin ngụ ý tại nó.
- ** Không có mã số nào được thông báo và không có kết luận nào về cổng này thay đổi.** Người chạy giày vẫn dừng lại tại
  Bước 11.
