# The platform layer is in the dump

**Correction (2026-11-14).** Earlier notes in this repository concluded that `main`'s
platform imports were resolved by a system module absent from the dump, and that the 51
boot functions had to be written from scratch. That conclusion was an artifact of two
tooling bugs — the NSO0 header offsets and the MOD0 "export table" walk. With those fixed,
**all 51 boot functions resolve to real implementations in the game's own ExeFS**, split
across `main`, `sdk`, `subsdk0` and `subsdk1`.

No game code is reproduced here. The table records module-relative offsets so they can be
recovered from a reader's own dump.

---

## 1. What each module provides

| Module | Defined dynsym | Platform content |
|---|---:|---|
| `main` | 145,838 | `nn::init::InitializeAllocator`, `nvnLoadCProcs`, plus the game/engine code |
| `sdk` | 15,934 | **349 `nn::os`**, **33 `nn::mem`**, **71 `nn::time`**, **44 `nn::oe`**, **73 `nn::diag`**, **450 `nn::fs`**, `nn::nifm`, `nn::util`, … |
| `subsdk0` | 1,562 | **7 `nv`** functions including `nv::InitializeGraphics` and the allocator installs, **`nvnBootstrapLoader`**, `nvnBootstrapLoaderInternal`, `nvnDevtoolsBootstrap` |
| `subsdk1` | 483 | **151 `nn::vi`** functions, including all 6 boot entries |
| `subsdk2` | 68 | exports, but no `nn::os`/`nn::mem`/`nn::vi`/`nv` namespace |
| `subsdk3` | 450 | exports, but no `nn::os`/`nn::mem`/`nn::vi`/`nv` namespace |
| `rtld` | — | no MOD0 and no dynsym (loader format, not the platform layer) |

The `sdk` column is the decisive correction: it is **not** "the filesystem service" with no
`nn::os`/`nn::mem`. It contains the OS, allocator, time and operator-environment layer.
`nn::vi` is not in `sdk` at all; it is in `subsdk1`. That part of the old conclusion was
right about `sdk`, but the other modules were never searched.

### The whole import list, not just the boot closure

`main` has **784** undefined dynsym entries (its imports). **772 resolve to a definition
in the dump**:

| Provider | Imports resolved |
|---|---:|
| `sdk` | 741 |
| `subsdk3` | 12 |
| `subsdk2` | 9 |
| `subsdk1` | 6 |
| `subsdk0` | 4 |

The 12 that do not are four linker markers (`__rel_dyn_start`, `__rel_dyn_end`,
`__rel_plt_start`, `__rel_plt_end`) and the eight `glslc*` shader-compiler functions
(`glslcInitialize`, `glslcCompile`, …). The `glslc*` misses match the earlier note in
[RECOMP_BASES_FIXED.md](RECOMP_BASES_FIXED.md); they are not game code. Reproduce with
`module-map.mjs <dir> --all`.

---

## 2. The 51 boot functions, with providers

Offsets are **module-relative**. Only `main` has the fixed analysis base `0x7100000000`;
`sdk`/`subsdk*` are loaded at runtime-assigned bases, so adding `0x7100000000` to their
offsets is wrong. The `GOT slot` in `PORT_WORKLIST.md` is an address in `main`, not a
provider address.

