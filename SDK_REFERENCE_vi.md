# `sdk` reference — the filesystem service, and the limits of what it provides

> **Read this first.** This document was opened to decompile `main`'s platform layer out
> of `sdk`. **That premise is false and was falsified during the investigation.**
>
> `sdk` is the **filesystem service module** — its export table holds **233 `nn::fs`
> exports** and **zero `nn::mem` / `nn::init` / `nn::vi` / `nn::time`** exports. The
> platform layer `main` imports is **not in this dump at all**; the system provides it at
> Chạy đến giờ. xem [PLATORM_LAYER_LCORE.md] (PLATORM_LAYER_LCORE.D) để xem bằng chứng.
>
> **Những gì sau đó là do đó không phải là một đặc điểm đặc trưng của lớp nền tảng.** Mục 3
> documents 10 functions inside `sdk` that were genuinely recovered by behavioural
> Đánh dấu và phân hủy — chúng có thật, nhưng không phải là * việc thực hiện phía sau
> `main`'s imports, and none of them is named.
>
> **Để có hợp đồng nền tảng, hãy dùng [PLATORM_CALL_SBENRS.md]
> which observes how `main` calls each of the 41 platform functions it needs.

Observed contracts and decompiled bodies for functions **inside** the `sdk` module.

Tài liệu người dùng:
Dịch bởi Vũ Hạnh, Mai Linh, Nga, Ann, Yuki, Phương The Vampire3X Subteam
and is not), [PLATFORM_CALL_SITES.md](PLATFORM_CALL_SITES.md) (the contracts `main`
Gọi ngược lại, [PLATORM_REFERCE.md] (PLATORM_REFECE.d) ( 51 nhập khẩu đã tuyên bố
in `main`) and [ENGINE_REFERENCE.md](ENGINE_REFERENCE.md) (the boot-closure engine).

---

## Những gì các máy dò đã thiết lập

`main`'s platform functions are 13-byte import thunks that forward through pointers.
Bộ thăm dò không có biểu tượng định vị mã hệ điều hành bằng hành vi:

|Dấu hiệu| `main` | `sdk` |Nghĩa là|
|---|---:|---:|---|
| `MRS CNTPCT_EL0` | **0** | **33** |phản hồi vật lý — Giữ thời gian|
| `MRS MPIDR_EL1` | **0** | **2** |ID lõi|
| `SVC` | **0** | **104** |Cuộc gọi cấp trên|
| `MRS` total | **0** | 91 | |

**`main` contains no code that could implement `nn::os::GetSystemTick` — not one
counter read.** `sdk` contains 33. Scanned 5,264,410 words in `main`, 735,251 in `sdk`.

## 2. Mô- đun đã phân tích

|Step|Kết quả|
|---|---|
| hactool decompressed `sdk` | build id `972CC255…`, `.text` 0x2ce04c (2.9 MB) |
| `nso2elf.mjs` rebuilt it |ELF64 AArch64, 7.113.072 byte, 5 đầu chương trình|
| `validate-elf.mjs` |**VALID — không gặp vấn đề về cấu trúc nào cả**|
|Mục nhập MOD0| `0x28` — a real entry point, unlike `main` |
|Phân tích Ghidra chưa đóng gói (Linux/WSL)|**xit 0 in 2m51s**|
|kho|**8,267 chức năng, 65.055 ký hiệu, 17,854 chuỗi**|

**2m51s for `sdk` versus a far longer run for `main`'s 23 MB.** `sdk` is the practical
quy mô làm việc.

## 3. Giữ thời gian và thực hiện ngữ cảnh sợi

Đây là những chức năng mà Ghidra báo cáo như là sự kết hợp* các điểm đánh dấu — không
guesses. An earlier attempt scanned `.text` backwards for a prologue and
misattributed sites, because `stp x29,x30,[sp,#-N]!` also opens **secondary stack
khung** bên trong chức năng lớn hơn; một hàm "16-byte" được cho là tổ chức 104 SVC.
Giới hạn có thẩm quyền của Ghidra đã thay thế phương pháp đó.

Giải quyết các ranh giới đó, các điểm đánh dấu 139 giải quyết cho **10 chức năng**:

|Hàm|Cỡ|Nơi Mạng|Tử tế|
|---|---:|---:|---|
| `FUN_0007f4bc` |464 B| 3 | **time / counter** — reads `cntpct_el0` |
| `FUN_0007fd40` |100 B| 1 |định sẵn|
| `FUN_00080324` |312 B| 2 |con đường đọc ngược|
| `FUN_000805b8` |300 B| 2 |con đường đọc ngược|
| `FUN_0008083c` |246 B| 2 |con đường đọc ngược|
| `FUN_00080a34` |228 B| 2 |con đường đọc ngược|
| `FUN_000843cc` |692 B| 5 |Dùng đối số dày nhất|
| `FUN_000863a4` |282 B| 1 |con đường đọc ngược|
| `FUN_00086734` |284 B| 1 |con đường đọc ngược|
| `FUN_0027bc0c` |204 B| 1 | **core-id / context** — reads `tpidr_el0` |

Tất cả các kích thước là cơ thể hàm của Ghidra. không phải là một
Thump — 100 đến 692 byte.

### Đã quan sát chữ ký

```c
undefined4 FUN_0007f4bc(long param_1, long param_2)
bool       FUN_0007fd40(long param_1)
undefined8 FUN_00080324(long param_1, undefined8 param_2, long param_3)
undefined8 FUN_000805b8(long param_1, undefined8 param_2, long param_3)
undefined8 FUN_0008083c(undefined8 *param_1, long param_2, long param_3)
undefined8 FUN_00080a34(undefined8 *param_1, long param_2, long param_3)
undefined8 FUN_000863a4(undefined4 *param_1, long param_2)
undefined8 FUN_00086734(undefined4 param_1, ulong param_2, long param_3)
void       FUN_0027bc0c(/* 9 register args */)
```

### `FUN_0007f4bc` — the clearest time implementation

Hoàn toàn bị gián đoạn; đây là logic thời gian chân chính, với trạng thái bão hòa và nguyên tử:

```c
undefined4 FUN_0007f4bc(long param_1, long param_2)
{
  lVar7 = 0;
  local_38 = 0;
  if (param_2 != 0) {
    lVar5 = cntpct_el0;                              // <-- the hardware counter
    lVar6 = thunk_FUN_002bb75c(DAT_006bf0b8 + 0x368);
    lVar7 = 0x7fffffffffffffff;
    if (lVar5 + lVar6 + 1U < 0x7fffffffffffffff) {   // saturate instead of wrap
      lVar7 = lVar5 + lVar6 + 1;
    }
  }
  pcVar1 = (char *)(param_1 + 1);
  while (true) {
    while (bVar2 = *(byte *)(param_1 + 1), bVar2 < 0xfe) {
      if (bVar2 == 0) {
        while (*pcVar1 == '\0') {
          cVar3 = '\x01';
          bVar4 = (bool)ExclusiveMonitorPass(pcVar1, 0x10);   // atomics
          if (bVar4) {
            *pcVar1 = -1;
            cVar3 = ExclusiveMonitorsStatus();
          }
          ...
```

Two things are worth noting: Ghidra decoded `cntpct_el0` **as a named register**, so
the hardware read is unambiguous; and the `+1` with an `INT64_MAX` clamp is
Cố ý phát triển**, không phải bọc.

### `FUN_0027bc0c` — thread context

```c
void FUN_0027bc0c(/* 9 args */)
{
  uVar2 = thunk_FUN_002bb75c();
  uVar1 = tpidr_el0;                     // <-- thread-pointer register
  FUN_0027bbfc(..., uVar2, uVar1);
  return;
}
```

It reads `tpidr_el0` and passes it onward — thread-local context handling, consistent
with the `nn::os` thread primitives `main` imports.

## 4 phương pháp nhận diện, và giới hạn của nó

**Method.** Find behaviour by instruction marker (`MRS <sysreg>`, `SVC`), then ask
Ghidra chức năng chứa mỗi trang web. điều này không cần biểu tượng, điều quan trọng bởi vì
`sdk`'s names are unavailable (see §5).

**Những gì điều này không làm.**Nó không tên những chức năng này. 10 mục là
`FUN_0007f4bc` and so on. It establishes:

- _Những chức năng này là trong thời gian / chỉ văn bản họ;
- Họ thực hiện truy cập phần cứng;
- Chữ ký và kích cỡ thật sự của chúng.

It does **not** establish which of them corresponds to `nn::os::GetSystemTick`
specifically, nor map any of them to the 49 imports in `PLATFORM_REFERENCE.md`.

## Năm, tại sao các chức năng của nền tảng vẫn chưa được nêu tên

Ba tuyến tên đã được thử và tất cả đều thất bại. Ghi lại chúng như là kết quả tiêu cực:

1. **`.rodata` strings are only text.** `sdk` holds 8,579 distinct `_ZN2nn…` strings,
   1,496 in platform namespaces (e.g. `_ZN2nn2os13FinalizeMutexEPNS0_9MutexTypeE`),
   nhưng chúng là những chuỗi để giải thích, và một chuỗi không phải là bản đồ.
   text — the tell is that `_ZN2nn4util6detail7FloatPiE` is a *data* symbol and cannot
   là một hàm số khẳng định.
2. **MOD0's export table is runtime-generated.** `ModuleOffset` (`0x6bf5b8`) points
   into `.rwdata` where the struct is **zeroed**, matching the
   [SwitchBrew MOD spec](https://switchbrew.org/wiki/MOD)'s *"runtime-generated module
   object, typically `.bss` base."* Four candidate field layouts produced nothing.
3. **`nso2elf.mjs`'s `.symtab` is corrupt for `sdk`.** A 368-entry `.symtab` exists,
   but its contents are fragments (`TypeE4EEEEENS1_6detail14CoreMethodInfo…`), and
   `_ZN2nn2os` appears **zero** times. The converter produced 113,150 real names for
   `main`; it does not work here.

## 6 Công cụ ghi chú

Nhà phân tích không đầu Ghidra 12 có **no Jython**, và **PyGhidra không thể cài đặt vào đây
host** — bundled `jpype` wheels are cp310/cp311 while the distro ships **Python 3.14**,
so `pip install --no-index` fails. **Java scripts are the only route.**

Ghidra's on-demand Java compilation đã bị thất bại một cách âm thầm; nguyên nhân là hai
lỗi biên dịch thường:

```java
DataUtilities.isStringData(d)     // no such method in Ghidra 12
sv.replace('\n', "\\n")           // String.replace(char, String) does not exist
```

Compile explicitly against Ghidra's 195-jar classpath and place the `.class` beside
the source. See `tools/ghidra/`.

## 7, bước tiếp theo, theo thứ tự trả tiền mong đợi

1. **Resolve `main`'s GOT entries to `sdk` addresses.** Each of the 49 thunks forwards
   qua chính xác một con trỏ; lập bản đồ chức năng cấu trúc.
   Con đường trực tiếp và hành động có giá trị cao nhất, và nó được kết nối với 49 con trỏ.
2. **Broaden the marker set.** Many `nn::os` primitives have distinctive shapes —
   `nn::os::CreateThread` must reach `SVC`, `LockMutex` must use exclusives. Extending
   Đánh dấu trong quá khứ / văn bản sẽ phân loại nhiều hơn 8.267.
3. **Fix or bypass the `.symtab` corruption** in `nso2elf.mjs` for `sdk`, which would
   Phục hồi 337 tên xuất khẩu thật.
4. **Search for the vendor SDK symbol file** for build `972CC255…`.

## 8 Giới hạn trung thực

- **No `sdk` function is named.** All 8,267 are `FUN_*`/`LAB_*`, including the 10 here.
- **Nothing is mapped to `main`'s 49 imports.** That linkage was not attempted.
- **10 của 8,267 chức năng đã được ghi nhận.** Đây là một minh chứng phương pháp, không phải là một
  khảo sát.
- **`nn::mem` / `nn::vi` / `nn::fs` were not specifically located.** Only time-keeping
  và các điểm liên kết được thăm dò.
- ** Phương pháp đánh dấu giả định đánh dấu là cần thiết cho hành vi.** giữ
  cho người đếm đọc và người gọi; nó không phải là nói chung.
- **Pseudo code không được thực hiện** - đó là mã của Ghidra.
  Thay vào đó, quy trình tái sử dụng sẽ được thực hiện.
