# Thực hiện lần thứ nhất: sửa chữa Slaptoon 2 mã khách chạy trên máy

Đây là kết quả đầu tiên **xexcutable** của toàn bộ nỗ lực. Tất cả mọi thứ trước khi nó được tĩnh
Đo lường — dịch thuật, tính toán, đếm biểu tượng. Đây là lần đầu tiên tạo ra
Mật mã 2 thực sự có *run*.

---

## 1.

```
=== Splatoon 2 recompiled-code execution harness ===

guest memory mapped at 0x7100000000 (64 MB)
SP = 0x7103000000   LR = ... (return trap)
calling main_00000024 ...

    guest function returned normally (C++ return for `ret`)

--- guest state after the call ---
  SP   = 0x7103000000 (initial 0x7103000000)
  x19  = 0x0
  x8   = 0x0
  nzcv = n0 z1 c1 v0
  nx::call invocations: 0

*** GENERATED GUEST CODE EXECUTED ON THE HOST ***
```

**`main_00000024` — a real Splatoon 2 function, translated from AArch64 — executed on x86-64, ran to
Hoàn tất, và trở lại.**

## 2. tại sao đây là thực thi thực tế và không phải là không có phản ứng

Bằng chứng nằm ở trạng thái sau cuộc gọi:

|Quan sát|Nó chứng minh được gì?|
|---|---|
| `nzcv = n0 z1 c1 v0` (was `0 0 0 0`) | **the flag-setting instructions actually ran** — `nzcv` starts zeroed and is only written by `subs`/`cmp`-class ops |
| `SP` restored to `0x7103000000` | the **prologue ran** (`sub sp, sp, #0x90`) **and the epilogue ran** (`add sp, sp, #0x90`) |
| `x19` back to `0` | the epilogue **restored it from the stack** — i.e. the `stp x20,x19,[sp,#0x70]` / `ldp` pair worked, and memory access works |
| `returned normally` | the `ret` was lowered to a C++ `return` and control came back to the host correctly |

A no-op would have left `nzcv` at zero and could not have restored `SP`/`x19` through a memory
Đây là một cuộc hành hình trực tiếp.

## 3 Thiết bị này cố tình xuyên qua

Các cột mốc được định nghĩa là CPU/run thời gian chỉ, và các khai thác thực thi mà bởi ** không liên kết các
Bộ tải, HLE, NVN hoặc bất kỳ nền tảng lớp**:

- it provides its own implementations of the **six out-of-line `nx::` entry points**
  (`call`, `unimpl`, `svc`, `mrs`, `msr`, `trace_sp`) — all the rest are header-inline in
  `nx/cpu.h`;
- it maps guest memory itself with `mmap` at `0x7100000000` (`MAP_FIXED_NOREPLACE`), mirroring what
  the real loader's `commit()` does;
- one generated translation unit (`code_000.cpp`, 346 functions), linked with `--gc-sections` so
  Chỉ giữ lại những gì đã đạt được.

** Vì vậy, một thất bại ở đây chỉ có thể là các mã tạo ra hoặc mô hình CPU — và không có.**

## 4. 2 con bọ, bộ khung bị kẹt trong chính nó, cả 2 đều có thật.

**Bug 1 — wrong linkage.** The first version declared the guest function `extern "C"`. The
generated functions are **C++** (`void main_00000024(nx::CPU&)`), so they are name-mangled;
`extern "C"` left the symbol undefined, and `--unresolved-symbols=ignore-all` resolved it to
**address 0**. The harness then reported `SIGSEGV at address (nil)` with `SP` unchanged — jumping
0 trước khi có hướng dẫn nào chạy. cố định bằng cách tuyên bố nó là C++, xác nhận với
`nm -C code_000.o` showing `T main_00000024(nx::CPU&)`.

**Bug 2 — `ret` goes somewhere.** A guest `ret` is `br x30`, so `LR` must point at real memory. The
Phiên bản đầu tiên chỉ nó vào hình ảnh khách (không có) mà sẽ thực hiện số không và lỗi cố định.
with a **return trap**: `LR` points at a C function that `siglongjmp`s back into the harness,
turning "the function returned" into a clean event. (In the event, `ret` was lowered to C++
`return`, so the trap was not needed for this function — but it is needed for the indirect case,
và sự phân biệt này được ghi lại trong bộ khung.)

Cả hai đều bị bắt bởi xây dựng ** và chạy**, không phải bằng đọc — lần thứ năm trong dự án này
Thực hiện hoặc đọc nhịp phân tích tĩnh.

## 5 Điều này không xác minh

- **Nó chạy một chức năng.** 140,899 đã được dịch; **one** đã bị thực hiện.
- **No game entry point was reached.** `main_00000024` is the module's second function, called
  directly with a hand-built `CPU`. Splatoon 2 has not been started.
- **No `nx::call` occurred** in this run (`nx::call invocations: 0`), so the indirect-branch path —
  the thing `RECOMP_MODULE_LIMIT.md` is about — was **not exercised**.
- **No HLE import was invoked.** No `nn::*` service was called.
- **No NVN, không GPU, không cửa sổ, không bóng râm.** Theo thiết kế, nhưng nó không có nghĩa gì cả.
- ** Bộ nạp tải không được sử dụng**, vậy nên bản đồ mô-đun, định vị và đóng dấu hiệu đều chưa được kiểm tra.
- **Only `code_000.cpp` was compiled.** 432 other `main` units and all 83 other-module units were not.
- Trí nhớ khách mời là **0-không đầy**, không có đầy đủ với hình ảnh NSO thực sự, vì vậy bất kỳ mã lệnh đọc thực sự
  Toàn cầu sẽ thấy số 0.

## 6. Sinh sản

```
tools/wsl/wsl-setup-sp2port.sh        # stage runtime + 516 generated TUs
tools/wsl/wsl-apply-gfast-patch.sh    # the 4 -> 8 module-limit patch, with a recorded diff
tools/wsl/wsl-harness.sh              # compile one TU + the harness, link, run
```

The harness source is `harness/harness.cpp`. Total runtime: seconds.