| Boot function | Module | Offset | Signature |
|---|---|---:|---|
| `nn::os::AllocateMemoryBlock` | `sdk` | `0x81bd0` | `nn::os::AllocateMemoryBlock(unsigned long*, unsigned long)` |
| `nn::os::GetSystemTick` | `sdk` | `0x81b40` | `nn::os::GetSystemTick()` |
| `nn::os::QueryMemoryInfo` | `sdk` | `0x7ee20` | `nn::os::QueryMemoryInfo(nn::os::MemoryInfo*)` |
| `nn::os::SetMemoryHeapSize` | `sdk` | `0x81b84` | `nn::os::SetMemoryHeapSize(unsigned long)` |
| `nn::os::ConvertToTimeSpan` | `sdk` | `0x81b54` | `nn::os::ConvertToTimeSpan(nn::os::Tick)` |
| `nn::os::GetThreadAvailableCoreMask` | `sdk` | `0x819c0` | `nn::os::GetThreadAvailableCoreMask()` |
| `nn::os::GetTlsValue` | `sdk` | `0x81b08` | `nn::os::GetTlsValue(nn::os::TlsSlot)` |
| `nn::os::InitializeMutex` | `sdk` | `0x80d40` | `nn::os::InitializeMutex(nn::os::MutexType*, bool, int)` |
| `nn::os::SetThreadCoreMask` | `sdk` | `0x81970` | `nn::os::SetThreadCoreMask(nn::os::ThreadType*, int, unsigned long)` |
| `nn::os::SleepThread` | `sdk` | `0x8190c` | `nn::os::SleepThread(nn::TimeSpan)` |
| `nn::os::CreateThread` | `sdk` | `0x815dc` | `nn::os::CreateThread(nn::os::ThreadType*, void (*)(void*), void*, void*, unsigned long, int)` |
| `nn::os::CreateThread` | `sdk` | `0x81580` | `nn::os::CreateThread(nn::os::ThreadType*, void (*)(void*), void*, void*, unsigned long, int, int)` |
| `nn::os::InitializeSemaphore` | `sdk` | `0x812ac` | `nn::os::InitializeSemaphore(nn::os::SemaphoreType*, int, int)` |
| `nn::os::LockMutex` | `sdk` | `0x80d94` | `nn::os::LockMutex(nn::os::MutexType*)` |
| `nn::os::SetThreadName` | `sdk` | `0x81660` | `nn::os::SetThreadName(nn::os::ThreadType*, char const*)` |
| `nn::os::UnlockMutex` | `sdk` | `0x80e80` | `nn::os::UnlockMutex(nn::os::MutexType*)` |
| `nn::os::InitializeMessageQueue` | `sdk` | `0x80150` | `nn::os::InitializeMessageQueue(nn::os::MessageQueueType*, unsigned long*, unsigned long)` |
| `nn::os::AllocateTlsSlot` | `sdk` | `0x81a74` | `nn::os::AllocateTlsSlot(nn::os::TlsSlot*, void (*)(unsigned long))` |
| `nn::os::ChangeThreadPriority` | `sdk` | `0x8187c` | `nn::os::ChangeThreadPriority(nn::os::ThreadType*, int)` |
| `nn::os::GetCurrentCoreNumber` | `sdk` | `0x81928` | `nn::os::GetCurrentCoreNumber()` |
| `nn::os::GetCurrentThread` | `sdk` | `0x81870` | `nn::os::GetCurrentThread()` |
| `nn::os::GetThreadId` | `sdk` | `0x819d0` | `nn::os::GetThreadId(nn::os::ThreadType const*)` |
| `nn::os::SetTlsValue` | `sdk` | `0x81b1c` | `nn::os::SetTlsValue(nn::os::TlsSlot, unsigned long)` |
| `nn::os::GetCurrentStackInfo` | `sdk` | `0x7ed88` | `nn::os::GetCurrentStackInfo(unsigned long*, unsigned long*)` |
| `nn::os::GetThreadPriority` | `sdk` | `0x818dc` | `nn::os::GetThreadPriority(nn::os::ThreadType const*)` |
| `nn::mem::StandardAllocator` | `sdk` | `0x7bd2c` | `nn::mem::StandardAllocator::StandardAllocator()` |
| `nn::mem::StandardAllocator` | `sdk` | `0x7bd4c` | `nn::mem::StandardAllocator::StandardAllocator(void*, unsigned long)` |
| `nn::mem::StandardAllocator::Initialize` | `sdk` | `0x7bd70` | `nn::mem::StandardAllocator::Initialize(void*, unsigned long)` |
| `nn::mem::StandardAllocator::Allocate` | `sdk` | `0x7bfbc` | `nn::mem::StandardAllocator::Allocate(unsigned long)` |
| `nn::mem::StandardAllocator::Allocate` | `sdk` | `0x7becc` | `nn::mem::StandardAllocator::Allocate(unsigned long, unsigned long)` |
| `nn::mem::StandardAllocator::Free` | `sdk` | `0x7bfc4` | `nn::mem::StandardAllocator::Free(void*)` |
| `nn::init::InitializeAllocator` | `main` | `0xdda018` | `nn::init::InitializeAllocator(void*, unsigned long)` |
| `nn::time::Initialize` | `sdk` | `0x153680` | `nn::time::Initialize()` |
| `nn::time::IsInitialized` | `sdk` | `0x153a00` | `nn::time::IsInitialized()` |
| `nn::time::StandardUserSystemClock::GetCurrentTime` | `sdk` | `0x154d5c` | `nn::time::StandardUserSystemClock::GetCurrentTime(nn::time::PosixTime*)` |
| `nn::time::ToCalendarTime` | `sdk` | `0x1550bc` | `nn::time::ToCalendarTime(nn::time::CalendarTime*, nn::time::CalendarAdditionalInfo*, nn::time::PosixTime const&, nn::time::TimeZoneRule const&)` |
| `nn::time::ToCalendarTime` | `sdk` | `0x155174` | `nn::time::ToCalendarTime(nn::time::CalendarTime*, nn::time::CalendarAdditionalInfo*, nn::time::PosixTime const&)` |
| `nn::nifm::Initialize` | `sdk` | `0x130ce4` | `nn::nifm::Initialize()` |
| `nn::diag::detail::LogImpl` | `sdk` | `0x4123c` | `nn::diag::detail::LogImpl(nn::diag::LogMetaData const&, char const*, ...)` |
| `nn::oe::Initialize` | `sdk` | `0x13632c` | `nn::oe::Initialize()` |
| `nn::util::VSNPrintf` | `sdk` | `0x3d8f8` | `nn::util::VSNPrintf(char*, unsigned long, char const*, std::__va_list)` |
| `nn::fs::MountRom` | `sdk` | `0x5ac78` | `nn::fs::MountRom(char const*, void*, unsigned long)` |
| `nn::fs::QueryMountRomCacheSize` | `sdk` | `0x5aa64` | `nn::fs::QueryMountRomCacheSize(unsigned long*)` |
| `nn::vi::CreateLayer` | `subsdk1` | `0xa694` | `nn::vi::CreateLayer(nn::vi::Layer**, nn::vi::Display*)` |
| `nn::vi::GetDisplayVsyncEvent` | `subsdk1` | `0x9374` | `nn::vi::GetDisplayVsyncEvent(nn::os::SystemEventType*, nn::vi::Display*)` |
| `nn::vi::GetNativeWindow` | `subsdk1` | `0xab38` | `nn::vi::GetNativeWindow(void**, nn::vi::Layer*)` |
| `nn::vi::Initialize` | `subsdk1` | `0x2740` | `nn::vi::Initialize()` |
| `nn::vi::OpenDefaultDisplay` | `subsdk1` | `0x90a0` | `nn::vi::OpenDefaultDisplay(nn::vi::Display**)` |
| `nn::vi::SetLayerScalingMode` | `subsdk1` | `0xaac8` | `nn::vi::SetLayerScalingMode(nn::vi::Layer*, nn::vi::ScalingMode)` |
| `nv::InitializeGraphics` | `subsdk0` | `0xc8c4` | `nv::InitializeGraphics(void*, unsigned long)` |
| `nv::SetGraphicsAllocator` | `subsdk0` | `0xc700` | `nv::SetGraphicsAllocator(void* (*)(unsigned long, unsigned long, void*), void (*)(void*, void*), void* (*)(void*, unsigned long, void*), void*)` |
| `nv::SetGraphicsDevtoolsAllocator` | `subsdk0` | `0xb36b0` | `nv::SetGraphicsDevtoolsAllocator(void* (*)(unsigned long, unsigned long, void*), void (*)(void*, void*), void* (*)(void*, unsigned long, void*), void*)` |
| `nvnBootstrapLoader` | `subsdk0` | `0xb35c4` | `nvnBootstrapLoader` |
| `nvnLoadCProcs` | `main` | `0xddd6e4` | `nvnLoadCProcs` |

