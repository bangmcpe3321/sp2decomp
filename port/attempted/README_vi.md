# Attempted: `sead::AssertConfig::registerCallback` (0x7101397fac)

**Status: đã cố gắng, không hòa giải, chưa được cố tình xây dựng.** Ba tập tin ở đây là
kept as evidence of what was tried, with `.attempted` appended so no build picks them up.

---

## Tại sao nó đã được cố gắng

Nó là quan hệ phụ thuộc chưa được báo cáo ** người chạy giày thất bại đạt được
(`docs/ENGINE_RECONSTRUCTION.md` §5), so porting it is what advances the reconstruction
bước 2.

Cơ thể bị phân hủy của nó là 160 byte và được đọc đầy đủ không giống như hầu hết các chức năng động cơ,
**Cấp lệch rõ ràng** — Không cần phải suy ra bố trí từ nơi gọi:

|Truy cập|Nghĩa là|
|---|---|
| `slot + 0x20` | `ListNode` — the slot's link in the subscriber list |
| `slot + 0x38` |Con trỏ được cất giữ như là kết nối|
| `slot + 0x68` |cờ đã kết nối, đặt thành 1 sau khi đăng ký|
| `*(int *)(lVar2 + 0x10)` |đếm tham khảo, giảm dần khi ngắt kết nối|
| `event + 0x08` |Đầu danh sách người đăng ký|
| `event + 0x18` |Số người đăng ký|

Dòng chảy kiểm soát cũng là không thể nhầm lẫn: một * điều chỉnh * ngắt kết nối được bảo vệ bởi
cờ kết nối, sau đó là cờ * vô điều kiện* thứ hai ngắt kết nối vào toàn cục
`sAssertEvent`, increment its count, and set the flag.

## Chuyện gì đã xảy ra?

** Trường kết nối không phải là mô hình sạch sẽ.** Cơ thể có:

```c
lVar2 = *(long *)(param_1 + 0x38);          // read the "connection"
*(param_1 + 0x38) = PTR_sAssertEvent + 8;   // store the EVENT's list head there
...
*(int *)(lVar2 + 0x10) += -1;               // decrement a refcount THROUGH it
```

Vì vậy, cùng một lĩnh vực giữ một đối tượng kết nối hoặc một con trỏ vào sự kiện,
Tùy vào nhánh nào — và một số liệu được viết lại bằng cách nào đó.
means the field is really a pointer to some base subobject whose `+0x10` is a refcount,
Từ cả sự kiện lẫn kết nối đều có thể liên lạc được.

Mô hình nó cũng cần thiết:

- a shared base class, which **shifts the event's own `+0x08`/`+0x18` offsets** and broke
  the `static_assert`s for the event layout; or
- casting through `void *`, which compiled but asserted a relationship between two
  Những loại không liên quan mà tôi không thể bào chữa cho bằng chứng.

**No decompiled caller exists** for `registerCallback`, so there is no usage evidence to
Chỉ đọc sai thôi thì không giải quyết được vấn đề.

## What the `static_assert`s did

Họ là lý do tại sao cái này bị bắt chứ không phải được vận chuyển.
Các bù đắp bị phân hủy được thực hiện tại thời điểm biên dịch, do đó, mỗi mô hình lỗi thất bại
xây dựng thay vì âm thầm làm hỏng bộ nhớ:

```
error: static assertion failed: slot connected flag must sit at +0x68
error: static assertion failed: slot connection must sit at +0x38
error: static assertion failed: event list head must sit at +0x08
error: static assertion failed: event count must sit at +0x18
```

Đó là cơ chế hoạt động như dự định.

## Tính lương thiện

Chuỗi khởi động **sit still tuyên bố phụ thuộc này còn thiếu**, do đó, người chạy dừng lại ở đây và
Báo cáo nó. đó là trạng thái chính xác: một cổng mà bố trí của nó không được sửa chữa còn tệ hơn một
Xác nhận khoảng trống, vì nó sẽ cho phép chuỗi tiến lên trên hành vi mà có thể là sai.

`docs/ENGINE_RECONSTRUCTION.md` §5 records it as not ported.

## Điều gì sẽ giải quyết nó?

1. **A decompiled caller.** Any code that constructs a `DelegateEvent::Slot` would show
   Làm thế nào trường kết nối có dân số và nó thực sự đánh dấu tại.
2. **`sead::DelegateEventConnection`'s definition from a reference.** `open-ead/sead` is
   checked out at `~/refs/sead` and may define the delegate types; matching its layout
   chống lại những bù đắp này sẽ giải quyết sự mơ hồ.
3. **`sAssertEvent`'s contents.** It is in `.bss` (target `0x3698490`, beyond EOF), so it
   is not readable from the file — the same limitation recorded for `MutexType` in
   `docs/TYPE_SIZES.md`.

Lưu ý rằng tùy chọn 2 là rẻ nhất và đã không được thử nghiệm trước khi cổng đã được thử; đó là
Thứ tự gọi là một sai lầm, vì tài liệu tham khảo đã có trên đĩa rồi.
