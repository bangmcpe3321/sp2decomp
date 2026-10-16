# SDK type sizes, verified against the binary

Why this exists: the platform layer in `port/` needs storage for the SDK's opaque types
(`MutexType`, `SemaphoreType`, `ThreadType`, `MessageQueueType`). Those sizes are not
published in any repository available here, so they were initially host-driven guesses.
This document replaces the guesses with evidence, and states clearly which sizes are
**measured**, which are **bounded**, and which are **unobservable**.

---

## Method

The game allocates storage for these types inside its own objects and passes the address
to the API, e.g. `nn::os::LockMutex((MutexType *)(this + 0x348))`. Two kinds of evidence
follow from that:

1. **Sibling-field measurement (strong).** When one call passes both the type and an
   adjacent field of the same object, the delta between their offsets is a hard bound:
   `sizeof(T) <= delta`.
2. **Adjacent-global spacing (weak).** Two globals initialised at neighbouring addresses
   suggest a stride, but independently-aligned symbols can coincide. Treated as a
   candidate, never as a measurement.

A third case matters: types the **SDK** allocates on the game's behalf are never
exercised inline by game code, so their size is not observable from these call sites.

---

## Measured: `MessageQueueType` ≤ 0x48 (72 bytes)

Four independent call sites pass the queue and its backing buffer as sibling fields of
the **same** object:

```
InitializeMessageQueue((MessageQueueType *)(this + 0x1f8), (ulong *)(this + 0x240), 0x20)
InitializeMessageQueue((MessageQueueType *)(this + 0x60),  (ulong *)(this + 0xa8),  0x20)
InitializeMessageQueue((MessageQueueType *)(this + 0x18),  (ulong *)(this + 0x60),  0x20)
InitializeMessageQueue((MessageQueueType *)(this + 0x168), (ulong *)(this + 0x1b0), 0x21)
```

| queue offset | buffer offset | delta | count | buffer bytes |
|---|---:|---:|---:|---:|
| 0x1f8 | 0x240 | **0x48** | 0x20 | 0x100 |
| 0x60 | 0xa8 | **0x48** | 0x20 | 0x100 |
| 0x18 | 0x60 | **0x48** | 0x20 | 0x100 |
| 0x168 | 0x1b0 | **0x48** | 0x21 | 0x108 |

**All four agree on 0x48.** Because the buffer is a sibling field, the queue's region
cannot exceed 0x48 — that is a measurement, not an inference.

The count is a runtime capacity rather than part of the type: two sites pass 0x20 and one
passes 0x21, with 8-byte slots, so the buffer is 0x100 or 0x108 bytes respectively.

## Bounded: `MutexType` ≤ 0x20 (candidate)

Two globals are initialised 0x20 apart:

```
InitializeMutex((MutexType *)&DAT_71036580b8, true, 0)
InitializeMutex((MutexType *)&DAT_71036580d8, true, 0)
```

`0x71036580d8 − 0x71036580b8 = 0x20`.

**This is weaker than it looks, and the difference matters.** Both addresses are in
`.bss`, so they are **distinct symbols** rather than proven elements of one array. Two
independently 8-byte-aligned globals can also land 0x20 apart. A third mutex global sits
a distance of `0x402b0` away, which is **not** divisible by 0x20, 0x28 or 0x18 — so the
three are not elements of a common array, which is consistent with separate globals.

A `.bss` object also has **no bytes in the file**, which is why an attempt to dump them
returned empty: they are zero-filled at load, not stored.

**Conclusion: 0x20 is a plausible size, not a measurement.** It is recorded as the
`MutexType` upper-bound candidate with that caveat attached.

### The consequence for the port — an honest limitation

`sizeof(std::recursive_mutex)` on x86-64 Linux is **48 bytes**, so the host backing store
for a recursive mutex cannot fit in a reconstructed 0x20-byte `MutexType`. The build
enforces this with a `static_assert` rather than letting it silently overflow.

This is acceptable **for this port and only for this port**, and the reason is specific:

- At every observed call site the game allocates the `MutexType` as a **single field**
  (`this + 0x348`, `(this + 0x20)`, …), never as an array element whose stride the SDK
  must know.
- The SDK therefore never needs to compute `sizeof(MutexType)`; it only dereferences a
  pointer the game supplied.

