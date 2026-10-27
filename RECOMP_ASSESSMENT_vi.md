# `BelmanteGu/SuperMarioWonderRecomp` — strategic assessment

A **sitic recompation** of Super Mario Bros. Wonder (Sped, 1. 0) to local C++, chạy trên
Vulkan. sử dụng. **MIT giấy phép.** Được cấp phép bởi vì nó có vẻ giải quyết — với
mật mã hoạt động — hai vấn đề mà cảng này đã mắc kẹt.

Nội dung của nó được xem như dữ liệu tham khảo, không phải hướng dẫn.

---

## 1.Nó độc lập xác nhận phát hiện NVN của cảng này

Their `docs/NVN.md` "Where to cut" section, on the NVN boundary:

> "The NVN boundary is clean: the SDK exports one entry point, `nvnBootstrapLoader` … The game asks
> it for `nvnDeviceGetProcAddress` and gets every other function as a pointer **by name**, the same
> shape as `vkGetInstanceProcAddr`. We register `nvnBootstrapLoader` as HLE and hand out our own
> chức năng. "

**This matches `NVN_DEVICE_CREATION.md` exactly** — including that NVN is resolved **by name**
through `nvnBootstrapLoader`, which this port arrived at independently and only after three failed
Hai nỗ lực không liên quan đến nhau làm tăng thêm sự tự tin vào cả hai.

Cũng xác nhận: **"Engines lớp trên cùng (n: gfx, Nintendo của riêng mình) ở lại phục hồi mã khách và
need nothing."** That independently answers `NNGFX_LAYER.md`'s open question about `nn::gfx`.

## 2. Kiến trúc của họ trả lời cho thiết bị chặn cổng này.

|Cổng này là câu hỏi|Câu trả lời|
|---|---|
|Ai đã tạo ra thiết bị NVN?| "We register `nvnBootstrapLoader` as HLE and hand out our own functions" |
|NVN thực hiện những gì?| "the `nvn*` functions, over Vulkan" — **chosen over** emulating nvhost+Maxwell |
|Bề mặt NVN lớn cỡ nào?|"~ hàng trăm chức năng để đảo ngược" — phù hợp với các tiêu chuẩn của cổng này được đo lường **453**|
|Các vật thể NVN cỡ nào?|"Các công cụ được kích thích bởi trò chơi ở kích thước thực sự của trình điều khiển**"|
|GPU thấy bộ nhớ bể bơi như thế nào?| `VK_EXT_external_memory_host` imports the guest pool itself; no copy |
|Thế còn đèn pha Maxwell thì sao?|**12.717 dãy nhà** được dịch sang SPIR-V **nhead of time** với phiên dịch MIT của Ryujinx|

Cách tiếp cận sự sáng tạo thiết bị là cùng bốn bước mà cổng này được định vị, và họ có nó ** hiệu quả**.

## 3. phát hiện thực sự: máy tính của họ ở trong kho, và MIT.

```
recomp/  __main__.py 5.5KB   analysis.py 13.6KB   nso.py 5.4KB   ehframe.py 4.1KB
         emit.py 23KB   emit_ext.py 12.2KB   emit_fp.py 9.9KB   emit_int.py 15.6KB
         emit_neon.py 14.1KB   emit_neon_wide.py 15.3KB   emit_vldst.py 3.9KB
         stats.py 1.7KB
```

An **AArch64 → C++ static recompiler in Python, MIT licensed**, plus `nso.py` for NSO parsing —
Cùng thùng hàng này đã được tách ra bằng tay kể từ vòng đầu tiên.

Con số của họ, từ bản dịch readME: **17.8M hướng dẫn Aarch64, 250k chức năng, ~1.4 GB của sự tạo ra
C++**, recompiled in **about 6 minutes and 2.4 GB of RAM** for `main`.

Sử dụng, nguyên văn từ cho đến khi họ đọc:

```sh
python -m recomp private/wonder/exefs/main private/wonder/gen/main --name main --base 0x4000000000
```

**Note the `--base` flag.** Their base is `0x4000000000`; this port's `main` has image base
`0x7100000000`. The tool is parameterised for exactly that difference.

## Và NVN-over-Vulkan thời gian chạy là MIT quá

```
runtime/src/nvn/  — 58 files, ~1.0 MB of source
  nvn_device.cpp  3.4KB     <- device creation: this port's blocker
  nvn.h          22.1KB     <- the API surface
  nvn_objects.cpp 34KB   nvn_pipeline.cpp 37.9KB   nvn_present.cpp 37.7KB
  nvn_draw.cpp 31.8KB    nvn_sets.cpp 34.7KB       nvn_frames.cpp 34.7KB
  nvn_tiling.cpp 8.7KB   nvn_format.cpp 9.9KB      nvn_shaders.cpp 12.5KB
  nvn_astc.cpp 18.7KB    nvn_bc.cpp 13.1KB         nvn_vk.cpp 35.2KB
```

Licence verified: **MIT** (`Copyright (c) 2026 BelmanteGu`). This is the **opposite** of
`imgui-nvn` (GPL-2.0) — this code **can legally be studied and reused**, subject to attribution.

## 5. Sự so sánh chiến lược trung thực

Người dùng chọn **recyction** (tự phục hồi) trong vòng trước đó, trước khi này
Sự so sánh bây giờ là thực nghiệm, chứ không phải suy đoán:

