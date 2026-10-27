# Đang tháo gỡ sự phân hủy thật

**Status: đã giải quyết và kiểm tra.** RRA ổ đĩa Ghidra về mục tiêu này, và **real
Các cơ quan chức năng bị phân hủy đã được tìm thấy** từ mô-đun chuyển đổi Nintendo.

---

## 0 Xác định: một cơ quan chức năng thực tế

`rtld` — the 13 KB runtime loader from the same ExeFS — went through the whole
Đường ống dẫn, kết thúc trong phân hủy C:

|Step|Kết quả|
|---|---|
| hactool decompressed `rtld` NSO | 4 sections, build id `F6824124…` |
| `nso2elf.mjs` rebuilt it as ELF64 AArch64 |30.088 byte, 5 đầu chương trình|
| `validate-elf.mjs` structural check |**VALID — không gặp vấn đề về cấu trúc nào cả**|
| `rea inspect --provider ghidra` | exit 0, format `elf`, arch `arm64`, **`procedure_count: 56`** |
| **`rea decompile 0x1000 --provider ghidra`** | **exit 0, 22,578 bytes, `operation: procedure_pseudo_code`** |
|Nạp lại|**9.433 ký tự của Ghidra decomled C**|

Kết quả là đúng, chứ không phải một cái cọc — nó tự nhận mình là người tải và chứa
luồng điều khiển thực sự:

```c
void FUN_00000de0(long param_1, uint param_2)
{
  ...
  pcVar3 = DAT_000053a8;
  uVar4 = *(ulong *)(param_1 + 0x88);
  uVar13 = *(ulong *)(param_1 + 0x90);
  if (uVar13 < uVar4 >> 4) {
    ...
    do {
      lVar11 = *(long *)(param_1 + 0x18);
      uVar8 = *(ulong *)(lVar11 + lVar15 + 8);
      iVar7 = (int)uVar8;
      if ((iVar7 - 0x101U < 2) || (iVar7 == 0x401)) {
        ...
        uVar4 = FUN_00000c5c(param_1, &local_68, local_98);
        if ((uVar4 & 1) == 0) {
          if (*pcVar3 != '\0') {
            lVar11 = *(long *)(param_1 + 0x60) + uVar8;
            uVar5 = FUN_00001704("[rtld] warning: unresolved symbol = '");
            FUN_000014e4("[rtld] warning: unresolved symbol = '", uVar5);
```

That string — `[rtld] warning: unresolved symbol = '` — is `rtld` describing its own
Công việc. ** Đây là một chức năng chuyển đổi Nintendo bị lỗi.**

Evidence: `ev_73f0bc75bc81621242ef102c41fafab8e4e9ff40f719a1d013385462d4189b5b`,
provider `ghidra 12.1.2`.

### Một cuộc tranh cãi quan trọng

`rea decompile <path> 0x0` **fails**, and the message explains why:

> *"File offset 0x0 maps to analysis address `_elfHeader:0x0`, but no procedure starts
> tại địa chỉ đó."

`0x0` is the ELF header in the reconstructed image, not code. The first real code
address is **`0x1000`**. That single detail was the difference between two failed
nỗ lực và một sự phân hủy thành công.

---

## Thứ nhất, thứ đã bị chặn, và tại sao

Trên các cửa sổ, bộ thích nghi Ghidra từ chối mục tiêu này một cách hoàn toàn:

```
code: target_format_unsupported
"Windows Ghidra P0 accepts native x86 and x86-64 PE applications and DLLs,
 and explicitly selected raw 6502 images"
```

Both an ELF and a headerless `--architecture arm64` attempt were rejected. That
Giới hạn là ** Cửa sổ đặc biệt**, và đó là lý do tại sao mỗi phân tích trước đó trong này
Kho lưu trữ được viết bằng tay ARM64.

## Sửa chữa: chạy REA trên Linux, qua WSL

Cỗ máy này đã có **WSL2 với Ubuntu**. đó là đủ, và nó cần **no root
password** — Node and a JDK install entirely under `$HOME` from prebuilt tarballs.

|Thành phần|Phiên bản / đường dẫn|
|---|---|
|Máy| `ubuntu 26.04` (WSL2, x86_64) |
|Nút| v24.22.0 at `~/tools/node` |
|JCK| Temurin 21.0.12.1 at `~/tools/jdk21` |
|REA| `rea-agents@6.5.0`, prefix `~/.npm-global` |
|Ghidra| the **existing Windows install**, reused via `/mnt/c` |

Hai chi tiết làm cho điều này rẻ tiền:

1. ** Cửa sổ Ghidra cài đặt có thể tái sử dụng là** — nó đã có tàu
   `Ghidra/Features/Decompiler/os/linux_x86_64/` beside `win_x86_64`, so no second
   Chúng ta cần phải tải về từ lâu.