---

## 3. How it was recovered

1. **NSO0 header.** The layout is hactool's `nso0_header_t`, not the earlier guess:
   `0x10/0x20/0x30` are `{file_offset, memory_offset, decompressed_size, align_or_total}`,
   `0x40` is the build id, `0x60+4i` are the LZ4 compressed sizes, and `0x3C` is the bss size.
2. **MOD0.** It is at `.text + 8`. SwitchBrew's [MOD](https://switchbrew.org/wiki/MOD) page
   confirms it is a `PT_DYNAMIC` replacement with **no symbol/string-table fields**. Its
   offsets are relative to the MOD0 header: on this build
   `DynamicOffset 0x2f9a468 + 8 = 0x2f9a470`, exactly the `.dynamic` VA in `README.md`, and
   the tags there are valid while the bytes at `+0` are not.
3. **`.dynamic`.** `DT_SYMTAB` / `DT_STRTAB` / `DT_HASH` give the symbol table and strings.
   `main`: `DT_SYMTAB=0x1c2e7e0`, `DT_STRTAB=0x1f899c8`, `DT_HASH.nchain=146,623`.
   `sdk`: `DT_SYMTAB=0x360a30`, `DT_STRTAB=0x3be150`, `DT_HASH.nchain=15,948`.
4. **Match imports to providers.** `main`'s undefined dynsym entries are the imports; each
   module's defined dynsym entries are the providers. Exact mangled-name matching yields the
   51/51 table above (`tools/nso/module-map.mjs`).

