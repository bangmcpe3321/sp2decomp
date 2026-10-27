# Kích thước chất đống không phải là người chặn — và người gọi đã rút lại lời tuyên bố

Hai kết quả, một tiêu cực và một tự sửa chữa.

---

## 1. Kích thước khối đo, được áp dụng: âm trong sạch

`kAllocSize` was changed from 512 MB to the **measured `0xC9200000` (3218 MB)**, taken from the live game's
`x1` at `svcSetHeapSize`.

```
installing game allocator at kHeapBase: 0x5000000000 size 0xc9200000
game allocator installed
entering nnMain
=== HOST SIGSEGV ===  fault 0x88
  main+e767d0  sead::ExpHeap::tryCreate + 0x44
```

**Cái đống này bây giờ lớn hơn 6.3× và lỗi là dựa trên định lý.**

**Vì vậy, kích thước không bao giờ là ràng buộc.** 5 vòng đoán tại 64 MB / 512 MB đã đóng cửa, và
Câu trả lời cho câu hỏi "Liệu số đúng sẽ sửa được nó không?" là **no**. đáng giá đúng một lần để thiết lập lại.

## 2. Địa chỉ người gọi đã được mã hóa

I reported the caller of `svcSetHeapSize` as `sdk+0x86868`, from the `lr` captured at the breakpoint. **That is
sai**, và phân tách xung quanh nó cho thấy lý do:

```
sdk+0x086854:  0xa9017bfd              ; stp x29, x30, [sp, #N]      <- prologue
sdk+0x086858:  0x910043fd              ; mov x29, sp
sdk+0x08685c:  0xaa0103e0              ; mov x0, x1
sdk+0x086860:  0xaa0203e1              ; mov x1, x2
sdk+0x086864:  0x9408ea96              ; bl  -> sdk+0x2C1xBC      *** NOT 0x9e660 ***
sdk+0x086868:  0x34000300              ; cbz w0, ...              <- what lr pointed at
```

`lr = 0x86868` implies the call was a `bl` at `0x86864` — but **that `bl` targets `sdk+0x2C1xBC`, not
`svcSetHeapSize` at `0x9e660`**. To reach `0x9e660` the encoding would need `imm26 = 0x5F7F`
(`0x94005F7F`); the actual word is `0x9408EA96`.

**Not the caller.** The most plausible explanation is that the wrapper at `0x9e660` is **tail-entered with `b`**,
so `lr` was inherited from farther up and never pointed at the `bl` I assumed.

**What survives:** the heap size `0xC9200000`, read directly from `x1`. **What does not:** the caller address.

## 3. Lỗi phương pháp, nói rõ ràng

**I hand-matched `lr` to a `bl` instead of taking a backtrace.** That is the *same class of mistake* as the
round-2 `GetNext`/`SetNext` "overlap": arithmetic on encoded instructions, done by hand, where a tool exists
mà không thể tạo ra lỗi đó.

**`bt` at the breakpoint would have been correct the first time.** The lesson from this project's five previous
Điều chỉnh lại: Khi gắn vào bộ gỡ lỗi, hãy dùng nó thay vì dùng tay để giải mã.

## 4 vòng này chứng minh gì?

|Mục|Tình trạng|
|---|---|
|Hiệu ứng Quét Trang trình diễn| ✅ `0xC9200000` (3218 MB) |
|Heap kích cỡ cố định lỗi|**Không — cùng một lỗi**|
|Kích cỡ của nó là ngăn chặn|**DISPROVED**|
|Chính nó cũng có kích thước như vậy| ✅ **still valid** (read from `x1`) |
| Caller = `sdk+0x86868` |**ĐÀ ĐÃ ĐÃ ĐÃ ĐÃ *|
|Phương pháp tiếp theo cho người gọi| ✅ **`bt` at the breakpoint** |

## 5 Điều này không xác minh

- **The real caller of `svcSetHeapSize` is unknown again.**
- **Whether `0x9e660` is tail-entered with `b`** is a hypothesis, not measured.
- **Why `ExpHeap::tryCreate` still fails** is unexplained — and it is now clear the cause is *neither* the heap
  Kích thước *nor* (theo như đã được điều tra) bộ đệm của đấu trường.
- **No `InitializeAllocator` capture** confirmed the size reaches it, though the log shows the call was made with
  `0xc9200000`.
- ** Cổng không thay đổi về hành vi và vẫn chưa khởi động.** Không có gì được dịch ra. ** Đây không phải là một trò chơi
  Trò chơi.**

## 6. Tăng dần

**Re-catch `svcSetHeapSize` and take a `bt`** — the caller from the debugger, not from `lr` arithmetic. That is
sự sửa đổi duy nhất cần thiết để phục hồi liên kết còn thiếu, và nó sử dụng phương pháp mà đáng lẽ phải được sử dụng
Ban đầu.

Ngoài ra, bằng chứng tích lũy chỉ ra từ "số phù hợp" và về phía ** Động cơ của chính mình
Khởi động làm điều gì đó mà cổng vẫn chưa làm** — đó là công việc xây dựng, chứ không phải đo lường.