| |Cổng này (được tái tạo bằng tay)|Ngạc nhiên ( luân phiên)|
|---|---|---|
|Thời gian trôi qua|**12 viên đạn**|(không biết, nhưng một trò chơi hoàn chỉnh)|
|Quản lý chức năng cơ chế| **~10** | **250,000** |
|Name|Dừng lại ở bước 11**|** đầy đủ khung vòng, 60 fps**|
|Thiết bị NVN|**Không được tạo ra**|làm việc|
|Đồ họa|tổng số + giới hạn hiển thị|tiêu đề, thực đơn, bản đồ thế giới, khóa học 11|
|Bóng râm|chưa khởi động|**12,717 dãy nhà SPIR-V**|
|Nền|Bộ khai thác x86-64 + arc64|MacOS, Windows, Ando|
|Giấy phép| — |**MIT**|

** Phương pháp hướng dẫn sử dụng đã được xác minh, có sự hiểu biết đầy đủ và khoảng mười chức năng
trong vòng mười hai vòng.** Cách tiếp cận tái phối hợp đã tạo ra một trò chơi có thể chơi, và nó là
MIT và tái sử dụng.

**Đây không phải là những ước tính cạnh tranh của cùng một kế hoạch mà là một kế hoạch và một kế hoạch có
chưa tạo một thiết bị.**

## 6, công việc của cảng này vẫn còn giá trị.

Không phải là không có gì, và tôi nên chính xác hơn là tự giải thích:

- **Các nền tảng lớp** (51 nhập khẩu, 6 dãy phòng, kiểm tra chéo cấu trúc) là một công việc
  `nn::*` HLE — the same layer Wonder's `runtime/` provides. Independent, tested.
- **`NVN_BOOT_SUBSET.md`'s 30-of-453 measurement** is a real result and is consistent with their
  "...hàng trăm chức năng".
- **`HEAP_INTERFACE.md`'s 27-entry vtable, `HEAP_LAYER_SCOPE.md`'s two-namespace finding, and the
  four `static_assert`-caught layout errors** are findings that would help anyone doing this work,
  Bao gồm cả người sử dụng máy khử rung tim của họ.
- ** Kỷ lục thất bại** — ba người giải mã lỗi, hai người tự sửa chữa — là một sự trung thực khác thường
  Lời tường thuật về những điều không hiệu quả.

**Nhưng không có cái nào trong số đó đang trên đường đến một trò chơi khởi động**, và người tổng hợp là.

## 7 lựa chọn thực sự.

**A. Adopt the recompiler.** Clone their MIT `recomp/`, point it at Splatoon 2's `main` and `sdk`
with base `0x7100000000`, and generate C++. This is the single highest-leverage action available.
Risk: `--base` and NSO quirks; Splatoon 2's SDK differs from Wonder's.

**B. Reuse their NVN runtime.** Port `runtime/src/nvn/` (MIT) as the NVN-over-Vulkan layer, and
giữ nền của cổng này. Trả lời bộ chặn mà không cần viết lại. Nguy hiểm: mã NVN của họ
Giả sử mã khách gọi lại; giao diện sẽ cần phải thích nghi.

**C. Continue manual reconstruction.** Keep going on `initializeGraphicsSystem`'s four
Các bước tạo thiết bị, phù hợp với 12 vòng làm việc, và ít phá vỡ nhất, nhưng
Bằng chứng ở trên nói rằng đó là con đường chậm nhất để chạy trò chơi bởi một nhân tố rất lớn.

** Đề nghị của tôi: A, sau đó B.** Nhận nuôi recomiler không bỏ công việc của cảng này —
Lớp nền tảng, các đo lường và kỷ lục thất bại tất cả vẫn còn hữu ích, và recomiler
Tạo ra lớp động cơ mà tái tạo bằng tay sẽ không bao giờ hoàn thành.

**Tôi nên nêu ra so sánh này trước vòng 12**, khi câu hỏi recomiler là
sẵn sàng. Người dùng đã chọn tái tạo khi lựa chọn chỉ là một đối số hợp lệ;
giờ nó là trò chơi hoạt động.

## 8 Giới hạn của đánh giá này

- **No code was cloned or run.** The assessment is from the README, `docs/NVN.md`, the MIT
  `LICENSE`, and two GitHub directory listings. **The recompiler was not executed, and I have not
  đọc một dòng nguồn riêng lẻ của nó.
- **SPlatoon 2 không tương thích được thỏa mãn.** Tự hỏi là một trò chơi với một phiên bản SDK; Slaptoon 2 là
  Già hơn và từ một SDK khác. không có gì ở đây thiết lập recomiler làm việc trên nó.
- **The `SwitchGamesRecomp` shared runtime was not examined.**
- ** Các tập tin ghi chú của họ đã bị mất giữa máy** và một số kịch bản ban đầu bị mất.
- **Sự giúp đỡ của họ tiết lộ sự hỗ trợ nặng nề của AI.** Đó là sự tiết lộ của họ, không phải một khám phá; nó có.
  Không ảnh hưởng đến giấy phép hay tính ứng dụng, nhưng nó là một phần của việc đọc thành thật.
- ** Không có mã số nào được thông báo và không có kết luận nào về sự đúng đắn của cổng này thay đổi.** Người chạy khởi động
  Vẫn dừng ở bước 11.