### Reproduce

```bash
# 1. Extract the program NCA and its ExeFS with nstool (or the equivalent hactool commands).
nstool --fstree -k prod.keys "Splatoon 2 [01003bc0000a0000][USA][v0].nsp"
nstool -k prod.keys --tik <ticket.tik> --part0 work/exefs <program.nca>

# 2. Decompress each NSO to the hactool "uncompressed" form.
for f in main sdk subsdk0 subsdk1 subsdk2 subsdk3; do
  hactool -t nso "work/exefs/$f" --uncompressed="work/exefs/$f.decompressed"
done

# 3. Recover and map.
node tools/static/nso-dynsym.mjs work/exefs/main.decompressed
node tools/nso/module-map.mjs work/exefs --worklist PORT_WORKLIST.md
node tools/nso/nso2elf.mjs work/exefs/main.decompressed main.elf
node tools/nso/validate-elf.mjs main.elf
```

`sdk.decompressed` is a useful second check: it must report 15,948 dynsym entries, not the
corrupt table the old converter produced.

---

## 4. Why the previous conclusion was wrong

- `tools/nso/nso2elf.mjs` read `MOD0+0x18` as a string-table offset and `MOD0+0x1C` as a
  symbol-table offset. On `main`, `+0x18` is `ModuleOffset` and `+0x1C` is unrelated data.
  The tool produced **0 exports** for `main` and a self-consistent but wrong `.symtab` for
  `sdk`.
- `tools/static/nso-header.mjs` used a different, also wrong NSO layout (`0x10` as a file
  size, etc.), so its "MOD0 at `.text+0x378F68`" was a scan artifact.
- The statement "`sdk` has zero `nn::mem`/`nn::init`/`nn::vi`" came from that broken walk.
  The real `sdk` dynsym has 349 `nn::os` and 33 `nn::mem` definitions; `nn::vi` lives in
  `subsdk1`, which the earlier analysis did not search.
- `NSO2ELF_MOD0_BUG.md` already recorded that the export-table pointers "must come from a
  different location … the `.dynamic`/`DT_*` path". That is exactly where they are.

---

## 5. What this changes for the port

- The platform layer no longer has to be written from a call-site contract: the shipped
  implementations are available to decompile. That changes the work from "write 51
  functions" to "port/decompile the real bodies".
- `nn::init::InitializeAllocator` and `nvnLoadCProcs` are **in `main` itself**, at
  `0xdda018` and `0xddd6e4`. They are not imports from a missing module.
- `nn::vi` (6 functions) is in `subsdk1`; `nv` (3) and `nvnBootstrapLoader` are in
  `subsdk0`; the other 40 are in `sdk`.
- This does **not** mean the port boots by itself: the recompiled runtime, NVN backend and
  boot wiring are still required. It means the contract is no longer based only on call
  sites.
- [PLATFORM_BODY_NOTES.md](PLATFORM_BODY_NOTES.md) starts the body-level cross-check. Its
  first result is a real difference: the retail `StandardAllocator` is a free-list
  allocator, while `port/`'s is a bump allocator that never reuses freed memory.

---

## 6. Caveats

- The 51 entries are the **boot closure**, not the full platform surface. `sdk` alone has
  349 `nn::os` definitions; the map can be regenerated with `--worklist` for any list.
- The match is by exact mangled name. Overloads are listed separately
  (`CreateThread` 6/7-arg, `ToCalendarTime` 3/4-arg, the two `StandardAllocator`
  constructors).
- `rtld` has no MOD0; `subsdk2`/`subsdk3` have exports but no platform namespaces.
- Module offsets are not virtual addresses. Use a module's load base at runtime; only
  `main`'s analysis base is fixed at `0x7100000000`.
- The extraction commands use the reader's own keys and dump; nothing from the game is
  committed here.