2. **No `sudo`.** `apt` is not required; Node and the JDK are prebuilt tarballs.

`rea doctor` on Linux passes every check, including `ghidra-java` — which on Windows
Chỉ được thông qua dưới hộp cát leo lên:

```
host                      ok=True   ubuntu 26.04
ghidra-platform           ok=True   linux
ghidra-architecture       ok=True   x64
ghidra-version            ok=True   12.1.2; compatible 12.1.x release
ghidra-headless           ok=True
ghidra-native_decompiler  ok=True
ghidra-java               ok=True   21.0.12.1; 64-bit; JDK; ~/tools/jdk21
provider ghidra: configured=True available=True version=12.1.2
```

RA sau đó tự khởi động đầu không đầu riêng của mình Ghidra trên một ổ cắm unix
(`transport: unix-socket`), and the target is accepted.

## 3. `main` specifically: a timeout, not a wall

The 21 MB `main` did not finish within REA's budget:

```
code: provider_timeout   retryable: true   timeout_ms: 330000
```

Đó là ngân sách phân tích công nghiệp **anasis đối với 113, 150 chức năng**. Tính khả thi là
proven by `rtld`; `main` is simply too large for a per-request budget.

**An uncapped pre-analysis of `main` is running** on the Linux side
(`tools/wsl/wsl-preanalyze.sh`), copying the input into the Linux filesystem first to
avoid `/mnt/c` I/O, and writing an inventory via `ExportInventory.py` when it
Hoàn thành, không có thời hạn hoàn chỉnh theo thiết kế.

## 4. Bước tiếp theo, theo thứ tự trả tiền mong đợi

1. **Let the uncapped `main` pre-analysis finish**, then reuse the saved project
   Thay vì trả phí phân tích cho mỗi yêu cầu.
2. **Install Changeler bên Linux Ghidra** và điểm RRA tại *
   NSO*. That yields **named** functions (`Game::PlayerInkAction::shotBullet_B`)
   instead of `FUN_00000de0`. This is the single highest-value improvement — the
   nhị phân mang 113, 150 tên thật và ELF được tái tạo không có tên nào.
3. **Copy the Ghidra install into the Linux filesystem** to avoid slow `/mnt/c` I/O.
4. **Work at `rtld`/`subsdk1` scale meanwhile** — `rtld` works now; `subsdk1` is 67 KB.

## Tại sao chuyện này lại quan trọng với kho bạc?

Tất cả mọi thứ trước khi nó đến từ ARM64 viết tay--
`arm64-callgraph.mjs`, `boot-closure.mjs`, `layout-disasm.mjs`, `vt-by-content.mjs`.
Đó là cần thiết bởi vì không có kẻ phá hoại nào có thể được lái xe, và nó hiệu quả: đóng cửa,
tất cả đều được thiết lập từ byte sống.

It is also why those results carry the caveats they do — no function bodies, `BLR`
Mục tiêu vô hình, không thể vi-rút. **A làm việc thất bại loại bỏ tất cả
những người cùng một lúc**, và điều đó bây giờ được thể hiện chứ không phải hy vọng.

## 6, tái sản xuất

```bash
# from an elevated Windows shell
wsl -d Ubuntu -- bash /mnt/c/Users/Hexa/Documents/nintendo/re-work/wsl-install-node.sh
wsl -d Ubuntu -- bash /mnt/c/Users/Hexa/Documents/nintendo/re-work/wsl-install-jdk.sh
wsl -d Ubuntu -- bash /mnt/c/Users/Hexa/Documents/nintendo/re-work/wsl-probe-rea.sh
wsl -d Ubuntu -- bash /mnt/c/Users/Hexa/Documents/nintendo/re-work/wsl-verify-small.sh
wsl -d Ubuntu -- bash /mnt/c/Users/Hexa/Documents/nintendo/re-work/wsl-get-body.sh
```

Scripts are committed under `tools/wsl/`.

## 7, giới hạn trung thực

- **`main` has no function bodies yet.** Only `rtld` does, and the uncapped run's
  Kết quả không rõ ràng.
- **One function was decompiled** (`FUN_00000de0`). That proves the pipeline; it does
  không phải khảo sát mô-đun.
- **The symbols are unnamed** (`FUN_*`) because this is a *reconstructed* ELF with no
  Bàn biểu tượng. Đọc trực tiếp NSO gốc cần bộ chuyển mã trên Linux
  Bên Ghidra, vẫn chưa được cài đặt.
- Ngân sách 330 s của **Không được xác nhận là có thể cấu hình.**
- **The Windows headless run of `main` was still progressing** when last checked and
  có thể hoàn thành độc lập.
