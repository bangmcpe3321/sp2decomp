# The March-2017 proto, the NPDM, and where the heap really comes from

Round after the goal: the proto NSP was extracted, the NPDM read, and one **principled fix** was applied.
The fix did **not** unblock the hang — that is recorded as a negative result.

---

## 1. The proto extracted

`Splatoon 2 - Proto March - Repacked.nsp` (5.9 GB) → program NCA → **ExeFS**, cleanly. The NSP was already
decrypted, so no title key was needed.

| | **Proto** `01003BC000027000` | **Retail** `01003BC0000A0000` |
|---|---|---|
| NPDM SDK version | **0.12.17.0** | (not printed) |
| `main` | **25,962,984** | 23,717,627 |
| `sdk` | 3,031,640 | 3,032,664 |
| `subsdk0` | 787,508 | 787,508 ← identical |
| `subsdk1` | 67,846 | 67,223 |
| `subsdk2` | **7,456** | **49,096** |
| `subsdk3` | 49,096 | 174,009 |
| `subsdk4` | 174,009 | — |
| `subsdk9` | 74,408 | — |

**The module numbering is shifted, not merely extended:**

- **proto `subsdk3` (49,096) == retail `subsdk2` (49,096)** — exact match
- **proto `subsdk4` (174,009) == retail `subsdk3` (174,009)** — exact match
- proto has an extra **7,456-byte `subsdk2`** that retail dropped, plus a **`subsdk9`** with no retail counterpart.

**Consequence for this project:** the port's module table and base assignment are **retail-specific**, and
the proto would need its own. That is a real cost, not a detail.

## 2. The proto does not solve the SDK problem

`sdk` is within 1 KB of retail's. Both are the same `nnos*` era. **The five silent Wonder-vs-Splatoon-2
mismatches (`g_fast[4]`, module stride, `kDtInit`, `init_status`, the allocator) all still apply.**

**What the proto *does* offer** is visible in its IPSwitch patch file: a **debug build** with
`DbgSetting`, scene redirection (`UICheck::Scene`, `UdgwTest::Scene`, `GearUnsetupTest::Scene`), map loading
(`[+] Load map`, `[-] FreeTest`) and test modes (`Mission (Test)`, `VS (Test)`). That is a **much better
offline target** than retail's network-gated front-end — **once** static init completes, which it does not.

## 3. The NPDM told us something useful

Reading `main.npdm` shows **`svcSetHeapSize` (SVC 0x01) is in the app's allowed SVC list**, alongside
`svcExitProcess`, `svcGetCurrentProcessorNumber`, `svcWaitProcessWideKeyAtomic` and
`svcSignalProcessWideKey`.

**That is the real mechanism by which the game obtains memory**, and it reframes the allocator work of
earlier rounds: `nn::init::InitializeAllocator(buf, size)` is not meant to be handed an arbitrary buffer —
on hardware it receives **the heap the kernel returned from `svcSetHeapSize`**, which lives at **`kHeapBase`
inside the guest address space**.

## 4. Two measurements

**`svcSetHeapSize` is never called.** With `NX_TRACE=1` over a full run:

```
svc 0x1  (SetHeapSize)   :  0 calls
svc 0x1d (SignalProcWideKey): 49
svc 0x29                 :  8
svc 0x6                  :  2
svc 0xc                  :  1
```

Zero. The SDK startup that would call it is exactly what this port bypasses by entering at `nnosInitialize`
→ `nnMain`.

**The runtime *does* implement it correctly** (`kernel.cpp:429`): it commits at `kHeapBase`, enforces
`kHeapMax`, and returns `kHeapBase` in `x1`.

**And our hand-installed allocator was passing a HOST address:**

```
installing game allocator: buf=0x798ca0e62010 size=0x20000000 via main+dda018
```

`0x798ca0e62010` is a 47-bit **host** pointer — **far outside the guest's `0x71xxxxxxx` range**.

## 5. The fix, and its honest result

`install_game_allocator` now places the heap at **`nx::kHeapBase` (guest space)** and commits it through the
platform layer, matching what the kernel would do:

```
installing game allocator at kHeapBase: 0x5000000000 size 0x20000000 (guest space)
```

**Result: the hang is unchanged.** Still `main init[1367]`,
`nn::nex::PseudoGlobalVariable<StreamSettings>`, exit 124.

**So the heap location was NOT the cause.** That is a clean negative result, and the change is kept because
it is **correct** — guest pointers now live where the guest expects them — not because it fixed anything.

## 6. What this establishes

| Item | State |
|---|---|
| Proto NSP extractable | ✅ **yes — already decrypted** |
| Proto SDK version | ✅ **0.12.17.0** |
| Proto module layout | ✅ **subsdk0-4 + subsdk9; numbering shifted vs retail** |
| Proto has a debug menu / scene loader | ✅ from its patch file |
| Proto is a drop-in replacement | ❌ **no — different module table** |
| `svcSetHeapSize` in allowed SVCs | ✅ read from NPDM |
| `svcSetHeapSize` called by the game | ❌ **0 times** |
| Old allocator used a host address | ✅ **confirmed `0x798ca0e62010`** |
| Heap now in guest space | ✅ **done** |
| That fixed the hang | ❌ **no** |

## 7. What this does NOT establish

- **The proto was never recompiled or run.** Only its NSOs were extracted and its patch file read.
- **The proto's static-init graph was not compared with retail's** — whether it has fewer or more
  `PseudoGlobalVariable` registrations is unknown, and that is the number that matters.
- **The proto's `main` was not checked for `nnosInitialize` / `nn::init` symbols.**
- **`main.npdm.modded` was not diffed against `main.npdm`** — someone already changed it, and what they
  changed is not known.
- **The hang's cause is unchanged and still unexplained.**
- **`nnMain` still not reached.** No NVN, no window. **This is not a booted game.**

## 8. Next increment

**Compare the two static-init graphs.** Decompress the proto's `main` and `sdk`, generate their tables, and
compare the **count and identity of `PseudoGlobalVariable` registrations** against retail's 62.

- **If the proto registers materially fewer**, it is a genuinely better target and worth porting.
- **If it registers the same set**, the proto buys nothing for this bug and its only advantage is the debug
  menu — which is only reachable after static init anyway.

That is a bounded, mechanical comparison, and it decides whether the proto is worth a port.
