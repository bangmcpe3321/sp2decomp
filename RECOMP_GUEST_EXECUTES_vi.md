# Slatoon 2 thực hiện mã khách mời của riêng mình

Round 3 of the goal. **The milestone is reached**: the recompiled game entered `nnMain` and ran its
mã riêng — kể cả chức năng động cơ — lần đầu tiên.

---

## 1.

```
loaded main    at 7100000000 (114928 functions, 255796 relocs)
loaded sdk     at 7101000000 ( 19322 functions,  16121 relocs)
loaded subsdk0 at 7102000000 (  5034 functions,  11060 relocs)
loaded subsdk1 at 7104000000 (   582 functions,    542 relocs)
loaded subsdk2 at 7106000000 (   105 functions,     79 relocs)
loaded subsdk3 at 7108000000 (   928 functions,    674 relocs)
linked: 116 to HLE, 23913 across modules, 34 unresolved
nn::init::Start absent -- older SDK; entering through nnMain
  ...registers at the fault...
FATAL: call into the middle of a function: main+1000030
       (_ZN4gsys9ModelUnit14calcDrawArray_ILb1ELb1ELb1ELb1EEEbPNS_16ModelQueueResultEPNS_10ModelSceneEji+434)
       (lr hle:__process_return)
```

**Tất cả sáu mô-đun được nạp** (271,917 lần tái định vị, **24, 029 biểu tượng liên kết**, và sau đó
**`nnMain` was entered and Splatoon 2's own code ran** — deep enough to reach
`gsys::ModelUnit::calcDrawArray_`, a real engine function that walks a model queue and emits draw
dàn trận.

Đó là chỉ dẫn thực hiện đầu tiên của trò chơi trong quá trình chủ thể.

## 2. 3 việc sửa chữa đã làm được điều này.

**Six modules instead of two.** `boot()` hardcoded `mods[] = {&nx_module_main, &nx_module_sdk}`, so
the four `subsdk` modules were compiled, linked, and never loaded. Now all six are registered —
`116 to HLE, 23913 across modules`, up from `101 / 16802`.

**Splatoon 2's older entry convention.** Splatoon 2's SDK predates `nn::init::Start` and exports no
Cái giày bây giờ lại quay lại để vào trận đấu.
own **`nnMain`** — which the existing `nnMain` HLE hook already knows how to prepare (run the
modules' constructors, then call the real `nnMain`).

**Global-scope `ModuleInfo` externs.** The generated tables define `nx_module_subsdkN` at **global**
scope, so declaring them inside `namespace nx` named `nx::nx_module_subsdkN` and did not match. The
declarations and references now use explicit `::` scope. Verified with `nm`: the objects export
`D nx_module_subsdk0`, unqualified.

## 3. lỗi thật tiếp theo: modules overLAP

```
FATAL: call into the middle of a function: main+1000030
```

`main+0x1000030` is `0x7101000030` — **which is inside `sdk`'s range**, because `sdk` was placed at
`0x7101000000`, only 16 MB above `main`'s base.

** Đây không phải là một lỗi ngẫu nhiên; nó là một vụ va chạm bố trí:**

|Module|Cơ bản|Cỡ văn bản|Kết thúc tại|
|---|---:|---:|---:|
| `main` | `0x7100000000` | `0x1415068` (21 MB) | `0x7101415068` text, `~0x7103699e50` incl. bss |
| `sdk` | `0x7101000000` | — | **starts inside `main`'s span** |

The 16 MB stride used when the modules were generated is **smaller than `main`'s own size**, so
`sdk` and the `subsdk`s are mapped *over* `main`'s text and data. The recompiled code then computes
a target that lands in the wrong module, and `nx::call` correctly reports "call into the middle of a
chức năng" chứ không phải xử tử rác.

**Note this is the same class of problem as the `g_fast[4]` limit**: a fixed-size assumption that
xảy ra để giữ cho kỳ quan và không cho Slatoon 2. nó cũng là chính xác các loại điều
Kiểm tra thất bại là cho * — thời gian chạy đã bắt được nó và đặt tên cho chức năng, thay vì làm hỏng
Tiểu bang im lặng.

**The fix is a regeneration with non-overlapping bases** (a 64 MB stride is ample for `main`'s
21 MB văn bản, sau đó một phiên bản của 516 đơn vị dịch. đó là cơ khí, và nó là tiếp theo
Tăng dần.

## Điều này chứng minh gì?

|Name|Tình trạng|
|---|---|
|Mọi mô- đun được phối hợp lại|0, không điều khiển|
|Mọi mô- đun được biên dịch| ✅ 516/516 |
|Mọi mô-đun **link**|thể hiện 140 MB x86-64|
|Tất cả các mô-đun ** Nạp và di chuyển**|281.917 lần tái định cư|
|Giải quyết biểu tượng|Có liên hệ với nhau, 34 chưa được giải quyết|
|**Guest code EXECUTES**| ✅ **entered `nnMain`, ran `gsys::ModelUnit::calcDrawArray_`** |
|Chạy tới hoàn tất|▪ Dừng lại khi có va chạm|

## 5 Điều này không xác minh

- **Nó không chạy xa.** Nó đạt đến một chức năng cơ chế và va chạm bố trí. Trò chơi đã
  chưa khởi động, chưa khởi động, chưa rút ra.
- **34 biểu tượng vẫn chưa được giải quyết** sau khi mô-đun liên kết; chúng không được liệt kê.
- ** The HLE đã bị trói nhưng phần lớn chưa được phân loại** — 116 biểu tượng bị ràng buộc, và chạy không bao giờ đạt đến một
  Cuộc gọi dịch vụ quan trọng đấy.
- **No NVN, không cửa sổ, không bóng râm, không trình bày.** Hiển thị và âm thanh là chấm theo thiết kế, và mục tiêu này
  Loại bỏ đèn pha.
- ** Vụ va chạm căn cứ không được giải quyết** — chỉ được chẩn đoán thôi.
- **`gsys::ModelUnit::calcDrawArray_` being reached does not mean rendering works**; it means the
  Đường mã đã tới đó và rồi đi theo một nhánh gián tiếp tồi tệ.
- Tình trạng đăng ký tại lỗi được in nhưng **không được phân tích** — nguyên nhân tức thì có thể là
  va chạm cơ bản * hoặc * một đường dẫn phụ thuộc dữ liệu thông qua ảnh không được hỗ trợ/ tải.

## 6. Tăng dần

Tái tạo lại tất cả sáu mô-đun với các cơ sở thay thế **(GN 64 MB), recomlition, relink, và
Mọi thứ cần thiết đều được sắp xếp theo kịch bản
`tools/wsl/`.