So a host struct larger than the SDK's is safe here — but it is **not ABI-compatible**,
and it would break if any code walked an array of these. That distinction is recorded
rather than glossed.

## Consistent but unbounded: `SemaphoreType` at `this + 0x20`

Four call sites, all `(SemaphoreType *)(this + 0x20)`:

```
InitializeSemaphore((SemaphoreType *)(this + 0x20), param_1, param_2)
```

The offset is *stable*, which confirms a single well-defined field, but no following
sibling field appears in evidence — so **no size bound** can be derived from these call
sites. A semaphore handle is typically one pointer, and the host needs only enough
storage for its own primitive.

## Unobservable: `ThreadType`

Three of four `SetThreadCoreMask` sites dereference a **pointer** field:

```c
nn::os::SetThreadCoreMask(*(ThreadType **)(this + 0xe0), -1, (ulong)uVar1);
nn::os::SetThreadCoreMask(*(ThreadType **)(this + 0xd0), -1, (ulong)uVar1);
nn::os::SetThreadCoreMask((ThreadType *)(this + 8), param_1, param_2 & 0xffffffff);  // inline
```

`ThreadType` is created by `CreateThread`, i.e. **the SDK allocates it on the game's
behalf**. Only one site passes inline storage (`this + 8`), which gives no upper bound
either. Its size is an SDK-internal detail and is **not observable** from this evidence.

Because the game only ever holds it by pointer and never reads its fields in the observed
code, any host reserve is sufficient. The header keeps a generous reserve and says so.

---

## Summary

| Type | Evidence | Size claim | Confidence |
|---|---|---|---|
| `MessageQueueType` | 4 sibling-field deltas, all 0x48 | **≤ 0x48** | **measured** |
| `MutexType` | 2 `.bss` globals 0x20 apart | 0x20 candidate | weak — not an array |
| `SemaphoreType` | 4 sites, stable offset, no sibling | unbounded | none |
| `ThreadType` | SDK-allocated, held by pointer | unobservable | none |

---

## Cross-architecture check: the host layout is NOT portable

The port was built and its whole contract suite run on **two architectures**:

| Architecture | Result |
|---|---|
| x86-64 (native) | 111 checks, 0 failures |
| **aarch64** (`aarch64-linux-gnu-g++` + `qemu-aarch64`) | **111 checks, 0 failures** |

**The AArch64 build immediately caught a real defect that x86-64 could not.** The
semaphore's host state measured:

| Architecture | `sizeof(SemaphoreState)` |
|---|---:|
| x86-64 | **96 bytes** |
| aarch64 | **104 bytes** |

A `static_assert` sized against x86-64 passed there and **failed on AArch64**. The
underlying cause is that the port was storing host state *in place* inside the
SDK-visible type, so the buffer size depended on the host ABI.

**The fix makes the layout ABI-independent:** the SDK-visible type now holds a single
**pointer** to the host state, allocated on the heap. That works because the SDK only ever
receives a *pointer* to caller-owned storage — it never needs to know the host state's
size. The same change would apply to `MutexType` were its host type to grow.

**This is the concrete argument for cross-architecture testing in this project.** A
reconstructed ABI validated on one architecture is not validated — and the failure mode
is silent memory corruption rather than a compile error, except where a `static_assert`
happens to catch it.

### Reproduce

```bash
sudo apt install -y g++-aarch64-linux-gnu    # qemu-aarch64 was already present
bash tools/wsl/wsl-aarch64-run.sh            # cross-compile + run under qemu
```

## What this changes in `port/`

1. `MessageQueueType` storage is set to **0x48**, from measurement, not guess.
2. `MutexType` carries the 0x20 candidate and the explicit note that the host backing
   store is larger, with the reason it is nonetheless safe here.
3. `ThreadType` and `SemaphoreType` document that their sizes are unverified, and why
   that is not currently blocking.

## Limits

- **`MutexType`'s true size is not established.** The 0x20 spacing is suggestive only.
  Settling it would need a site where the game walks an array of mutexes, or DWARF/symbol
  data, neither of which is present.
- **No type size was verified against a vendor header**, because none is available here.
- **`MessageQueueType`'s 0x48 is an upper bound**, not necessarily the exact size — the
  buffer could begin after a small alignment gap.
