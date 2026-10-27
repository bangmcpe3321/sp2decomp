# Đang quét hệ thống phụ đồ hoạ

The boot runner stops at `sead::GameFrameworkNx::initializeGraphicsSystem`
(`0x7100e6738c`). Every dependency before it was heap, task or timing plumbing, which the port
Tài liệu này trả lời những gì hệ thống phụ đồ họa thực sự đòi hỏi — giống nhau
Qua ống kính trước khi xuất nhập cảnh trước khi làm việc.

** Headline: giới hạn nền tảng là nhỏ và chính xác có thể liệt kê. Đồ họa bên máy
Mã số lớn và một phần không tham khảo.

---

## 1, điểm vào

`initializeGraphicsSystem` is **2,372 bytes**. Its profile:

|Metric|Số lượng|
|---|---:|
|Comment| **24** |
|Nơi gửi gián tiếp| **46** |
|Địa chỉ chức năng cục bộ (không tên)| 6 |
| Named `.data`/`.bss` globals referenced | 0 |

46 địa điểm gián tiếp là số quan trọng: như số 10 trong gốc khởi động, họ không
Vẫn có thể giải quyết được, vì vậy **Một số của các quan hệ phụ thuộc thực sự đặt là vô hình ở đây.** Đó là một
Ghi lại giới hạn, chứ không phải ước tính.

## 2, chuỗi cuộc gọi, đã hồi phục.

```
sead::GameFrameworkNx::initializeGraphicsSystem(Heap*, const Vector2<float>&)
  |
  +-- nv::SetGraphicsAllocator(3 callbacks, nullptr)          <- the port's allocator hook
  +-- heap->tryAlloc(..., *(u32*)(this + 0xcc), 0x1000)       <- vtable dispatch
  +-- nv::InitializeGraphics
  +-- nn::mem::StandardAllocator::StandardAllocator
  +-- nn::vi::Initialize
  +-- nn::vi::OpenDefaultDisplay
  +-- nn::vi::CreateLayer
  +-- nn::vi::SetLayerScalingMode
  +-- nn::vi::GetDisplayVsyncEvent
  +-- nvnLoadCProcs                                            <- the NVN table
  +-- GraphicsNvn::convertNvnDebugLevel
  +-- GraphicsNvn::GraphicsNvn
  +-- Graphics::initialize
  +-- GraphicsNvn::registerQueue
  +-- DisplayBufferNvn::DisplayBufferNvn
  +-- nn::vi::GetNativeWindow
  +-- GraphicsNvn::registerDisplayBufferNvn
  +-- ThreadUtil::ConvertPrioritySeadToPlatform
  +-- Thread::setAffinity
  +-- __cxa_guard_acquire / __cxa_guard_release (function-local statics)
  +-- operator new / operator_new
```

Có hai điều có thể thấy ngay:

- **The `nn::vi` surface is six functions.** `Initialize`, `OpenDefaultDisplay`, `CreateLayer`,
  `SetLayerScalingMode`, `GetDisplayVsyncEvent`, `GetNativeWindow`. That is the entire display
  giới hạn cho cuộc gọi này — chứ không phải "Người thay đổi hiển thị API", sáu cuộc gọi.
- **`nvnLoadCProcs` appears here**, confirming `GRAPHICS_NVN.md` §2 from the call site itself:
  Điểm vào của NVN là bộ tải, và tất cả mọi thứ sau khi nó đi qua bàn trở lại.

## 3. The platform boundary: six `nn::vi` functions — verified

Searching the binary for `nn::vi` **functions** finds exactly 12 symbols, which are **6 unique
functions** appearing twice each (a local thunk in `.plt` at `0x7101413xxx` and an imported
symbol at `0x710386x000`):

|Hàm|Nhập (EXTENAL)|
|---|---|
| `nn::vi::Initialize()` | `0x710386c000` |
| `nn::vi::CreateLayer(Layer**, Display*)` | `0x710386d000` |
| `nn::vi::GetNativeWindow(void**, Layer*)` | `0x710386e000` |
| `nn::vi::OpenDefaultDisplay(Display**)` | `0x710386f000` |
| `nn::vi::SetLayerScalingMode(Layer*, ScalingMode)` | `0x7103870000` |
| `nn::vi::GetDisplayVsyncEvent(os::SystemEventType*, Display*)` | `0x7103871000` |

All six carry `EXTERNAL:` symbol-table entries, confirming they are imports resolved by a
dynamic linker by name — the same position as the 51 `nn::os`/`nn::mem`/`nn::fs` imports the
platform layer already handles. `GRAPHICS_NVN.md` §2 recorded "`nn::vi` 12 functions"; that
số đếm **symbols**, và bề mặt chức năng là **6**.

Đây là một sự gia tăng nhỏ thực sự, và nó là hình dạng giống như công việc đã làm: a
Một vài chức năng được thực hiện trên chủ thể nguyên thủy.

## 4. Hoàn cảnh tham khảo — Với một sự sửa trị

`GRAPHICS_NVN.md` and `AGL_COVERAGE.md` cite **`open-ead/nnsdk`** as providing the NVN table
implementation (`nnsdk/lib/nvn`) and the `nn::gfx` implementation (`nnsdk/lib/gfx`), described
*"1 mục nhập"* và *"289 chức năng"* aclo.

**`open-ead/nnsdk` is not cloned in this environment.** The references present under
`~/refs/` are `sead`, `agl`, `nnware` and `eui`. The repository cites `nnsdk` as a **remote
Liên kết**, không phải là một hóa đơn địa phương, vì vậy **its NVN nội dung chưa được kiểm tra trong phiên chạy này.**

