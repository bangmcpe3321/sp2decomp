# The hang is located: `main`'s constructor #1367

Vòng 10, vòng 9 là "còn chạy" ở 180 s. Chạy cho **10 phút** và vị trí là
**Thỉnh thoảng** — do đó nó không chậm chạp, nó là ** Hong**, và treo cổ nằm chính xác.

---

## Một. đo lường

|Thời gian| `main` constructors |Dòng cuối|
|---:|---:|---|
|180 s (khoảng 9)| 1,368 | `main init[1367]` |
|**600 s (khoảng 10)**| **1,368** | **`main init[1367]`** |

```
exit: 124  (still running at the 600s timeout)
lines: 1495
  sdk  init[N]: 74
  main init[N]: 1368
...
main init[1367] +0xd5a238 -> main+d5a238
    (_ZN2nn3nex20PseudoGlobalVariableINS0_14StreamSettingsEEC2Ev+3cc)
```

**Ten phút sản xuất không có xây dựng thêm.** Việc chạy trốn bị kẹt bên trong **1367**.

## 2. Chính xác vị trí.

```
nn::nex::PseudoGlobalVariable<nn::nex::StreamSettings>::PseudoGlobalVariable()   at +0x3cc
```

`nn::nex` is Nintendo's networking library. `PseudoGlobalVariable` is a lazy-initialisation wrapper.
The constructor never returns — the `call_preserving` for `init[1367]` was entered and did not come
lùi lại.

** Ba nguyên nhân hợp lý**, chưa được thử nghiệm:

1. **A spin-wait on a lock** that will never be released — very likely, given `nex` is threaded
   Mật mã mạng và HLE không thực sự cung cấp dịch vụ cho nó.
2. **Một sợi chỉ nối với** trên một sợi chỉ không bao giờ kết thúc.
3. **Một vòng lặp không giới hạn** trong mã tái sử dụng , e.g. đang chờ đáp ứng dịch vụ.

## 3. Tại sao đây là một kết quả tốt, không phải là một xấu

Quá trình vượt qua mười vòng đã được từ "sai" đến "loctated" :

|Tròn|Thất bại|Ký tự|
|---:|---|---|
| 3 | `nn::init::Start` not found |một điểm nhập bị thiếu|
| 5 | `sdk+30 (_init+c)` |Hiệu số được mã hoá sai|
| 6 | `nn::os::LockMutex` SIGSEGV |Tìm thấy bởi một bộ quản lý lỗi|
| 8 |74 người xây dựng đã âm thầm bỏ qua|hội nghị địa vị sai|
| 9 | `nn::nex::WaterMark` null `this` |thiếu Allocator|
| **10** |** Chung sống trong xây dựng #1367**|**Đã phân loại thành một chức năng**|

**Mỗi một trong những điều này bây giờ là một chức năng được đặt tên, không phải một thất bại vô danh.** Cổng đã đi từ
"cannot link" to "executes 1,368 of `main`'s static constructors and hangs inside a specific one".

## 4 hiệp này là gì?

|Mục|Tình trạng|
|---|---|
|Round-9 "còn chạy"|Đó là một cuộc treo cổ, chứ không phải sự chậm chạp.|
|Giữ vị trí| ✅ **`nn::nex::PseudoGlobalVariable<StreamSettings>` ctor, `main+d5a238+0x3cc`** |
| `sdk` constructors complete | ✅ **74 / 74** |
| `main` constructors |**1.367 hoàn tất, bám vào #1,367 (trên 0)**|
| `nnMain` reached |♪ **no**|

## 5 Điều này không xác minh

- ** Nguyên nhân của vụ treo cổ không được xác định** — spin-wang, tham gia, hoặc vòng thời gian đều mở.
- **`main`'s total constructor count is unknown**, so how far #1367 is through the list is unknown.
- **`nnMain` has still not been reached.**
- ** Việc treo cổ không bị cắt ngang** — không phải chó canh, vì vậy quá trình này phải bị giết bởi thời gian chờ đợi.
- **Không có người xây dựng cá nhân nào được kiểm tra** bên ngoài bản ghi của nó.
- **The allocator buffer is still a fixed 64 MB**, and `nex` allocates heavily; exhaustion is an
  Chưa được thử nghiệm lời giải thích thay thế cho quầy hàng.
- **Không NVN, không cửa sổ, không bóng râm, không trình bày.** Hiển thị và âm thanh là các chấm.
- **Đây không phải là một trò chơi khởi động.** Nó là một quá trình tồn tại 1.367 máy tạo tĩnh và treo lên
  tiếp theo.

## 6. Tăng dần

Phân biệt "chờ đợi" từ " chuỵên": chạy với một phân tích mẫu hoặc thêm một con chó xem mà đổ
guest `pc`/`lr` for the hung thread after N seconds of no progress. The fault handler already proves
rằng việc đặt tên hàm số là điều làm cho các vấn đề dễ giải quyết — cùng một kỹ thuật được áp dụng cho a
Còn hơn đặt tên vòng thời gian hoặc sự chờ đợi.
