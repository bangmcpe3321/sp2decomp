# Thứ tự cổng động cơ khởi động

Danh sách mục tiêu tái tạo, bắt nguồn từ cơ thể của người chủ khởi động hơn
than from the 126-function closure in arbitrary order. `Lp::Sys::SysInit::Init`
(`0x71011f5b20`, 1308 bytes) is the entry point; the engine functions it calls are
được liệt kê theo thứ tự xuất hiện **, đó là thứ tự phải dựng động cơ lên.

Source: `main-decompiled.txt`, the Ghidra body of the boot root.

---

## Quan hệ phụ thuộc với máy (13)

| # |Hàm|lần đầu tiên thấy tại dòng|
|---:|---|---:|
| 1 | `Lp::Sys::SysInit::Init` | 9 |
| 2 | `Utl::dumpDateTime` | 56 |
| 3 | `sead::AssertConfig::registerCallback` | 61 |
| 4 | `sead::Framework::InitializeArg::InitializeArg` | 64 |
| 5 | `sead::GameFrameworkNx::initialize` | 68 |
| 6 | `Utl::dumpMemoryInfo` | 69 |
| 7 | `sead::ForegroundBucketMgr::initialize` | 71 |
| 8 | `HeapGroup::createInstance` | 78 |
| 9 | `HeapGroup::createHeap` | 82 |
| 10 | `Framework::Framework` | 119 |
| 11 | `sead::GameFrameworkNx::initializeGraphicsSystem` | 126 |
| 12 | `sead::TaskBase::MgrTaskArg::MgrTaskArg` | 171 |
| 13 | `sead::Framework::RunArg::RunArg` | 175 |

---

## Chuyển vào Rác / Nơi gửi ảnh được (10)

Đây là những thứ không thể giải quyết được** — mục tiêu được tải từ khe có thể xoay.
They are where `sead::`'s virtual interfaces must match the binary's vtable layout,
Và đó là lý do tại sao đã tồn tại.

- slot `0x10` — `(**(code **)(*plVar16 + 0x10))(plVar16);`
- slot `0x20` — `iVar7 = (**(code **)(*plVar16 + 0x20))(plVar16);`
- slot `0x38` — `puVar11 = (undefined4 *)(**(code **)(*plVar16 + 0x38))(plVar16);`
- slot `0x40` — `puVar9 = (undefined8 *)(**(code **)(*plVar16 + 0x40))(plVar16);`
- slot `0x18` — `(**(code **)(*plVar16 + 0x18))(plVar16,&local_138);`
- slot `0x28` — `(**(code **)(*plVar12 + 0x28))(plVar12);`
- slot `0x28` — `(**(code **)(*plVar12 + 0x28))(plVar12);`
- slot `0x28` — `(**(code **)(*plVar16 + 0x28))(plVar16);`
- slot `0x20` — `local_148._0_4_ = (**(code **)(*plVar16 + 0x20))(plVar16);`
- slot `0x28` — `(**(code **)(*(long *)this + 0x28))(this,*(undefined8 *)(lVar18 + 0x128),&local_138,&local_148);`

---

## Các cuộc gọi nền tảng đã thỏa mãn (3)

These are handled by the reconstructed platform layer in `port/`.

- `nn::os::GetSystemTick`
- `nn::os::QueryMemoryInfo`
- `nn::nifm::Initialize`

---

## Cách sử dụng cái này

1. Làm việc xuống danh sách động cơ theo thứ tự. Một hàm không thể được gửi trước những cái được
   Nó phụ thuộc vào, và thứ tự hiện ra đầu tiên xấp xỉ thứ tự phụ thuộc bởi vì
   gốc khởi động xây dựng mọi thứ trước khi sử dụng chúng.
2. For each `sead::` entry, check `open-ead/sead` first — it is the most mature
   Hãy tham khảo (252 ngôi sao) và bao gồm khung, chồng chất, chỉ, gfx.
3. Ghi lại mỗi quan hệ phụ thuộc đã được thỏa mãn tới** chứ không phải là lén lút:
   Các bộ phận nên thất bại lớn tiếng tại chức năng động cơ bị mất đầu tiên, đó là
   Cách nhanh nhất để khám phá ra trật tự cảng thật sự.

## Giới hạn

- ** Đây là chỉ người chủ khởi động.** Các chức năng khởi động còn lại 125 và các
  Động cơ rộng hơn (113.000 chức năng) không được đại diện ở đây.
- ** Thứ tự hiện hữu đầu tiên là thám hiểm**, không phải đồ thị phụ thuộc. cuộc gọi tĩnh
  Thứ tự có thể khác với thứ tự thời gian nơi các chi nhánh sắp xếp lại công việc.
- ** văn bản được gửi đi là mơ màng.** Khoảng một phần ba các cuộc gọi của người chủ khởi động đi qua
  các khe gián tiếp, vì vậy danh sách ở trên nhấn chìm các tiểu bang đặt phụ thuộc thật.
