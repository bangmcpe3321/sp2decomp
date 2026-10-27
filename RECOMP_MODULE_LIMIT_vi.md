# `g_fast[4]` — a confirmed, one-line incompatibility

`RECOMP_RESOLVER.md` §7 flagged a module limit in the recompiler runtime and called it "the next
và nó là thật.

---

## 1, mã.

`runtime/src/loader.cpp`:

```cpp
// line 160-161
FastModule g_fast[4];
size_t g_fast_count = 0;

// line 164  -- call() only ever consults this fixed array
void call(CPU& c, uint64_t t) {
    for (size_t k = 0; k < g_fast_count; k++) { ... }
    // ... falls through to the HLE thunk table
}

// line 232  -- registration, SILENTLY SKIPPING anything past the 4th
g_modules.push_back(lm);
if (g_fast_count < 4) g_fast[g_fast_count++] = {lm.base, mi->text_size, lm.table};
```

**Four is a hard limit.** The `if (g_fast_count < 4)` guard means the 5th and 6th modules are
**never registered for indirect-call resolution, with no diagnostic.** `g_modules` (a vector) holds
all of them, but `call()` does not consult it — only `g_fast`.

## 2. Splatoon 2 có sáu mô-đun

|Module|Cỡ|
|---|---:|
| `main` |23,717.627 B|
| `sdk` |3.032.664 B|
| `subsdk0` |787.508 B|
| `subsdk1` |67,223 B|
| `subsdk2` |49,096 B|
| `subsdk3` |184,009 B|

**6 mô-đun đối diện với giới hạn 4.** 2 sẽ bị thả xuống.

## 3. Kết quả chính xác

- **Direct calls are unaffected.** A direct `bl` is emitted as a direct C++ call
  (`main_00123456(c)`), which needs no table.
- **Indirect calls are affected.** All 77,764 `nx::call` sites resolve through `g_fast`. If the
  *target* lives in an unregistered module, `off < m.text_size` never matches for it, the call falls
  through to the HLE thunk path, and fails — with the runtime's `"call into the middle of a
  function"` fatal or a worse thunk mismatch.

**So the damage depends on whether any `blr` targets a function in modules 5–6.** That is
**statistically likely** for `sdk` (which implements services the game calls through vtables) but is
**Không đo** ở đây.

## 4. Các mô-đun được thả là một sự lựa chọn các PORT làm

`load_modules(const ModuleInfo* const* mods, size_t count, const std::string& data_dir)` takes an
**Array bộ điều khiển mô-đun từ người gọi** -- trong trường hợp của Wonder trò chơi keo.
Quyết định của Splatoon 2 sẽ tạo ra, chứ không phải là một cái gì đó cố hữu.

That means a port could **order the array to put `main` and `sdk` first**, keeping the two most
Các mô-đun quan trọng trên con đường nhanh. **Đó là một cách sắp xếp, không phải sửa chữa** — nó mua chức năng tại
the cost of silently losing indirect calls into two small `subsdk` modules, which is exactly the
Một khoảng cách thầm lặng mà dự án này đã cẩn thận tránh.

## 5 là một hàng.

```cpp
FastModule g_fast[8];          // or 16; or make it a std::vector
...
if (g_fast_count < 8) g_fast[g_fast_count++] = ...
```

`FastModule` is `{uint64_t base, text_size; const Fn* table;}` — 24 bytes. Raising the bound from
4 đến 8 chi phí **96 byte thêm** và loại bỏ hoàn toàn giới hạn.

**Nó là mật mã MIT- chứng minh**, vì vậy đây là một bản đánh dấu hợp pháp với những lời buộc tội.
Thay đổi cho dự án bên thứ ba, nên được ghi lại như một bản vá thay vì giả định -
and it may already be fixed upstream or in the sibling `SwitchGamesRecomp` repository where the
Chia sẻ thời gian cuộc sống.

## 6. Điều này có nghĩa gì đối với việc đánh giá tổng thể

Đây là sự tương thích chân thật thứ nhất ** được tìm thấy** trong toàn bộ con đường tổng hợp, và nó là:

- ** Xác nhận bằng cách đọc mã**, không bị nghi ngờ
- **narrow** — một danh sách bị hạn chế
- **cheap để sửa** — 96 byte
- **Không phải kiến trúc**

Tương phản với những gì đã bị loại trừ:

|Quan tâm|Trạng thái|
|---|---|
|Máy tính xách tay phụ trách hướng dẫn của Slaptoon 2|** Không có khoảng trống** — 0 chưa điều khiển trong 6 mô-đun|
|@ info: status|** Compbiles**|
|Kích cỡ bề mặt bên ngoài| **~35 helpers + `memcpy`** |
|Trò chơi giải quyết cụ thể|**No** — bảng tạo ra mỗi trò chơi|
|Bàn làm việc của Splatoon 2|** Complete** — 114.928/114.928|
|Số Mô- đun|**Fails ở 6 > 4** — nhưng sửa chữa một dòng|

**Mọi ngăn chặn còn lại được tìm thấy cho đến nay là nhỏ và địa phương.**

## 7 Giới hạn

- **W liệu mô- đun thực sự là mô- đun mục tiêu 5–6 đã được đo.** Nó yêu cầu một liên kết
  and a run, or a static analysis of `blr` targets across modules, neither of which was done.
- **The `mods[]` order for Splatoon 2 was not established** — the game glue that would supply it
  chưa tồn tại.
- **`SwitchGamesRecomp`'s shared runtime was not checked** for a newer version of this array.
- **`Reloc`, `init_array`/`fini_array` and the symbol binding were not examined** — the module
  machinery has more surface than `g_fast`, and only `g_fast` was inspected.
- ** Không có mã số nào bị thay đổi**, trong kho này hoặc trong bản sao.
  nộp đơn.
