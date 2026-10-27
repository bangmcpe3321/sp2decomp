# Splatoon 2 khởi động: những gì các mô- đun thực sự chứa

Phạm vi: ** Đọc chức năng khởi động lên và ghi lại chuỗi khởi động thật.** Đây là kết quả. Mỗi yêu cầu
Bên dưới là trực tiếp đọc về hình ảnh mô-đun bị cắt giảm hoặc một dấu vết thời gian chạy — chứ không phải suy luận.

---

## 1. The entry point is `main+0x24`, not `main+0x0`

`main` does **not** begin with code. Its first `0x24` bytes are the **MOD0 header**:

```
main+0x0000:  0x00000000   0x00000008
main+0x0008:  0x30444f4d              <- "MOD0" in little-endian
main+0x000c:  0x02f9a468   0x02fdbff8
main+0x0010:  0x02fdbff8   0x03698f98
main+0x0018:  0x02921ec0   0x02a00eac
main+0x0020:  0x02fdbff8
main+0x0024:  0xd10243ff              <- sub  sp, sp, #0x90     CODE BEGINS
```

```
+0x0024:  sub   sp, sp, #0x90
+0x0028:  stp   x20, x19, [sp, #0x70]
+0x002c:  stp   x29, x30, [sp, #0x80]
+0x0030:  mov   x29, sp
+0x0034:  adrp  x19, ...
+0x0038:  ldr   w8, [x19, #0xb8]      <- a status word
+0x003c:  cbnz  w8, ...                <- if already set, branch past the work
```

** Hai điều tiếp theo:**

1. **The port's start point is correct.** `init_module` calls `main + 0x24`, which is precisely the first
   instruction of code — and its `ldr w8, [x19,#0xb8]` / `cbnz` guard is the `init_status == 2` word
   Được ghi nhận trước đó. ** Cổng đã gọi đúng chức năng.**
2. **The MOD0 header is a genuine trap** — any analysis that treats `main+0x0` as code is reading the header.
   This is the same class of issue as the recorded `NSO2ELF_MOD0_BUG.md`.

## 2. `main` contains no kernel calls at all

Scanning all `0x1415068` bytes of `main`'s text for SVC instructions:

```
main:  0 svc sites
```

**Zero.** Every kernel interaction in this game goes through `sdk`. That is why HLE-only reasoning about
`main` never found the heap setup: **`main` cannot perform one.**

## 3. `sdk` has a uniform SVC stub table — one site per SVC

```
sdk: 104 svc sites
     #1x1, #2x1, #3x1, #4x1, #5x1, #6x1, #7x1, #8x1, #9x1, #10x1, #11x1, #12x1, #13x1, #14x1, ...
```

**Một địa điểm chính xác cho mỗi SVC 1–14.** Nó không được rải rác trực tiếp — nó là một bảng **sub**: SDK
exposes `svcSetHeapSize`, `svcExitProcess`, … as wrappers, and the game calls the wrappers.

**`svcSetHeapSize` is at `sdk+0x9e660`**, and its form is a minimal wrapper:

```
sdk+0x09e65c:  0xf81f0fe0   str   x0, [sp, #-0x10]!     ; push the out-pointer
sdk+0x09e660:  0xd4000021   svc   #1                    ; SetHeapSize(x1)
sdk+0x09e664:  0xf94003e2   ldr   x2, [sp]              ; reload it
sdk+0x09e668:  0xf9000041   str   x1, [x2]              ; *out = heap base
sdk+0x09e66c:  0x910043ff   add   sp, sp, #0x10
```

**Nó chứa một đống hạt nhân đã trở về qua con trỏ của người gọi. ** Vì vậy, bất kỳ người gọi của gói này
receives the process heap at `kHeapBase` — exactly the value `nn::init::InitializeAllocator` is meant to get.

## 4. `rtld` does not set up memory either

`rtld` is 11,888 bytes of text and contains **five** SVCs total:

|SVC|Nghĩa là|
|---:|---|
| 6 | `QueryMemory` |
| 7 | `ExitProcess` |
| 38 | `Break` |
| 39 | `Break` (variant) |
| 40 | `OutputDebugString` |

**No `svcSetHeapSize`.** So the loader is not the heap's origin, and the earlier assumption that `rtld`
Tiến hành thiết lập bộ nhớ tiến trình là **wrong**.

## Trình tự khởi động thực sự, càng xa càng tốt.

```
rtld                     -- maps modules, QueryMemory, no heap setup
  -> main+0x24           -- MOD0 header precedes it; guard on the status word; runs constructors
       -> sdk+0x9e660    -- svcSetHeapSize wrapper: the ONLY way this game can obtain memory
            -> *out = kHeapBase
  -> nn::init::InitializeAllocator(heap, size)   -- expected consumer
  -> nnMain
```

**The heap is obtained exactly once, through `sdk+0x9e660`.** That wrapper is the single point where process
trí nhớ đi vào trò chơi.

## 6. Sự tương phản được đo lường

**`svcSetHeapSize` is never called in the port's run — zero times.** Traced over a complete run:

```
svc 0x1  (SetHeapSize)        0 calls
svc 0x1d (SignalProcWideKey)  49
svc 0x29 (GetInfo)            8
svc 0x6                       2
svc 0xc                       1
```

**So the port reaches `nnMain` without the one call that gives the game its memory.** Everything downstream
that needs a heap — `HeapMgr::sDefaultArena` having no buffer, `ExpHeap::tryCreate` returning null,
`IDisposer(heap=null)` — follows directly from this single absence.

## Câu hỏi chính xác còn lại

**Who calls `sdk+0x9e660`?** The wrapper exists, is correct, and is never invoked. Its caller is the missing
Bước khởi động — và nó là một điều ràng buộc, có thể tìm thấy: chính xác là một gọi địa điểm vào một chức năng 20 byte đã biết.

**Đó là toàn bộ vấn đề bẫy giày còn lại**, giảm xuống còn một lần nhìn.

## 8 Điều này chứng minh gì?

|Xác nhận|Bằng chứng|
|---|---|
| `main`'s code starts at `+0x24`, after the MOD0 header |** Đọc từ hình ảnh **|
|Điểm bắt đầu của cổng là đúng| ✅ `init_module` calls `main+0x24` |
| `main` contains **zero** SVCs |Quét văn bản đầy đủ **|
| `sdk` has one stub per SVC 1–14 |Chính xác 1:1 cho 1–14**|
| `svcSetHeapSize` is `sdk+0x9e660` |♪ Bị tách rời và tách rời ♪|
|Đó wrapper trả lại các đống cơ sở thông qua một off-pointer|♪ Đã ráp lại ♪|
| `rtld` does **not** set up memory |**5 SVCs, không ai trong số họ #1**|
| `svcSetHeapSize` is never called at runtime |(Tiếng Tây Ban Nha) 0 cuộc gọi**|
|Sự vắng mặt của đống đá giải thích lỗi hiện tại.|▪ Hòa hợp với mọi đo lường|

## 9 Điều này không xác minh

- **Who calls `sdk+0x9e660` is not identified.** That is the single remaining link, and it was not found.
- **Whether the caller is in `sdk`'s own start-up, in `main` before constructors, or in `rtld` is unknown.**
- **`rtld` was scanned for SVCs but not recompiled or executed** — its control flow is unread.
- **The MOD0 header fields were not decoded** (only identified), so `0x02f9a468` etc. are unresolved.
- ** Trò chơi không được khởi động.** Không có gì được trình bày. ** Đây không phải trò chơi có thể chơi.**