Điều đó quan trọng cho kế hoạch dưới đây: tuyên bố rằng bảng NVN đã sẵn sàng thực hiện phần còn lại
trong các tài liệu trước đó mô tả một kho từ xa, không phải trên mã đã được kiểm tra.

|Lớp|Cỡ|Xác nhận có tham khảo trong phiên họp này không?|
|---|---:|---|
| `nvnLoadCProcs` → NVN table |1 điểm mục nhập| **No** — `nnsdk` is a remote link, not cloned |
| `nn::vi` |**6 chức năng**|**Có** — được liệt kê từ nhị phân ở trên|
| `nn::gfx` | 289 | **No** — same `nnsdk` dependency |
| `nn::g3d` | 292 | Headers in `nnware` (cloned); not inspected here |
| `agl` | 2,852 | `agl` cloned; not inspected here |
| `sead::GraphicsNvn` | 47 | **Header cloned** — `gfx/nin/seadGraphicsNvn.h` |
| `sead::DisplayBufferNvn` | 12 |Tiêu đề không được đặt trong thẻ này|
| `GameFrameworkNx` | 35 | Ported in part (`initialize` only) |

### What the `GraphicsNvn` header shows

`~/refs/sead/include/gfx/nin/seadGraphicsNvn.h` is present and gives the class:

```cpp
class GraphicsNvn : public Graphics {
public:
    GraphicsNvn(const CreateArg& arg);
    void initializeDrawLockContext(Heap*) override;
    void initializeImpl(Heap*) override;
    void registerQueue(NVNqueue*);
    void registerDisplayBufferNvn(DisplayBufferNvn*);
    s32 convertNvnDebugLevel(u32);
    // ... ~35 more virtual set*Impl / get* overrides
    NVNdevice* getNvnDevice() const;
private:
    NVNdevice* mNvnDevice;
    NVNtexturePool mNvnTexturePool;
    // ...
};
```

**Đây là đầu đề, không phải thực hiện.** Nó tuyên bố khoảng 40 ghi đè mà một cổng phải
write, and it includes `"nvn/nvn.h"` — a header **not present** in the cloned `sead` checkout
(`gfx/nvn/` contains only `seadDebugFontMgrNvn.h`). So the `GraphicsNvn` reference is a
khai báo bề mặt, với quan hệ phụ thuộc bị thiếu.

## 5 có ý nghĩa gì với kế hoạch?

** Công việc vẽ đồ họa chia thành hai nửa của nhân vật rất khác nhau:**

**Half A — giới hạn nền tảng/giải trí. Nhỏ, xác nhận, dễ uốn nắn.**
Six `nn::vi` functions, all imports, all with known signatures, implemented over host windowing
(one window, one swapchain). Plus `nvnLoadCProcs`: one entry point returning a table of
function pointers, which `GRAPHICS_NVN.md` §2 argues is "provide a VTable backed by Vulkan"
rather than "reimplement the Switch GPU API". `devkitPro/deko3d` is the permissively-licensed
Đề cập đến những gì bảng chứa.

**Half B — lớp đồ họa động cơ. Lớn và một phần không tham khảo.**
`sead::GraphicsNvn` (~40 overrides), `DisplayBufferNvn` (12), `nn::gfx` (289), `nn::g3d` (292),
`agl` (2,852). `agl` remains the largest single unknown, as `GRAPHICS_NVN.md` already recorded.
Only `GraphicsNvn`'s *declaration* is in hand; its implementation is not.

** Vì vậy, đọc trung thực là:** giới hạn hiển thị là một nhỏ gia tăng mà có thể được thực hiện tiếp theo
kiểu dáng giống với lớp nền tảng.
session establishes that `agl`/`g3d` are portable at acceptable cost.

## 6. Đề nghị sự gia tăng tiếp theo — và tại sao hẹp

**Port the six `nn::vi` functions plus a stub `nvnLoadCProcs` table**, then let the boot runner
advance into `initializeGraphicsSystem` and **stop at the next real gap inside it**. That is the
Phương pháp tương tự đã hiệu quả cho năm vòng cuối cùng: cổng một bị ràng buộc, kiểm tra lớp và cho phép
Thất bại khi báo cáo ranh giới tiếp theo thay vì đoán toàn bộ hình dạng phía trước.

Tùy chọn này là cố ý * không phải " xuất khẩu hệ thống con đồ họa". Cho ♪5, thử bộ vẽ
trước khi giới hạn hiển thị là các lỗi lạnh-không rõ ràng mà chi phí ba vòng trên
`registerCallback`.

## 7 Giới hạn của việc tìm kiếm này

- **`nnsdk` was not inspected.** The NVN-table and `nn::gfx` implementation claims come from
  Các tài liệu trước đó đưa ra một kho chứa từ xa; chúng không được chứng minh ở đây.
- ** 46 nơi gửi gián tiếp** có nghĩa là danh sách phụ thuộc trong ♪2 không đầy đủ bởi
  Xây dựng.
- **`DisplayBufferNvn`'s header was not located** in the cloned `sead`; its 12 functions are
  Chỉ đếm từ nhị phân.
- **`nn::g3d`, `nn::gfx`, `agl` and `nnware` were not inspected** in this pass.
- **`nvn/nvn.h` is missing** from the cloned `sead`, so the NVN type definitions that
  `GraphicsNvn` depends on are not in hand.
- **Không có mã số nào được chuyển đến.** Người chạy giày vẫn dừng lại ở bước 11.
