# UI control-name lifetime and `nn::os` gaps (second pass)

Follow-up to `RECOMP_GENERATOR_AND_SDK_CONTRACTS.md`, from the same second lift of the retail
`main` (USA base, `01003bc0000a0000`, build id `F18FF3CFCBAD…`) on a Linux runtime derived from
[`Muhammad1259-sigma/totk-recomp`](https://github.com/Muhammad1259-sigma/totk-recomp) @ `a32f709`
(MIT). All addresses are `main`-relative, so they re-check against any copy.

This pass covers a family of failures that all *look* like something else: a null control in a UI
page, a stalled title, a hung worker. None was a game-code bug; each was a host contract the
recompiled SDK bodies depend on.

---

## 1. UI control names dangle unless the guest `nn::os::ThreadType` carries the stack base

**Symptom.** Boot died in `Cui::CustomizePartsSet::onInitialize` (`0x1d9530`) dereferencing a null
control at `+0x1f0`; the looked-up name was `/L_ItemBtn_00`. After skipping that, the page's own
`onInitialize` (`0x1d24d0`) failed on `/L_CustomIconBtn_00`. It looked exactly like a layout or
resource-queue problem (the layout *files* loaded fine), and a whole sub-layout was suspected.

**What it actually is.** `Lp::UI::Impl::Name::init` (`0x124351c`) decides, for a control's name,
between **share** and **copy**:

```
this_chars = ...
if (sead::MemUtil::isStack(this))          -> SHARE
src_chars  = [src + 8]
if (!sead::MemUtil::isStack(src_chars))    -> SHARE   ; else COPY (heap alloc + memcpy)
```

`sead::MemUtil::isStack` (`0x13a1f30`) computes each thread's stack region from the **guest
`nn::os::ThreadType`**:

```
[ThreadMgr]                      ; current thread
[thread + 0x224]                 ; -> the thread's nn::os::ThreadType
base = [[thread+0x224] + 0x50]   ; stack base
size = s32[thread + 0x88]        ; stack size
in region [base, base+size) ?
```

If the port's `nn::os::CreateThread` HLE keeps the stack only in host-side bookkeeping and never
writes it into the guest `ThreadType`, every region is `[0, size)`, `isStack` returns **0 for every
pointer**, and `Name::init` always takes SHARE. The control then stores a raw pointer to the
caller's stack frame; once that frame is reused the name is garbage, the name/hash compare in
`Control::List::search` fails, and `Cui::Page::findPartsControl` (`0x20bd74`) returns null for
**every** lookup. Only the first one is visible, which is why it reads as "one missing control".

**Fix (host side, no game code).** In the `nn::os::CreateThread` HLE (both the 6- and 7-argument
forms) and in whatever registers the main thread:

```c
if (thread_type) *(u64 *)(thread_type + 0x50) = stack_base;   // ThreadType stack base
```

With that, `isStack` answers 1 for stack temporaries, the names are copied, and the page builds.
For us this turned a hard boot crash into a working 3D title screen; the fs trace went from 23 to
~93 unique layouts as more pages could be created.

**Generalisation.** Any recompilation that HLEs `nn::os` must keep the guest `ThreadType` faithful,
not just its own shadow copy: the SDK reads it directly. `GetCurrentStackInfo` and the thread
region queries are the same contract.

---

## 2. `nn::os` entries the SDK calls that must not be stubs

These were `UNIMPL` in a first-pass HLE and each produced a *silent* stall or abort rather than a
clean crash:

| Entry | What broke without it |
|---|---|
| `WaitEvent` / `TimedWaitEvent` / `TryWaitEvent` on the plain `EventType` | a scheduler thread spun; note these are **distinct** from the System/Light/Timer event families even though all can share one host event object |
| `JamMessageQueue` / `TryJamMessageQueue` | the main thread parked forever in `nn::os::WaitThread`: a worker never received its stop message (jam = push-front even when full) |
| `ReleaseSemaphore(SemaphoreType*)` — the **1-argument** overload | a semaphore acquired by one thread was "released" by a stub and never woke its waiter: the title presented a handful of frames and then stalled (semaphores are often released through the 1-arg form, while ports tend to implement only the 2-arg one) |
| `CreateThread` 7-arg form (`...mii`, SDK 5+), `SetThreadNamePointer`, `SdkAllocateTlsSlot`, `FlushDataCache` | thread creation / naming / TLS for audio and applet clients |

A useful way to see the stall: an event ring that logs `init/signal/clear/wait-enter/wait-done`
with the guest `lr`, dumped on a hang; the unmatched wait-enter with its `lr` names the exact
blocked call.

---

## 3. Generator: a PIC jump table whose base is copied through a `mov`

Extends §1 of the sibling document. Shape, from `gsys::GBuffer::expand` (`0xf861a4`, dispatch at
`0xf862e0`):

```asm
adrp  x8, #page
add   x8, x8, #off          ; x8 = table base
mov   x10, x8               ; base copied into the register the load indexes from
ldrsw x8, [x10, x9, lsl #2] ; x8 = entry (s32 byte offset)
add   x8, x8, x10           ; x8 = table + entry  (a mid-function case label)
br    x8
```

The existing resolver finds the load and the `adrp+add`, but its table-base scan stops at the
`mov`: the nearest definition of the load's base register is the `mov`, not the `adrp`. The table
then stays a runtime dispatch, and the branch target is a **mid-function** case label, so the host
`call_ind` traps ("indirect call to unknown target" at an address inside a function that does exist).

**Fix.** While scanning back for the table base, follow `mov <scan>, xOther` copies (keep the
load's own base register for the `add d, d, base` anchor test, or the anchor linkage breaks). On
this title it resolved five more tables (`br_jumptable` 1108 → 1113, `br_indirect` 6360 → 6355).

**Diagnostic.** "Indirect call to unknown target" at an address that lies *inside* a lifted
function (not at its entry) is almost always an unresolved **intra-function** jump table, not a
vtable or ABI fault. The `br`'s table gave case labels, not function entries.

---

## 4. Optional: drive the pad without a physical controller

For headless runs and scripted progression, a small host-side channel is enough: the runtime
writes/reads a 24-byte state blob (`"PAD1"`, `u32 seq`, `u64 buttons`, four `s16` stick axes) and
merges it into the HID sample, with a ~500 ms release timeout so a dead writer never leaves a
button held. A host sequencer can then send timed presses, holds, stick values, and waits for
markers in the game log. This is how the title → character creation → tutorial flow was driven
deterministically (the confirm defaults to *No*, so it needs Right then A).
