# Recompiler fixes and SDK contracts from a second Splatoon 2 lift

**Source.** These came out of a second, independent recompilation of the same retail `main`
(USA base, title `01003bc0000a0000`, build id `F18FF3CFCBAD…`) on a Linux runtime derived from
[`Muhammad1259-sigma/totk-recomp`](https://github.com/Muhammad1259-sigma/totk-recomp) @ `a32f709`
(MIT). Nothing here is specific to that runtime: the generator fixes are general AArch64
patterns, and every contract below is a property of *this* game's own SDK bodies, recovered by
disassembly of the reader's dump. Offsets are module-relative, so they can be re-checked against
anyone's copy.

Two parts:

1. **Generator fixes** — three `br`/`bl` shapes that make the translator fall back to a runtime
   dispatch, which then traps at a mid-image address. Each one is a real instruction pattern in
   this game, with the exact address it appears at.
2. **SDK contracts** — layouts and return values that a port has to match, recovered from the
   shipped bodies rather than guessed. These are the ones that produced silent misbehaviour
   (an abort, a 0-byte allocation, a null font) instead of a clean crash.

---

## 1. Generator

### 1.1 PIC jump table: `add d, d, base` (mirrored operand order)

The common PIC switch shape is

```
ldrsw x12, [x28, x12, lsl #2]
add   x12, x12, x28          ; entry = base + table[i]
br    x12
```

Two things defeat a detector that assumes `add d, anchor, idx`:

* the anchor is the **third** operand, and `d` is both destination and the loaded entry;
* the anchor is not an `adr` label but the table's own base, materialised with `adrp`+`add`
  (a `.rodata` table), so an `adr`-only anchor rule finds nothing.

In this game the shape is at `sdk 0x3cccc..0x3ccd8` (`nn::util::VFormatString`, the printf flag
parser). Symptom before the fix: the `br` becomes `call_ind(0x3ce44)`, and every call to
`VSNPrintf`/`SNPrintf` through the lifted code dies with *indirect call into sdk image (no lifted
function at this address)*.

Fix (two independent pieces; both are needed):

```python
# accept either operand order
def jump_table(self, insns, i, start, end):
    for swapped in (False, True):
        got = self._jump_table(insns, i, start, end, swapped)
        if got: return got
    return None

def _jump_table(self, insns, i, start, end, swapped=False):
    ...
    anchor_reg, idx_reg = addm[1], addm[2]
    if swapped: anchor_reg, idx_reg = idx_reg, anchor_reg   # `add d, d, base`

    # ... after the adrp/add scan produced `page`/`off` and `tabs`:
    if anchor is None and page is not None and rn(anchor_reg) == rn(tbase_reg):
        anchor = page + (off or 0)      # anchor *is* the table base
    if anchor is None: return None
```

Note `load is None` must be checked **before** the anchor fallback, not the anchor first: in this
form the anchor is not known until the table base is resolved.

Impact on this game: `sdk` went from 0 detected jump tables to **270** (`br_indirect` 648 → 378);
`main` from 0 to **1108** (`br_indirect` 7468 → 6360). Every one of those was a latent trap.

### 1.2 Cold fragment at the end of a function (direct `BL` to a non-FDE address)

`main 0x13a2748` does `bl 0x13a6f2c`, and `0x13a6f2c` is **not** an FDE start: it sits exactly at
the end of the FDE that starts at `0x13a6ef4` (length `0x38`). It is a function's cold half emitted
right after its hot half. `funcs.py` reports it as `bl_not_fde_start`, and a translator that emits
`call_ind(<constant>)` for it traps because the function table has no entry there.

There are only four such addresses in the whole game:

| Module | Address | Extent |
|---|---|---|
| `main` | `0x13a6f2c` | `0x94` |
| `sdk` | `0x871c8` | `0x78` |
| `sdk` | `0x87454` | `0x8c` |
| `sdk` | `0x87468` | `0x318` |

Fix: before emitting, synthesise a function at every BL target that is (a) inside `.text`,
(b) not an FDE start, (c) not a PLT stub, (d) 4-byte aligned; extent = next FDE start (or end of
`.text`).

```python
extra = sorted({t for t in funcs_json['bl']
                if t not in fde and t not in plt and lo <= t < hi and not (t & 3)})
starts = sorted(fde)
for t in extra:
    i = bisect.bisect_right(starts, t)
    end = starts[i] if i < len(starts) else hi
    fde[t] = end - t
```

Because the target is at an FDE *end*, the synthesized extent is exactly the orphaned block; no
code overlaps.

### 1.3 One more shape to keep in mind

`main 0x13a6ef4` ends with `b 0x710000019c`, i.e. a tail call into the import-stub region. Any
translator that treats "branch to an address outside the function" as a direct call must still go
through the import table for that range — it is the same rule as 1.2, seen from the other side.

---

## 2. SDK contracts recovered from the bodies

Each entry: what a port must return/expect, and the body it was read from. All are properties of
this game's SDK (3.x-era); they differ from the 5.x/9.x SDKs in the later ports, which is exactly
how they fail silently.

### 2.1 `nn::os::MemoryInfo` (`sdk 0x85154`, `DebugImplByHorizon::QueryMemoryInfo`)

```
+0x00 total physical        (svcGetInfo 6)
+0x08 total used            (svcGetInfo 7)
+0x10 heap size             (the value the app passed to SetMemoryHeapSize)
+0x18 heap used
+0x20 free
+0x28 reserved/peak
+0x30 u32
```

`main 0x11f5b90` reads `+0x10` and `+0x18` right after `SetMemoryHeapSize(0xcb000000)` and
`AllocateMemoryBlock(0x2000000)`, subtracts them and reserves the difference as its main heap.
Leaving `+0x10`/`+0x18` zero makes that a **0-byte** `AllocateMemoryBlock` — and `VirtualAlloc(p, 0)`
fails, which looks like a heap-commit bug rather than a struct-layout bug.

Sanity check from the game's own boot report: total non-system 3328 MB, root heap 3248 MB.

### 2.2 `nn::audio::AudioRendererParameter` (`sdk 0x1593b4` init, `0x1592c4` validate)

```
+0x00 u32 sampleRate      48000 or 32000
+0x04 u32 sampleCount     = sampleRate / 200   (240 or 160)
+0x08 u32 >= 1, < 0x101
+0x0c s32 >= 0, < 0x101
+0x10 s32 >= 1, < 0x401
+0x14 s32 >= 1, < 0x101
+0x18 s32 >= 0, < 0x101
+0x30 u32 revision info    (IsValid compares it against the driver's live query)
size 0x34
```

`IsValid` is called immediately after `Initialize` (`main 0x1fdd8`/`0x1fe1c`); if it returns
false the game calls `nn::diag::detail::AbortImpl` during `nnMain`. A 5.x-shaped struct
(rate/count/channels) fails on the revision field at `+0x30`.

The 3.x device API also uses the **old spellings**; the 5.x `…ForOutput` names are not present:

| 3.x | 5.x equivalent |
|---|---|
| `ListAudioDeviceName` | `ListAudioOutputDeviceName` |
| `GetActiveAudioDeviceName` | `GetActiveAudioOutputDeviceName` |
| `AcquireAudioDeviceSwitchNotification` | `AcquireAudioDeviceNotificationForOutput` |
| `GetActiveChannelCount` | `GetActiveAudioDeviceChannelCountForOutput` |

`GetMemoryPoolState` must read **1 (attached)** after `RequestAttachMemoryPool`; `main 0xe20744`
polls it in a sleep loop otherwise.

### 2.3 `nn::pl` shared fonts (`main 0x12751e4` caller)

`GetSharedFontLoadState` must return **1** when ready — the wait loop at `main 0x1275240` spins
until it does (it is not `2`). It then reads size and address and hands the address to the font
engine, which parses it: **the address must never be null**, or the game faults at `main 0x137e190`.
A zeroed block is rejected by the loader and the game falls back to its own romfs fonts
(`Font/ScalableFont.szs`, `Font/BmpFont_*.szs`).

### 2.4 NVN: the API version is per-game

`nvnDeviceGetInteger(dev, 0)` is the NVN API **major**, `(dev, 1)` the minor. This game requires
`major == 0x35` (53) and `minor >= 5` at `main 0xe6758c`; a runtime tuned for a later title (55.x)
takes the other branch and **skips `sead::Graphics` creation entirely**, so `sdk`'s
`sead::Graphics::sInstance` (a BSS pointer) stays null and the first
`sead::Graphics::lockDrawContext()` (`main 0xe9d120`) dereferences null. The version check is a
good early sanity test: if `sInstance` is null at the first lock, check this first.

### 2.5 Small `nn::os` entries that are easy to miss

| Symbol | Why it matters |
|---|---|
| `nn::os::TrySendMessageQueue` | no `Try` variant of the non-light queue in some ports; returns 0 → "could not send", and a presentation loop then never advances |
| `nn::os::CreateThread` (7-arg) | the 6-arg overload exists in most ports; the 7-arg one adds the core number |
| `nn::os::SetThreadNamePointer` | 5.x spelling; storing the pointer is enough |
| `nn::os::SdkAllocateTlsSlot` | same slot pool as `AllocateTlsSlot` |

### 2.6 `nn::svc::aarch64::lp64` — what a lifted sdk actually calls

Once sdk bodies run lifted, the syscall layer becomes reachable and needs HLE (it cannot run on a
Linux host). The 69 names this game's `sdk` imports through its own PLT:

* `svc::*` (33): `GetInfo`, `SetHeapSize`, `QueryMemory`, `SleepThread`, `GetThreadId`,
  `SetThreadPriority`, `GetThreadPriority`, `SetThreadCoreMask`, `GetThreadCoreMask`,
  `SetThreadActivity`, `GetLastThreadInfo`, `GetThreadContext3`, `CreateThread`, `StartThread`,
  `ExitThread`, `ExitProcess`, `CloseHandle`, `CreateEvent`, `SignalEvent`, `ClearEvent`,
  `ResetSignal`, `ArbitrateLock`, `ArbitrateUnlock`, `WaitProcessWideKeyAtomic`,
  `SignalProcessWideKey`, `CancelSynchronization`, `CreateSession`, `AcceptSession`,
  `ConnectToPort`, `ConnectToNamedPort`, `SendSyncRequest`, `SendSyncRequestWithUserBuffer`,
  `ReplyAndReceive`, `ReplyAndReceiveWithUserBuffer`, `CreateSharedMemory`, `MapSharedMemory`,
  `UnmapSharedMemory`, `CreateTransferMemory`, `MapTransferMemory`, `UnmapTransferMemory`,
  `CreateInterruptEvent`, `SetMemoryPermission`, `SetMemoryAttribute`, `OutputDebugString`,
  `Break`, `QueryProcessMemory`, `QueryDebugProcessMemory`
* musl/libgcc pieces the SDK imports: `fesetenv`, `fegetenv`, `fegetround`, `__fesetround`,
  `feclearexcept`, `feraiseexcept`, `fetestexcept`, `unw_getcontext`,
  `nnosGetDefaultUserExceptionStackForApplication`, `nndetailCryptoBignum{Add,MulAdd,Sub}Words`
* `nn::os::detail::{CallFiberFunction,DispatchFiberContext}` (fibers), `__rel_dyn_*` markers

Two of these are worth calling out for behaviour, not just linkage:

* `svc::ConnectToNamedPort` — returning a *failure Result* (e.g. `0xE401`) is much better than
  trapping: a lifted IPC client then fails the way it would on a console without that service, and
  the game logs and falls back. Names are logged once, which is a cheap map of what is still
  missing.
* `svc::OutputDebugString` — this is how the game's own diagnostic log reaches you. Implementing it
  (write to stderr) gives the game's boot report and its assertion messages for free; in this game
  the first thing it prints is the memory report quoted in 2.1.

---

## 3. Where the lift/HLE boundary ended up

The useful rule, once sdk bodies can be run:

* **Lift** anything that is pure: container/heap (lmem), font engine (`nn::fontll`), codec
  wrappers, `nn::util`, math, string, `nn::codec::Opus*`. In this game that turned 463 zero-stubs
  for `main`'s imports into 192 live bodies plus the 63 already lifted.
* **HLE** anything that is a *service or IPC client*: `sf`, `sm`, `vi`, `fs`, `hid`, `nifm`,
  `apm`, `oe`, `aoc`, `pctl`, `ldn`, `bcat`, `nfp`, `ns`, `spl`, `pm`, `lm`, `applet`,
  `settings`, `mii`, `nfc`, `movie`, `cap`, `web`, `usb`, `pcv`, `i2c`, `gpio`, `psc`, `pminfo`,
  `spsm`, `ts`, `htcs`, `ldr`, `socket`, `ssl`, `account`, `os`, `pl`, `audio` — and every `svc`.

Doing that in that order matters: a service client's real body calls `svcConnectToNamedPort("sm:")`
and, without 2.6, either traps or spins. Note the exclusion has to apply to the sdk's *own* PLT
slots too, not only to `main`'s imports, or an sdk-internal call reaches the IPC path anyway.

---

## 4. Boot milestones (module-relative, for cross-checking a trace)

| Milestone | `main` address |
|---|---|
| `DT_INIT` | `0x24` |
| `nninitStartup` | `0x19a3dc` |
| `nnMain` | `0x19a3e0` |
| memory report / `QueryMemoryInfo` consumer | `0x11f5b80` |
| NVN device create + API version check | `0xe6758c` |
| `sead::Graphics::initialize` call | `0xe6764c` |
| `sead::Graphics::lockDrawContext` | `0xe9d120` |
| shared-font wait | `0x1275240` |
| audio renderer parameter init/validate | `0x1fdd8` / `0x1fe1c` |

With those in place this game reaches its own sound-bank and `ELink2`/`SLink2` database loading and
then the font engine (`nn::fontll::ScalableFontEngine::GetKerning`) inside `nnMain`, all lifted.
